// Webhook de pedidos: recibe el evento checkout.session.completed de Stripe
// y lo reenvía al flujo de n8n con los datos del pedido.
//
// Variables de entorno:
//   N8N_WEBHOOK_URL       → URL del flujo en producción (n8n ".../webhook/...")
//   N8N_WEBHOOK_URL_TEST  → URL del flujo de pruebas  (n8n ".../webhook-test/...")
//
// Si el evento viene en modo prueba (livemode = false) se usa la URL de test
// cuando esté configurada; en producción se usa siempre la URL de producción.
//
// IMPORTANTE: las serverless functions de Vercel usan el estilo Node (req, res).
// Si se devuelve un objeto Response en vez de llamar a res.end(), la petición
// nunca se completa y el cliente se queda esperando.
//
// Tipos globales mínimos para que este archivo compile con cualquier tsconfig
// (sin depender de "lib": ["dom"] ni de @types/node).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

// Margen de ejecución de la función.
export const maxDuration = 30;

/** Petición de Vercel (Node). */
interface Req {
  method?: string;
  url?: string;
  headers?: { get?: (nombre: string) => string | null };
  body?: unknown;
}

/** Respuesta de Vercel (Node). */
interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
  send(cuerpo: unknown): void;
}

import { construirPedido } from './_shared/pedido';

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

/** Envía la respuesta y cierra la petición. */
function responder(res: Res, cuerpo: unknown, estado = 200): void {
  // res.json() es el metodo nativo de Vercel: pone el Content-Type, envia el
  // cuerpo y cierra la peticion. Con res.end() el cuerpo llegaba vacio.
  res.status(estado);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

function log(...args: unknown[]): void {
  const c = g.console;
  if (c && typeof c.error === 'function') c.error(...args);
}

function info(...args: unknown[]): void {
  const c = g.console;
  if (c && typeof c.log === 'function') c.log(...args);
}

/**
 * Telefono en formato canonico: solo digitos con prefijo 34 (p.ej. 34600000000).
 * Es el formato que espera el webhook de n8n (campo cliente_telefono).
 */
function normalizarTelefono(valor: string | undefined): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 9) return `34${digitos}`;
  if (digitos.length === 10 && digitos.startsWith('6')) return `34${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('34')) return digitos;
  return digitos;
}

/** Quita barras finales y espacios para poder concatenar rutas sin duplicar. */
function limpiarUrl(url: string): string {
  return String(url).trim().replace(/\/+$/, '');
}

/**
 * Decide a qué URL de n8n enviar según el modo del evento de Stripe.
 * - livemode false (pruebas) → N8N_WEBHOOK_URL_TEST si existe, si no la de producción
 * - livemode true  (real)     → N8N_WEBHOOK_URL
 */
function urlDestino(livemode: boolean): string | null {
  const env = entorno();
  const produccion = env.N8N_WEBHOOK_URL ? limpiarUrl(env.N8N_WEBHOOK_URL) : '';
  const test = env.N8N_WEBHOOK_URL_TEST ? limpiarUrl(env.N8N_WEBHOOK_URL_TEST) : '';

  if (!livemode && test) return test;
  if (produccion) return produccion;
  return test || null;
}

/** Verifica la firma Stripe con Web Crypto (HMAC-SHA256), sin dependencias. */
async function verificarFirma(
  cuerpoCrudo: string,
  firma: string | null,
  secreto: string,
): Promise<boolean> {
  if (!firma || !secreto) return true;
  const subtle = g.crypto?.subtle;
  if (!subtle) return true; // Si no hay Web Crypto, no bloqueamos el flujo.

  const timestamp = /t=(\d+),/.exec(firma)?.[1];
  const recibido = /v1=([a-f0-9]+)/.exec(firma)?.[1];
  if (!timestamp || !recibido) return false;

  const codificador = new g.TextEncoder();
  const clave = await subtle.importKey(
    'raw',
    codificador.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const payloadFirmado = `${timestamp}.${cuerpoCrudo}`;
  const firmaCalculada = await subtle.sign('HMAC', clave, codificador.encode(payloadFirmado));
  const esperada = Array.from(new Uint8Array(firmaCalculada))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return esperada === recibido;
}

/** Lee el cuerpo de la petición como texto (para verificar la firma). */
function leerCuerpoCrudo(req: Req): string {
  const body = req.body;
  if (typeof body === 'string') return body;
  if (body === undefined || body === null) return '';
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  // Endpoint de salud: útil para comprobar que la función está desplegada.
  if (req?.method === 'GET') {
    const env = entorno();
    responder(res, {
      status: 'ok',
      message: 'Webhook de pedidos activo',
      configurado: Boolean(env.N8N_WEBHOOK_URL || env.N8N_WEBHOOK_URL_TEST),
      destinoTest: Boolean(env.N8N_WEBHOOK_URL_TEST),
      firmaVerificada: Boolean(env.STRIPE_WEBHOOK_SECRET),
    });
    return;
  }

  if (req?.method && req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const cuerpoCrudo = leerCuerpoCrudo(req);

  let evento: Record<string, any>;
  try {
    evento = JSON.parse(cuerpoCrudo || '{}');
  } catch {
    responder(res, { error: 'Cuerpo no válido' }, 400);
    return;
  }

  const env = entorno();

  // Verificación de firma (si hay secreto configurado).
  if (env.STRIPE_WEBHOOK_SECRET) {
    const firma = req?.headers?.get?.('stripe-signature') ?? null;
    const ok = await verificarFirma(cuerpoCrudo, firma, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) {
      log('Firma de Stripe no válida');
      responder(res, { error: 'Firma no válida' }, 400);
      return;
    }
  }

  // Solo nos interesan los pedidos completados.
  const tipo = String(evento?.type ?? '');
  if (tipo && !tipo.includes('checkout.session.completed')) {
    responder(res, { received: true, forwarded: false, ignored: tipo });
    return;
  }

  const livemode = evento?.livemode === true;
  const destino = urlDestino(livemode);
  if (!destino) {
    log('N8N_WEBHOOK_URL no configurada: se acepta el evento sin reenviar.');
    responder(res, { received: true, forwarded: false, motivo: 'sin URL de n8n' });
    return;
  }

  const pedido = construirPedido(evento);

  info('[webhook] Reenviando pedido a n8n', { destino, idPedido: pedido.idPedido, total: pedido.total });

  try {
    const respuesta = await g.fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
    });

    if (!respuesta.ok) {
      log('n8n respondió con', respuesta.status, destino);
      responder(res, { received: true, forwarded: false, destino }, 502);
      return;
    }

    responder(res, { received: true, forwarded: true, destino, modoPrueba: !livemode });
  } catch (error) {
    log('Error al enviar a n8n:', error);
    responder(res, { received: true, forwarded: false, destino }, 500);
  }
}
