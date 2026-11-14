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
  if (!tipoEvento) {
    responder(res, { error: 'Falta el tipo de evento' }, 400);
    return;
  }
  if (!Number.isFinite(numeroPersonas) || numeroPersonas < 1) {
    responder(res, { error: 'El número de personas no es válido' }, 400);
    return;
  }

  // ── Enviar a n8n ──
  const payload = {
    nombre,
    contacto,
    tipoEvento,
    fechaAproximada,
    numeroPersonas,
    detalles,
  };

  const destino = urlWebhook();
  try {
    const r = await g.fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const texto = await r.text();

    if (!r.ok) {
      g.console?.error?.('[celebracion] n8n respondio', r.status, texto.slice(0, 300));
      let mensaje = `El servidor de solicitudes respondió con el código ${r.status}`;
      try {
        const datos = JSON.parse(texto);
        mensaje = String(datos?.error ?? datos?.message ?? mensaje);
      } catch {
        /* respuesta no json */
      }
      responder(res, { error: mensaje }, 502);
      return;
    }

    log('[celebracion] Solicitud enviada a n8n', { nombre, tipoEvento });
    responder(res, { ok: true, enviado: true });
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
