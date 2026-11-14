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

    // ── Aviso opcional a Telegram, enviado desde la web ──
    // Si hay TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en el entorno, el aviso
    // se manda desde aqui (sin depender de n8n). Si no, el aviso lo manda el
    // nodo de Telegram del flujo de n8n.
    const aviso = await avisarTelegram({ nombre, contacto, tipoEvento, fechaAproximada, numeroPersonas, detalles });

    responder(res, { ok: true, enviado: true, telegram: aviso });
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

// ─────────────────────────────────────────────────────────────────────────────
// Aviso a Telegram
// ─────────────────────────────────────────────────────────────────────────────

interface Solicitud {
  nombre: string;
  contacto: string;
  tipoEvento: string;
  fechaAproximada: string;
  numeroPersonas: number;
  detalles: string;
}

/**
 * Manda el aviso de la solicitud a Telegram, si estan el token y el chat.
 *
 *   TELEGRAM_BOT_TOKEN   token del bot (lo da @BotFather)
 *   TELEGRAM_CHAT_ID     id del chat o grupo donde avisar
 *
 * Devuelve 'enviado', 'no configurado' o el motivo del fallo. Nunca lanza:
 * si el aviso falla, la solicitud ya esta guardada y no hay que dar error al
 * cliente.
 */
async function avisarTelegram(s: Solicitud): Promise<string> {
  const env = entorno();
  const token = String(env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = String(env.TELEGRAM_CHAT_ID ?? '').trim();
  if (!token || !chatId) return 'no configurado';

  const texto = [
    '🎉 ¡NUEVA SOLICITUD DE CELEBRACIÓN! 🎉',
    '',
    `👤 Nombre: ${s.nombre}`,
    `📞 Contacto: ${s.contacto}`,
    `🎊 Tipo: ${s.tipoEvento}`,
    `📅 Fecha: ${s.fechaAproximada}`,
    `👥 Personas: ${s.numeroPersonas}`,
    '',
    `📝 Detalles: ${s.detalles}`,
  ].join('\n');

  try {
    const r = await g.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const detalle = (await r.text()).slice(0, 200);
      log('[celebracion] Telegram respondio', r.status, detalle);
      return 'fallo: HTTP ' + r.status;
    }
    return 'enviado';
  } catch (error) {
    log('[celebracion] no se pudo avisar a Telegram:', error);
    return 'fallo: ' + (error instanceof Error ? error.message : String(error));
  }
}
