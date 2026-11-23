import { randomBytes } from 'node:crypto';

// Envia una solicitud de celebracion al flujo de n8n.
//
//   POST /api/solicitud-celebracion
//   { nombre, contacto, tipoEvento, fechaAproximada, numeroPersonas, detalles }
//
// El flujo de n8n la guarda en la tabla solicitudes_celebracion de Neon.
//
// Se hace el POST desde el servidor (y no desde el navegador) para no
// depender de CORS y para que la url del webhook quede configurable.
//
// Variables de entorno:
//   N8N_WEBHOOK_SOLICITUD_CELEBRACION   url del webhook (tiene valor por defecto)
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null };
  body?: unknown;
}

interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
  send(cuerpo: unknown): void;
}

/** Margen de ejecución de la función. */
export const maxDuration = 30;

/** Webhook de n8n que recibe las solicitudes de celebracion. */
const WEBHOOK_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook/solicitud-celebracion';

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

function urlWebhook(): string {
  const configurada = String(
    entorno().N8N_WEBHOOK_SOLICITUD_CELEBRACION ?? WEBHOOK_POR_DEFECTO,
  ).trim();
  return /^https:\/\/[^\s]+$/.test(configurada) ? configurada : WEBHOOK_POR_DEFECTO;
}

let poolCelebraciones: any = null;
async function poolDeSolicitudes(): Promise<any | null> {
  const url = String(entorno().DATABASE_URL ?? entorno().NEON_DATABASE_URL ?? '').trim();
  if (!url) return null;
  if (poolCelebraciones) return poolCelebraciones;
  try {
    const pg: any = await import('pg');
    const Pool = pg?.default?.Pool ?? pg?.Pool;
    if (!Pool) return null;
    poolCelebraciones = new Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: url.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
    });
    return poolCelebraciones;
  } catch (error) {
    g.console?.error?.('[solicitudes] no se pudo conectar con Neon:', error);
    return null;
  }
}

async function prepararRegistroCelebracion(): Promise<boolean> {
  const pool = await poolDeSolicitudes();
  if (!pool) return false;
  try {
    await pool.query(`create table if not exists public.solicitudes_celebracion (
      id serial primary key,
      nombre varchar(120) not null,
      contacto varchar(120) not null,
      tipo_evento varchar(80) not null,
      fecha_aproximada varchar(40),
      numero_personas integer not null,
      detalles text,
      fecha_creacion timestamp without time zone not null default now()
    )`);
    await pool.query(`alter table public.solicitudes_celebracion
      add column if not exists codigo text,
      add column if not exists estado text not null default 'nueva',
      add column if not exists recordatorio_enviado boolean not null default false,
      add column if not exists actualizada_en timestamptz`);
    await pool.query(`alter table public.solicitudes_celebracion
      alter column codigo set default ('CEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
      alter column estado set default 'nueva',
      alter column recordatorio_enviado set default false`);
    await pool.query(`update public.solicitudes_celebracion
      set codigo = 'CEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
      where codigo is null or btrim(codigo) = ''`);
    await pool.query(`create unique index if not exists solicitudes_celebracion_codigo_idx
      on public.solicitudes_celebracion (codigo)`);
    return true;
  } catch (error) {
    g.console?.error?.('[celebracion] no se pudo preparar el registro Neon:', error);
    return false;
  }
}

