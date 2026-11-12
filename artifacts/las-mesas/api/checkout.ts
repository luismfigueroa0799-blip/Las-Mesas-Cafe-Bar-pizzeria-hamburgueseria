// Creación de la sesión de pago de Stripe (API REST, sin dependencias extra).
//
// Variables de entorno: STRIPE_SECRET_KEY y NEXT_PUBLIC_URL.
//
// Los datos del cliente (nombre, teléfono y dirección) se recogen en el carrito
// y se usan para:
//   1. Crear un Customer de Stripe con los datos ya rellenados, de modo que la
//      página de pago de Stripe los muestre pre-rellenados (el cliente no repite).
//   2. Guardarlos en `metadata` de la sesión, para que el webhook los envíe a n8n.
//
// IMPORTANTE: las serverless functions de Vercel usan el estilo Node
// (req, res). Si se devuelve un objeto Response en vez de llamar a res.end(),
// la petición nunca se completa y el cliente se queda esperando.
//
// Tipos globales mínimos para que este archivo compile con cualquier tsconfig
// (sin depender de "lib": ["dom"] ni de @types/node).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

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

interface ItemCarrito {
  id: string;
  name: string;
  price: string;
  quantity: number;
}

interface Direccion {
  calle?: string;
  numero?: string;
  piso?: string;
  codigoPostal?: string;
  ciudad?: string;
}

const STRIPE_API = 'https://api.stripe.com/v1';

// Margen de ejecución de la función (Vercel limita por defecto a 10 s en el
// plan Hobby y a 15 s en Pro). Subimos a 30 s para dar margen a las dos
// llamadas a Stripe (crear customer + crear sesión).
export const maxDuration = 30;


function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

/**
 * Convierte un precio en formato español ("9,50 €", "12,00") a céntimos.
 * NO se usa parseFloat porque se detiene en la coma y descartaría los céntimos:
 * parseFloat("9,50 €") devuelve 9 en lugar de 9.50.
 */
