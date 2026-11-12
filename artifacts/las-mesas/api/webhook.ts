// Webhook de pedidos: recibe el evento checkout.session.completed de Stripe
// y lo reenvía al flujo de n8n con los datos del pedido.
//
// Variables de entorno:
//   N8N_WEBHOOK_URL       → URL del flujo en producción (n8n ".../webhook/...")
//   N8N_WEBHOOK_URL_TEST  → URL del flujo de pruebas  (n8n ".../webhook-test/...")
//   SUPABASE_URL           → opcional
//   SUPABASE_SERVICE_ROLE_KEY → opcional; marca el pedido como pagado
//
// Si el evento viene en modo prueba (livemode = false) se usa la URL de test
// cuando esté configurada; en producción se usa siempre la URL de producción.
//
// IMPORTANTE:
//   - Las serverless functions de Vercel usan el estilo Node (req, res). Si se
//     devuelve un objeto Response en vez de llamar a res.end(), la petición
//     nunca se completa.
//   - El código de Supabase va aqui dentro (sin imports externos) porque Vercel
//     no empaqueta ficheros externos a la carpeta api/.
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
  query?: Record<string, string | string[] | undefined>;
}

/** Respuesta de Vercel (Node). */
interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
  send(cuerpo: unknown): void;
}

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

/** Envía la respuesta y cierra la petición. */
function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
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