async function registrarReserva(body: Record<string, any>, res: Res): Promise<void> {
  const nombre = texto(body.nombre, 120);
  const contacto = texto(body.contacto, 120);
  const fecha = texto(body.fecha, 10);
  const hora = texto(body.hora, 5);
  const numeroPersonas = Number(body.numeroPersonas ?? 0);
  const comentarios = texto(body.comentarios, 1000);
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto);
  const telefonoValido = /^\+?[0-9][0-9\s().-]{6,18}$/.test(contacto) && contacto.replace(/\D/g, '').length >= 8;
  const fechaParsed = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T12:00:00Z`) : null;

  if (!nombre) { responder(res, { error: 'Escribe tu nombre.' }, 400); return; }
  if (!emailValido && !telefonoValido) { responder(res, { error: 'Escribe un correo válido o un teléfono con al menos 8 cifras.' }, 400); return; }
  if (!fechaParsed || Number.isNaN(fechaParsed.getTime()) || fechaParsed.toISOString().slice(0, 10) !== fecha) { responder(res, { error: 'Elige una fecha válida.' }, 400); return; }
  const hoyCanarias = new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary' }).format(new Date());
  if (fecha < hoyCanarias) { responder(res, { error: 'La fecha de reserva no puede estar en el pasado.' }, 400); return; }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) { responder(res, { error: 'Elige una hora disponible.' }, 400); return; }
  if (!Number.isInteger(numeroPersonas) || numeroPersonas < 1 || numeroPersonas > 20) { responder(res, { error: 'El número de personas debe estar entre 1 y 20.' }, 400); return; }

  const pool = await poolDeSolicitudes();
  if (!pool) { responder(res, { error: 'No se pudo guardar la solicitud. Inténtalo de nuevo o llámanos al +34 928 896 097.' }, 503); return; }
  const codigo = `RES-${randomBytes(6).toString('hex').toUpperCase()}`;
  try {
    await pool.query(`create table if not exists public.solicitudes_reserva (
      id serial primary key,
      codigo text,
      nombre varchar(120) not null,
      contacto varchar(120) not null,
      fecha date not null,
      hora time not null,
      numero_personas integer not null,
      comentarios text,
      estado text not null default 'pendiente',
      fecha_creacion timestamp without time zone not null default now(),
      actualizada_en timestamptz
    )`);
    await pool.query(`alter table public.solicitudes_reserva
      add column if not exists codigo text,
      add column if not exists estado text not null default 'pendiente',
      add column if not exists actualizada_en timestamptz`);
    await pool.query(`create unique index if not exists solicitudes_reserva_codigo_idx
      on public.solicitudes_reserva (codigo)`);
    await pool.query(`insert into public.solicitudes_reserva
      (codigo, nombre, contacto, fecha, hora, numero_personas, comentarios, estado)
      values ($1, $2, $3, $4, $5, $6, $7, 'pendiente')`,
    [codigo, nombre, contacto, fecha, hora, numeroPersonas, comentarios || null]);
  } catch (error) {
    g.console?.error?.('[reserva] no se pudo guardar en Neon:', error);
    responder(res, { error: 'No se pudo guardar la solicitud. Inténtalo de nuevo o llámanos al +34 928 896 097.' }, 502);
    return;
  }

  let alertaEnviada = false;
  const webhook = String(entorno().N8N_WEBHOOK_SOLICITUD_RESERVA_URL ?? 'https://barcafeteria.app.n8n.cloud/webhook/solicitud-reserva').trim();
  if (/^https:\/\/[^\s]+$/.test(webhook)) {
    try {
      const respuesta = await g.fetch(webhook, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, nombre, contacto, fecha, hora, numeroPersonas, comentarios, estado: 'pendiente' }),
        signal: AbortSignal.timeout(8000),
      });
      alertaEnviada = respuesta.ok;
      if (!respuesta.ok) g.console?.error?.('[reserva] n8n respondió', respuesta.status, (await respuesta.text()).slice(0, 200));
    } catch (error) {
      g.console?.error?.('[reserva] solicitud guardada pero no se pudo avisar a n8n:', error);
    }
  }
  responder(res, { ok: true, recibido: true, codigo, alertaEnviada }, 201);
}

function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

function leerCuerpo(req: Req): Record<string, any> {
  const body = req?.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return (body ?? {}) as Record<string, any>;
}

/** Recorta un texto para que no ocupe de mas en la base de datos. */
function texto(valor: unknown, maximo = 500): string {
  return String(valor ?? '').trim().slice(0, maximo);
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (!req?.method || req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const body = leerCuerpo(req);

  if (body.tipoSolicitud === 'reserva') {
    await registrarReserva(body, res);
    return;
  }

  const nombre = texto(body.nombre, 120);
  const contacto = texto(body.contacto, 120);
  const tipoEvento = texto(body.tipoEvento, 80);
  const fechaAproximada = texto(body.fechaAproximada, 40);
  const numeroPersonas = Number(body.numeroPersonas ?? 0);
  const detalles = texto(body.detalles, 2000);

  if (!nombre) {
    responder(res, { error: 'Falta el nombre' }, 400);
    return;
  }
  if (!contacto) {
    responder(res, { error: 'Falta el contacto' }, 400);
    return;
  }
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto);
  const telefonoValido = /^\+?[0-9][0-9\s().-]{6,18}$/.test(contacto) && contacto.replace(/\D/g, '').length >= 8;
  if (!emailValido && !telefonoValido) {
    responder(res, { error: 'Escribe un correo válido o un teléfono con al menos 8 cifras' }, 400);
    return;
  }
  if (!tipoEvento) {
    responder(res, { error: 'Falta el tipo de evento' }, 400);
    return;
  }
  const fechaParsed = /^\d{4}-\d{2}-\d{2}$/.test(fechaAproximada)
    ? new Date(`${fechaAproximada}T12:00:00Z`)
    : null;
  if (!fechaParsed || Number.isNaN(fechaParsed.getTime()) || fechaParsed.toISOString().slice(0, 10) !== fechaAproximada) {
    responder(res, { error: 'Elige una fecha válida para la celebración' }, 400);
    return;
  }
  const hoyCanarias = new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary' }).format(new Date());
  if (fechaAproximada < hoyCanarias) {
    responder(res, { error: 'La fecha de celebración no puede estar en el pasado' }, 400);
    return;
  }
  if (!Number.isInteger(numeroPersonas) || numeroPersonas < 1 || numeroPersonas > 100) {
    responder(res, { error: 'El número de personas debe estar entre 1 y 100' }, 400);
    return;
  }

  if (!(await prepararRegistroCelebracion())) {
    responder(res, { error: 'No se pudo preparar el registro de solicitudes. Inténtalo de nuevo o llámanos al +34 928 896 097.' }, 503);
    return;
  }

  const codigo = `CEL-${randomBytes(6).toString('hex').toUpperCase()}`;

  // ── Enviar a n8n ──
  //
  // El JSON va PLANO en la raiz (sin envoltorio "body"). El nodo Webhook de
  // n8n envuelve lo recibido en "body", asi que en el nodo que va justo
  // detras del webhook se usa {{ $json.body.nombre }}.
  //
  // Ademas se envian alias en snake_case (los mismos nombres que tienen las
  // columnas de la tabla solicitudes_celebracion) para que el nodo de
  // Postgres acepte {{ $json.body.tipoEvento }} o {{ $json.body.tipo_evento }}
  // indistintamente.
  const payload = {
    // Claves del contrato (camelCase).
    nombre,
    contacto,
    tipoEvento,
    fechaAproximada,
    numeroPersonas,
    detalles,
    // Alias con el nombre de las columnas de la tabla.
    tipo_evento: tipoEvento,
    fecha_aproximada: fechaAproximada,
    numero_personas: numeroPersonas,
    codigo,
    estado: 'nueva',
    recordatorio_enviado: false,
  };

  const destino = urlWebhook();
  try {
    const r = await g.fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const textoRespuesta = await r.text();

    if (!r.ok) {
      g.console?.error?.('[celebracion] n8n respondio', r.status, textoRespuesta.slice(0, 300));
      let mensaje = `El servidor de solicitudes respondió con el código ${r.status}`;
      try {
        const datos = JSON.parse(textoRespuesta);
        mensaje = String(datos?.error ?? datos?.message ?? mensaje);
      } catch {
        /* respuesta no json */
      }
      responder(res, { error: mensaje }, 502);
      return;
    }

    log('[celebracion] Solicitud enviada a n8n', { nombre, tipoEvento });

    responder(res, { ok: true, recibido: true, codigo, aviso: 'enviado' });
  } catch (error) {
    g.console?.error?.('[celebracion] no se pudo enviar la solicitud:', error);
    responder(
      res,
      {
        error:
          'No hemos podido enviar la solicitud. Inténtalo de nuevo o llámanos al ' +
          '+34 928 896 097.',
      },
      502,
    );
  }
}

function log(...args: unknown[]): void {
  const c = g.console;
  if (c && typeof c.log === 'function') c.log(...args);
}