function aCentavos(precio: string | number): number {
  if (typeof precio === 'number') {
    return Number.isFinite(precio) ? Math.round(precio * 100) : 0;
  }

  const texto = String(precio).trim();
  if (!texto) return 0;

  const limpio = texto.replace(/[^\d,.-]/g, '');
  if (!limpio) return 0;

  const puntos = limpio.split('.').length - 1;
  let normalizado: string;
  if (limpio.includes(',')) {
    // Formato español: "1.234,56" -> "1234.56"
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else if (puntos > 1) {
    // Separador de miles: "1.234" -> "1234"
    normalizado = limpio.replace(/\./g, '');
  } else {
    normalizado = limpio;
  }

  const valor = parseFloat(normalizado);
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
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

/** Envía la respuesta y cierra la petición. */
/**
 * Genera un codigo de pedido tipo "PED-13J9" (4 caracteres alfanumericos).
/**
 * Si se activa, la web inserta el pedido en la tabla `pedidos` de Supabase
 * antes de abrir la pasarela de Stripe.
 *
 * Por defecto esta DESACTIVADA: el flujo de n8n ya tiene su propia clave de
 * servicio y su nodo "Insert rows in a table", asi que insertar aqui podria
 * duplicar el pedido. Activalo solo si en n8n se desactiva ese nodo.
 */
const CREAR_PEDIDO_EN_SUPABASE = false;

/** Configuracion de Supabase (solo si hay clave de servicio). */
function configSupabase(): { url: string; key: string } | null {
  const env = entorno();
  const url = (env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  // La clave de servicio nueva se llama SUPABASE_SECRET_KEY; se acepta
  // tambien el nombre antiguo por compatibilidad.
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return { url, key };
}

/** ¿Se puede escribir en Supabase? */
function supabaseDisponible(): boolean {
  return configSupabase() !== null;
}

/** Genera un UUID v4 (el id de la tabla pedidos es de tipo uuid). */
function generarUuid(): string {
  const c = g.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return ` ${hex.slice(0, 8)}---- `;
}

/** Peticion a la API REST de Supabase. */
async function peticionSupabase(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<{ ok: boolean; status: number; datos: any }> {
  const cfg = configSupabase();
  if (!cfg) return { ok: false, status: 0, datos: null };
  try {
    const respuesta = await g.fetch(` ${cfg.url}/rest/v1/${ruta} `, {
      method: metodo,
      headers: {
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await respuesta.text();
    let datos: any = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = texto;
    }
    return { ok: respuesta.ok, status: respuesta.status, datos };
  } catch (error) {
    log('[supabase] error:', error);
    return { ok: false, status: 0, datos: null };
  }
}

/** Inserta el pedido en la tabla pedidos de Supabase. */
async function crearPedido(pedido: {
  id: string;
  mesa_id: number | null;
  tipo: 'mesa' | 'domicilio';
  items: Array<{ id: string; nombre: string; unit: number; qty: number; subtotal: number }>;
  total: number;
  estado: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  direccion: string | null;
}): Promise<string | null> {
  if (!supabaseDisponible()) return null;
  const resultado = await peticionSupabase('pedidos', 'POST', pedido);
  if (!resultado.ok) {
    log('[supabase] no se pudo crear el pedido:', resultado.datos);
    return null;
  }
  return pedido.id;
}

/** Enlaza la sesion de Stripe con el pedido. */
async function guardarSessionId(pedidoId: string, sessionId: string): Promise<void> {
  if (!supabaseDisponible()) return;
  await peticionSupabase('pedidos?id=eq.' + pedidoId, 'PATCH', {
    stripe_session_id: sessionId,
  });
}

/**
 * El flujo de n8n lo usa como "Codigo" en el mensaje de Telegram.
 */
function generarCodigoPedido(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 4; i += 1) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return `PED-${codigo}`;
}

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

/** Junta los datos de dirección en una línea legible. */
function direccionLegible(d: Direccion): string {
  const partes = [
    d.calle,
    d.numero ? `nº ${d.numero}` : '',
    d.piso ? d.piso : '',
    d.codigoPostal,
    d.ciudad,
  ].filter(Boolean);
  return partes.join(', ');
}

/** Lee el cuerpo de la petición (Vercel ya lo parsea si es JSON). */
function leerCuerpo(req: Req): any {
  const body = req.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body ?? null;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const inicio = Date.now();

  info('[checkout] Petición recibida', {
    metodo: req?.method,
    url: req?.url,
  });

  if (req?.method && req.method !== 'POST') {
    log('[checkout] Método no permitido:', req?.method);
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey) {
    log('[checkout] Falta STRIPE_SECRET_KEY en el servidor');
    responder(res, { error: 'Falta STRIPE_SECRET_KEY en el servidor' }, 500);
    return;
  }

  const body = leerCuerpo(req) as {
    items?: ItemCarrito[];
    customerEmail?: string;
    customerName?: string;
    telefono?: string;
    tipoEntrega?: string;
    direccion?: Direccion;
    mesa?: string;
    urlOrigen?: string;
  } | null;

  if (!body) {
    log('[checkout] Cuerpo no válido');
    responder(res, { error: 'Cuerpo de la petición no válido' }, 400);
    return;
  }

  info('[checkout] Cuerpo recibido', {
    items: body.items,
    customerEmail: body.customerEmail,
    customerName: body.customerName,
    telefono: body.telefono,
    tipoEntrega: body.tipoEntrega,
    direccion: body.direccion,
    mesa: body.mesa,
  });

  const items = (body.items ?? []).filter(
    (item) => item && item.quantity > 0 && aCentavos(item.price) > 0,
  );
  if (!items.length) {
    log('[checkout] Carrito vacío o precios no válidos');
    responder(res, { error: 'El carrito está vacío' }, 400);
    return;
  }

  info('[checkout] Precios convertidos a céntimos', {
    totalCentimos: items.reduce((sum, i) => sum + aCentavos(i.price) * i.quantity, 0),
    detalle: items.map((i) => ({
      nombre: i.name,
      precio: i.price,
      centimos: aCentavos(i.price),
      cantidad: i.quantity,
    })),
  });

  // Total en centimos que se enviara a Stripe y que viajara en el metadata,
  // para que el webhook de n8n lo reciba aunque Stripe no devuelva el importe.
  const totalCentimos = items.reduce((sum, i) => sum + aCentavos(i.price) * i.quantity, 0);
  if (totalCentimos <= 0) {
    log('[checkout] El total es 0: no se puede crear la sesion');
    responder(res, { error: 'El carrito no tiene importe' }, 400);
    return;
  }

  const email = String(body.customerEmail ?? '').trim();
  const nombre = String(body.customerName ?? '').trim();
  const telefonoOriginal = String(body.telefono ?? '').trim();
  const tipoEntrega = body.tipoEntrega === 'domicilio' ? 'domicilio' : 'recogida';
  const direccion = body.direccion ?? {};
  const mesa = String(body.mesa ?? '').trim();
  const direccionCompleta = direccionLegible(direccion);

  if (!email) {
    responder(res, { error: 'Falta el correo electrónico del cliente' }, 400);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    responder(res, { error: 'El correo electrónico no es válido' }, 400);
    return;
  }
  if (!nombre) {
    responder(res, { error: 'Falta el nombre del cliente' }, 400);
    return;
  }
  // El teléfono es opcional: solo se rechaza si viene escrito y es inválido.
  // Se valida el texto ORIGINAL (antes de normalizar) para no descartar en
  // silencio lo que la persona haya escrito.
  if (telefonoOriginal && !/^\+?[\d\s.-]{9,20}$/.test(telefonoOriginal)) {
    responder(res, { error: 'El teléfono no es válido' }, 400);
    return;
  }
  const telefono = normalizarTelefono(telefonoOriginal);
  if (tipoEntrega === 'domicilio' && !direccionCompleta) {
    responder(res, { error: 'Falta la dirección de entrega' }, 400);
    return;
  }
  // Para reparto a domicilio el telefono es obligatorio: sin el no se puede
  // preparar el pedido ni avisar al cliente.
  if (tipoEntrega === 'domicilio' && !telefono) {
    responder(res, { error: 'Para entrega a domicilio hace falta el teléfono' }, 400);
    return;
  }

  const headers = req?.headers;
  const host = headers?.get?.('host') ?? 'lasmesasbarcafet.com';
  const baseUrl = entorno().NEXT_PUBLIC_URL || ('https://' + host);

  const URLSearchParamsCtor = g.URLSearchParams;

  // ------------------------------------------------------------------
  // Identificadores del pedido.
  // El id de la tabla pedidos es de tipo uuid, asi que pedido_id debe ser
  // un uuid. El codigo legible 'PED-XXXX' va aparte, en codigo.
  const codigoPedido = generarCodigoPedido();
  const pedidoId = generarUuid();
  const tipoPedido = mesa ? 'mesa' : tipoEntrega === 'domicilio' ? 'domicilio' : 'recogida';
  const telefonoCliente = telefono || 'Sin telefono';
  // ------------------------------------------------------------------
  // 2. Crear el pedido en Supabase (tabla pedidos).
  //    El flujo de n8n lo lee para enviar el Telegram con el detalle y
  //    el total reales. Si Supabase no esta configurado, lo crea n8n.
  // ------------------------------------------------------------------
  if (CREAR_PEDIDO_EN_SUPABASE && supabaseDisponible()) {
    const lineasPedido = items.map((i) => ({
      id: i.id,
      nombre: i.name,
      unit: aCentavos(i.price) / 100,
      qty: i.quantity,
      subtotal: (aCentavos(i.price) * i.quantity) / 100,
    }));

    await crearPedido({
      id: pedidoId,
      mesa_id: mesa ? Number(mesa) : null,
      tipo: tipoPedido === 'mesa' ? 'mesa' : 'domicilio',
      items: lineasPedido,
      total: totalCentimos / 100,
      estado: 'pendiente_pago',
      cliente_nombre: nombre,
      cliente_telefono: telefonoCliente,
      direccion: tipoEntrega === 'domicilio' ? direccionCompleta : 'Recogida en el local',
    });
  }

  // ------------------------------------------------------------------
  // 3. Sesión de checkout.
  // ------------------------------------------------------------------
  const params = new URLSearchParamsCtor();
  params.set('mode', 'payment');
  params.set('success_url', `${baseUrl}/?pedido=ok&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${baseUrl}/?pedido=cancelado#carta`);

  // El email se pasa con customer_email: asi Stripe lo guarda en la sesion
  // (customer_details.email y customer_email), cosa que con "customer" no
  // ocurria. El nombre no lo pre-rellena Stripe, asi que viaja en el
  // metadata, que es de donde lo lee el flujo de n8n.
  params.set('customer_email', email);
  params.set('customer_creation', 'always');
  if (telefono) {
    params.set('phone_number_collection[enabled]', 'true');
  }

  // Recogida en local: no hace falta dirección de envío.
  // Envío a domicilio: Stripe muestra el formulario nativo de dirección,
  // pre-rellenado con los datos del customer.
  if (tipoEntrega === 'domicilio') {
    params.set('shipping_address_collection[allowed_countries][0]', 'ES');
  }

  // Metadata: viaja al webhook para llegar a n8n.
  // ── Metadata para el flujo de n8n ──────────────────────────────────────
  // El flujo de la app de hamburgueseria lee estos nombres concretos del
  // metadata de la sesion de Stripe. Se ponen TODOS los alias posibles para
  // que funcione aunque el flujo use uno u otro.
  // El id de la tabla `pedidos` es de tipo uuid, asi que pedido_id debe ser un
  // Identificadores del pedido.

  params.set('metadata[pedido_id]', pedidoId);
  params.set('metadata[pedido_codigo]', pedidoId);
  params.set('metadata[codigo_pedido]', codigoPedido);
  params.set('metadata[codigo]', codigoPedido);
  params.set('metadata[tipo]', tipoPedido);
  params.set('metadata[mesa_id]', mesa);
  params.set('metadata[mesa]', mesa);

  params.set('metadata[cliente_nombre]', nombre);
  params.set('metadata[nombre]', nombre);
  params.set('metadata[cliente_telefono]', telefonoCliente);
  params.set('metadata[telefono]', telefonoCliente);
  params.set('metadata[cliente_direccion]', direccionCompleta);
  params.set('metadata[direccion]', direccionCompleta);
  params.set('metadata[cliente_correo]', email);
  params.set('metadata[correo]', email);
  params.set('metadata[email]', email);

  params.set('metadata[total]', (totalCentimos / 100).toFixed(2));
  params.set('metadata[totalCentimos]', String(totalCentimos));
  params.set('metadata[numArticulos]', String(items.reduce((s, i) => s + i.quantity, 0)));
  params.set('metadata[correo]', email);
  params.set('metadata[tipoEntrega]', tipoEntrega);
  params.set('metadata[recogida]', tipoEntrega === 'recogida' ? 'true' : 'false');
  params.set('metadata[domicilio]', tipoEntrega === 'domicilio' ? 'true' : 'false');
  params.set('metadata[direccion]', direccionCompleta);
  params.set('metadata[calle]', direccion.calle ?? '');
  params.set('metadata[numero]', direccion.numero ?? '');
  params.set('metadata[piso]', direccion.piso ?? '');
  params.set('metadata[codigoPostal]', direccion.codigoPostal ?? '');
  params.set('metadata[ciudad]', direccion.ciudad ?? '');
  params.set('metadata[modoRecogida]', mesa ? 'mesa' : tipoEntrega);
  if (mesa) params.set('metadata[mesa]', mesa);
  if (body.urlOrigen) params.set('metadata[urlOrigen]', body.urlOrigen);
  // Lineas de pedido con todos los alias: {id, nombre, name, cantidad, qty, precio, price}
  const lineas = items.map((i) => ({
    id: i.id,
    nombre: i.name,
    name: i.name,
    cantidad: i.quantity,
    qty: i.quantity,
    precio: i.price,
    price: i.price,
    unit_cents: aCentavos(i.price),
    subtotal_cents: aCentavos(i.price) * i.quantity,
  }));
  params.set('metadata[items]', JSON.stringify(lineas));
  params.set('metadata[articulos]', JSON.stringify(lineas));
  params.set('metadata[detalle]', JSON.stringify(lineas));

  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'eur');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(aCentavos(item.price)));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  info('[checkout] Parámetros enviados a Stripe', {
    modo: params.get('mode'),
    lineItems: items.length,
    tipoEntrega,
    shippingAddress: tipoEntrega === 'domicilio',
    totalCentimos: items.reduce((sum, i) => sum + aCentavos(i.price) * i.quantity, 0),
  });

  try {
    const respuesta = await g.fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const datos: any = await respuesta.json();
    if (!respuesta.ok) {
      log('[checkout] Stripe rechazó la sesión', {
        status: respuesta.status,
        error: datos?.error,
        ms: Date.now() - inicio,
      });
      responder(
        res,
        { error: datos?.error?.message ?? 'Stripe rechazó la sesión' },
        502,
      );
      return;
    }

    // Enlazar la sesion de Stripe con el pedido en Supabase.
    if (supabaseDisponible()) {
      await guardarSessionId(pedidoId, datos.id);
    }

    info('[checkout] Sesión creada correctamente', {
      sessionId: datos.id,
      url: datos.url,
      ms: Date.now() - inicio,
    });

    responder(res, {
      sessionId: datos.id,
      url: datos.url,
      // Resumen de lo que se ha cobrado: util para comprobar en el navegador.
      total: (totalCentimos / 100).toFixed(2),
      totalCentimos,
      pedido_id: pedidoId,
      codigo_pedido: codigoPedido,
      articulos: items.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.quantity,
        price: i.price,
      })),
    });
  } catch (error) {
    log('[checkout] Error contacting Stripe', error);
    responder(res, { error: 'No se pudo contactar con Stripe' }, 500);
  }
}