/** Configuración de Supabase (solo si hay clave de servicio). */
function configSupabase(): { url: string; key: string } | null {
  const env = entorno();
  const url = (env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  // La clave de servicio nueva se llama SUPABASE_SECRET_KEY; se acepta
  // tambien el nombre antiguo por compatibilidad.
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return { url, key };
}

/** Un id de pedido tiene que ser un uuid (columna `pedidos.id`). */
function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

/** Marca el pedido como pagado en la tabla `pedidos`. */
async function marcarPagado(
  pedidoId: string,
  paymentIntent?: string | null,
): Promise<void> {
  const cfg = configSupabase();
  if (!cfg || !esUuid(pedidoId)) return;

  try {
    await g.fetch(`${cfg.url}/rest/v1/pedidos?id=eq.${pedidoId}`, {
      method: 'PATCH',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        estado: 'pendiente_confirmacion',
        stripe_payment_intent: paymentIntent ?? null,
        pagado_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    log('[webhook] no se pudo marcar el pedido como pagado:', error);
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
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
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

  const datos = (evento?.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento?.object ?? {}) as Record<string, any>;
  const detalles = (objeto.customer_details ?? {}) as Record<string, any>;
  const metadata = (objeto.metadata ?? {}) as Record<string, any>;

  // Dirección: si Stripe la recogió de forma nativa (envío a domicilio) tiene
  // prioridad sobre la que rellenó el cliente en el carrito.
  const envio = (objeto.shipping ?? null) as Record<string, any> | null;
  const direccionStripe = envio?.address
    ? {
        calle: [envio.address.line1, envio.address.line2].filter(Boolean).join(', '),
        codigoPostal: envio.address.postal_code ?? '',
        ciudad: envio.address.city ?? '',
        pais: envio.address.country ?? '',
      }
    : null;

  const direccion = {
    calle: metadata.calle ?? direccionStripe?.calle ?? '',
    numero: metadata.numero ?? '',
    piso: metadata.piso ?? '',
    codigoPostal: metadata.codigoPostal ?? direccionStripe?.codigoPostal ?? '',
    ciudad: metadata.ciudad ?? direccionStripe?.ciudad ?? '',
    pais: direccionStripe?.pais ?? 'ES',
  };
  const direccionCompleta =
    metadata.direccion ||
    [
      direccion.calle,
      direccion.numero,
      direccion.piso,
      direccion.codigoPostal,
      direccion.ciudad,
    ]
      .filter(Boolean)
      .join(', ');

  let articulos: any[] = [];
  try {
    articulos = metadata.items ? JSON.parse(metadata.items) : [];
  } catch {
    articulos = [];
  }

  const tipoEntrega = metadata.tipoEntrega ?? (envio ? 'domicilio' : 'recogida');
  const telefono = normalizarTelefono(
    metadata.cliente_telefono ?? metadata.telefono ?? detalles.phone ?? '',
  );

  // Lineas con todos los alias de formato: {id, nombre, name, cantidad, qty, precio, price}
  const lineas = articulos.map((a) => ({
    id: a.id,
    nombre: a.nombre ?? a.name ?? '',
    name: a.name ?? a.nombre ?? '',
    cantidad: a.cantidad ?? a.qty ?? 1,
    qty: a.qty ?? a.cantidad ?? 1,
    precio: a.precio ?? a.price ?? '',
    price: a.price ?? a.precio ?? '',
  }));

  const codigoPedido = String(metadata.pedido_id ?? metadata.pedido_codigo ?? metadata.codigo ?? '');
  const nombreCliente = String(metadata.cliente_nombre ?? metadata.nombre ?? detalles.name ?? '');
  const telefonoCliente = telefono || 'Sin telefono';
  const direccionCliente = direccionCompleta || 'Sin direccion';

  const pedido = {
    // Identificación
    evento: tipo || 'checkout.session.completed',
    idPedido: objeto.id ?? '',
    idPago: objeto.payment_intent ?? '',
    fecha: objeto.created
      ? new Date(objeto.created * 1000).toISOString()
      : new Date().toISOString(),
    modoPrueba: !livemode,

    // Alias con los nombres que usa el flujo de n8n
    codigo: codigoPedido,
    pedido_id: codigoPedido,
    pedido_codigo: codigoPedido,
    cliente_nombre: nombreCliente,
    cliente_telefono: telefonoCliente,
    cliente_direccion: direccionCliente,
    cliente_correo: String(metadata.correo ?? metadata.cliente_correo ?? detalles.email ?? ''),
    tipo: String(metadata.tipo ?? tipoEntrega),
    mesa_id: String(metadata.mesa_id ?? metadata.mesa ?? ''),
    detalle: lineas,
    items: lineas,
    articulos: lineas,
    total_centimos: objeto.amount_total ?? Number(metadata.totalCentimos ?? 0),
    total_cents: objeto.amount_total ?? Number(metadata.totalCentimos ?? 0),

    // Cliente
    correo: metadata.correo ?? detalles.email ?? objeto.customer_email ?? '',
    nombre: nombreCliente,
    telefono,

    // Entrega
    tipoEntrega,
    recogida: tipoEntrega === 'recogida',
    domicilio: tipoEntrega === 'domicilio',
    direccion: direccionCompleta,
    direccionDetalle: direccion,
    modoRecogida:
      metadata.modoRecogida ?? (tipoEntrega === 'recogida' ? 'recogida' : 'domicilio'),
    mesa: metadata.mesa ?? '',

    // Dinero
    // El total sale de Stripe; si no viene, se usa el que se guardo en el
    // metadata al crear la sesion (para que nunca llegue 0 a n8n).
    total: objeto.amount_total
      ? (objeto.amount_total / 100).toFixed(2)
      : (metadata.total ?? ''),
    totalCentimos: objeto.amount_total ?? Number(metadata.totalCentimos ?? 0),
    numArticulos: Number(metadata.numArticulos ?? articulos.length ?? 0),
    moneda: objeto.currency ?? 'eur',
    subtotal: objeto.amount_subtotal ? (objeto.amount_subtotal / 100).toFixed(2) : '',
    impuestos: objeto.total_tax_amounts?.length
      ? (objeto.total_tax_amounts[0].amount / 100).toFixed(2)
      : '0.00',
    metodoPago: objeto.payment_method_types?.[0] ?? '',

    // Artículos

    // Contexto
    urlOrigen: metadata.urlOrigen ?? '',
    restaurante: 'Las Mesas · Café & Bar',
    telefonoRestaurante: '+34 928 896 097',
    whatsappRestaurante: '346010000000',
  };

  // Si el pedido se creo en Supabase desde /api/checkout, se marca como pagado
  // para que el panel de administracion lo muestre pendiente de confirmar.
  await marcarPagado(
    String(metadata.pedido_id ?? ''),
    objeto.payment_intent ?? null,
  );

  info('[webhook] Reenviando pedido a n8n', {
    destino,
    idPedido: pedido.idPedido,
  });

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
