// Webhook de pedidos: recibe el evento checkout.session.completed de Stripe
// y lo reenvía al flujo de n8n con los datos del pedido.
//
// Variables de entorno:
//   N8N_WEBHOOK_URL       → URL del flujo en producción (n8n ".../webhook/...")
//   N8N_WEBHOOK_URL_TEST  → URL del flujo de pruebas  (n8n ".../webhook-test/...")
//   STRIPE_WEBHOOK_SECRET → opcional; si se define, se verifica la firma de Stripe
//
// Si el evento viene en modo prueba (livemode = false) se usa la URL de test
// cuando esté configurada; en producción se usa siempre la URL de producción.
//
// Tipos globales mínimos para que este archivo compile con cualquier tsconfig
// (sin depender de "lib": ["dom"] ni de @types/node).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

function responder(cuerpo: unknown, estado = 200): any {
  const ResponseCtor = g.Response;
  return new ResponseCtor(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

function log(...args: unknown[]): void {
  const c = g.console;
  if (c && typeof c.error === 'function') c.error(...args);
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
async function verificarFirma(cuerpoCrudo: string, firma: string | null, secreto: string): Promise<boolean> {
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

export default async function handler(req: any): Promise<any> {
  // Endpoint de salud: útil para comprobar que la función está desplegada.
  if (req?.method === 'GET') {
    const env = entorno();
    return responder({
      status: 'ok',
      message: 'Webhook de pedidos activo',
      configurado: Boolean(env.N8N_WEBHOOK_URL || env.N8N_WEBHOOK_URL_TEST),
      destinoTest: Boolean(env.N8N_WEBHOOK_URL_TEST),
      firmaVerificada: Boolean(env.STRIPE_WEBHOOK_SECRET),
    });
  }

  if (req?.method && req.method !== 'POST') {
    return responder({ error: 'Método no permitido' }, 405);
  }

  // Leemos el cuerpo en texto para poder verificar la firma de Stripe.
  let cuerpoCrudo = '';
  try {
    cuerpoCrudo = await req.text();
  } catch {
    return responder({ error: 'No se pudo leer el cuerpo' }, 400);
  }

  let evento: Record<string, any>;
  try {
    evento = JSON.parse(cuerpoCrudo || '{}');
  } catch {
    return responder({ error: 'Cuerpo no válido' }, 400);
  }

  const env = entorno();

  // Verificación de firma (si hay secreto configurado).
  if (env.STRIPE_WEBHOOK_SECRET) {
    const firma = req?.headers?.get?.('stripe-signature') ?? null;
    const ok = await verificarFirma(cuerpoCrudo, firma, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) {
      log('Firma de Stripe no válida');
      return responder({ error: 'Firma no válida' }, 400);
    }
  }

  // Solo nos interesan los pedidos completados.
  const tipo = String(evento?.type ?? '');
  if (tipo && !tipo.includes('checkout.session.completed')) {
    return responder({ received: true, forwarded: false, ignored: tipo });
  }

  const livemode = evento?.livemode === true;
  const destino = urlDestino(livemode);
  if (!destino) {
    log('N8N_WEBHOOK_URL no configurada: se acepta el evento sin reenviar.');
    return responder({ received: true, forwarded: false, motivo: 'sin URL de n8n' });
  }

  const datos = (evento?.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento?.object ?? {}) as Record<string, any>;
  const detalles = (objeto.customer_details ?? {}) as Record<string, any>;
  const metadata = (objeto.metadata ?? {}) as Record<string, any>;

  let articulos: unknown = [];
  try {
    articulos = metadata.items ? JSON.parse(metadata.items) : [];
  } catch {
    articulos = [];
  }

  const pedido = {
    // Identificación
    evento: tipo || 'checkout.session.completed',
    idPedido: objeto.id ?? '',
    idPago: objeto.payment_intent ?? '',
    fecha: objeto.created
      ? new Date(objeto.created * 1000).toISOString()
      : new Date().toISOString(),
    modoPrueba: !livemode,

    // Cliente
    correo: detalles.email ?? objeto.customer_email ?? '',
    nombre: detalles.name ?? '',
    telefono: detalles.phone ?? '',

    // Dinero
    total: objeto.amount_total ? (objeto.amount_total / 100).toFixed(2) : '',
    moneda: objeto.currency ?? 'eur',
    subtotal: objeto.amount_subtotal ? (objeto.amount_subtotal / 100).toFixed(2) : '',
    impuestos: objeto.total_tax_amounts?.length
      ? (objeto.total_tax_amounts[0].amount / 100).toFixed(2)
      : '0.00',
    metodoPago: objeto.payment_method_types?.[0] ?? '',

    // Artículos
    articulos,

    // Recogida
    modoRecogida: metadata.modoRecogida ?? 'recogida',
    mesa: metadata.mesa ?? '',

    // Contexto
    urlOrigen: metadata.urlOrigen ?? '',
    restaurante: 'Las Mesas · Café & Bar',
    telefonoRestaurante: '+34 928 896 097',
    whatsappRestaurante: '346010000000',
  };

  try {
    const respuesta = await g.fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
    });

    if (!respuesta.ok) {
      log('n8n respondió con', respuesta.status, destino);
      return responder({ received: true, forwarded: false, destino }, 502);
    }

    return responder({ received: true, forwarded: true, destino, modoPrueba: !livemode });
  } catch (error) {
    log('Error al enviar a n8n:', error);
    return responder({ received: true, forwarded: false, destino }, 500);
  }
}
