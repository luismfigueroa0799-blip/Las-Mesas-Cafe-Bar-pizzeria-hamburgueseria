// Creación de la sesión de pago.
//
// El flujo es el mismo que usa la app de hamburguesería/pizzería:
//
//   1. Esta API valida los datos y los envia al webhook de n8n
//      (crear-pedido-domicilio), que es quien:
//        - comprueba el horario de atencion,
//        - recalcula los precios contra la tabla `productos` de Supabase
//          (el cliente nunca envia precios),
//        - inserta el pedido en la tabla `pedidos`,
//        - crea la sesion de Stripe con su metadata
//          (pedido_id, cliente_nombre, cliente_telefono, direccion, ...)
//        - y devuelve { ok, pedido_id, total_cents, checkout_url }.
//
//   2. El navegador redirige al checkout_url.
//
//   3. Cuando el cliente paga, Stripe avisa a n8n (trigger "Pago completado
//      en Stripe"), que ya encuentra el pedido en la tabla `pedidos` y
//      notifica por Telegram y email.
//
// Delegar en n8n tiene una ventaja clave: el metadata de Stripe lo genera el
// propio flujo, sin el limite de 500 caracteres por valor que impose Stripe.
//
// Variables de entorno:
//   N8N_WEBHOOK_URL       → webhook de n8n que crea el pedido
//   N8N_WEBHOOK_URL_TEST  → opcional, para pruebas
//
// IMPORTANTE: las serverless functions de Vercel usan el estilo Node (req, res).
// Si se devuelve un objeto Response en vez de llamar a res.end(), la peticion
// nunca se completa.
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
  name?: string;
  price?: string;
  quantity: number;
}

interface Direccion {
  calle?: string;
  numero?: string;
  piso?: string;
  codigoPostal?: string;
  ciudad?: string;
}

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

// ── Configuracion comun (inline: Vercel no empaqueta imports fuera de api/) ──

/** Webhook de n8n que crea el pedido y devuelve la url de la pasarela de Stripe. */
const N8N_WEBHOOK_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';
/** Version de pruebas (solo responde una llamada tras "Execute workflow"). */
const N8N_WEBHOOK_TEST_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook-test/crear-pedido-domicilio';
/** Proyecto de Supabase (misma base de datos que usa el flujo de n8n). */
const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

/** Una URL es valida si es http(s) y no contiene un placeholder sin cambiar. */
function esUrlValida(valor: string | undefined): boolean {
  const texto = String(valor ?? '').trim();
  if (!texto) return false;
  if (texto.includes('<') || texto.includes('>')) return false;
  if (texto.includes('cambiar') || texto.includes('PEGAR_AQUI')) return false;
  return /^https?:\/\/[^\s]+$/.test(texto);
}

/** URL del webhook de n8n (la del entorno si es valida, si no la de por defecto). */
function urlWebhookN8n(produccion = true): string {
  const env = entorno();
  const configurada = (produccion ? env.N8N_WEBHOOK_URL : env.N8N_WEBHOOK_URL_TEST) ?? '';
  if (esUrlValida(configurada)) return configurada.trim().replace(/\/+$/, '');
  return (produccion ? N8N_WEBHOOK_POR_DEFECTO : N8N_WEBHOOK_TEST_POR_DEFECTO).replace(
    /\/+$/,
    '',
  );
}

/** URL de Supabase (la del entorno si es valida, si no la de por defecto). */
function urlSupabase(): string {
  const configurada = entorno().SUPABASE_URL ?? '';
  if (esUrlValida(configurada)) return configurada.trim().replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO.replace(/\/+$/, '');
}

/** Clave de servicio de Supabase (necesaria para escribir en la tabla pedidos). */
function claveSupabase(): string {
  const env = entorno();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

/** Configuracion de Supabase para la API REST, o null si no hay clave. */
function configSupabase(): { url: string; key: string } | null {
  const key = claveSupabase();
  if (!key) return null;
  return { url: urlSupabase(), key };
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

/** Quita barras finales y espacios para poder concatenar rutas sin duplicar. */
function limpiarUrl(url: string): string {
  return String(url).trim().replace(/\/+$/, '');
}

/**
 * Convierte un precio en formato español ("9,50 €", "12,00") a céntimos.
 * Solo se usa para comprobar que el total que nos da el cliente cuadra con el
 * que devuelve n8n; el precio que se cobra es el de la base de datos.
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
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else if (puntos > 1) {
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
  if (digitos.length === 9) return '34' + digitos;
  if (digitos.length === 10 && digitos.startsWith('6')) return '34' + digitos;
  if (digitos.length === 11 && digitos.startsWith('34')) return digitos;
  return digitos;
}

/** Quita el prefijo /public o /assets si viniera. */
function idNumerico(id: string | number): number | null {
  const texto = String(id ?? '').trim();
  if (!texto) return null;
  if (/^\d+$/.test(texto)) return Number(texto);
  // Acepta ids tipo "productos/12" o "12".
  const soloNumero = texto.split('/').pop() ?? texto;
  return /^\d+$/.test(soloNumero) ? Number(soloNumero) : null;
}

/**
 * Resuelve los ids de los articulos contra la tabla `productos`.
 *
 * Si el articulo llega con un id numerico se usa tal cual. Si no (por ejemplo
 * un carrito guardado en el navegador con una version antigua de la carta), se
 * busca por nombre en la base de datos. Asi el pedido se crea igual.
 */
async function resolverIds(
  items: Array<{ id: string; nombre?: string; qty: number }>,
): Promise<Array<{ id: number; qty: number }> | null> {
  const resueltos: Array<{ id: number; qty: number }> = [];
  const porNombre: string[] = [];

  for (const item of items) {
    const id = idNumerico(item?.id ?? '');
    if (id !== null) {
      resueltos.push({ id, qty: Math.floor(Number(item.qty) || 1) });
    } else if (item?.nombre) {
      porNombre.push(item.nombre);
    } else {
      return null;
    }
  }

  if (!porNombre.length) return resueltos;

  const cfg = configSupabase();
  if (!cfg) return null;

  try {
    const lista = porNombre.map((n) => '"' + n.replace(/"/g, '') + '"').join(',');
    const r = await g.fetch(
      cfg.url + '/rest/v1/productos?select=id,nombre&nombre=in.(' + lista + ')',
      {
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) return null;
    const filas: any[] = await r.json();
    const porNombreId = new Map<string, number>();
    for (const fila of filas) porNombreId.set(String(fila.nombre), Number(fila.id));

    for (const item of items) {
      if (idNumerico(item?.id ?? '') !== null) continue;
      const encontrado = porNombreId.get(String(item.nombre));
      if (!encontrado) return null;
      resueltos.push({ id: encontrado, qty: Math.floor(Number(item.qty) || 1) });
    }

    return resueltos;
  } catch (error) {
    log('[checkout] no se pudieron resolver los ids por nombre:', error);
    return null;
  }
}

/**
 * Extrae el id de sesion de la url de checkout de Stripe.
 * Ejemplo: https://checkout.stripe.com/c/pay/cs_test_abc123 -> cs_test_abc123
 */
function idSesionDeUrl(url: string): string {
  const coincidencia = /(cs_[a-zA-Z0-9_]+)/.exec(String(url ?? ''));
  return coincidencia ? coincidencia[1] : '';
}

/**
 * Consulta la sesion en Stripe para quedarse con su payment_intent.
 *
 * Es importante: el trigger "Pago completado en Stripe" de n8n localiza el
 * pedido en la tabla `pedidos` por `payment_intent` (columna
 * stripe_payment_intent). Si no lo rellenamos, el flujo no encuentra el pedido
 * y notifica con los datos vacios.
 */
async function obtenerPaymentIntent(sessionId: string): Promise<string> {
  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey || !sessionId) return '';
  try {
    const r = await g.fetch(
      'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
      { headers: { Authorization: 'Bearer ' + secretKey } },
    );
    if (!r.ok) return '';
    const datos: any = await r.json();
    return String(datos?.payment_intent ?? '');
  } catch (error) {
    log('[checkout] no se pudo consultar la sesion de Stripe:', error);
    return '';
  }
}

/**
 * Genera el codigo de pedido ("PED-4K7X") que se envia a n8n.
 */
function generarCodigoPedido(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 4; i += 1) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return 'PED-' + codigo;
}

/**
 * Devuelve el nombre y el precio (en euros) de los productos indicados.
 *
 * Los precios se sacan de la tabla `productos` (la misma que usa n8n) para
 * que el detalle del pedido que se envia a n8n lleve los importes reales y no
 * los que digita el navegador.
 */
async function catalogoProductos(
  ids: number[],
): Promise<Map<number, { nombre: string; precio: number }>> {
  const mapa = new Map<number, { nombre: string; precio: number }>();
  const cfg = configSupabase();
  if (!cfg || !ids.length) return mapa;
  try {
    const r = await g.fetch(
      cfg.url + '/rest/v1/productos?select=id,nombre,precio&id=in.(' + ids.join(',') + ')',
      {
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) return mapa;
    const filas: any[] = await r.json();
    for (const fila of filas) {
      mapa.set(Number(fila.id), {
        nombre: String(fila.nombre ?? ''),
        precio: Number(fila.precio ?? 0),
      });
    }
  } catch (error) {
    log('[checkout] no se pudo leer el catalogo de productos:', error);
  }
  return mapa;
}

/**
 * Convierte las lineas del pedido en el texto JSON que se guarda en el
 * metadata de Stripe. Stripe admite 500 caracteres por valor, asi que si el
 * detalle no cabe se van quitando articulos del final.
 */
function itemsParaMetadata(
  lineas: Array<{ nombre: string; cantidad: number; precio: number }>,
): string {
  const simples = lineas.map((l) => ({
    nombre: l.nombre,
    cantidad: l.cantidad,
    precio: l.precio,
  }));
  let json = JSON.stringify(simples);
  if (json.length <= 500) return json;
  for (let n = simples.length - 1; n >= 1; n -= 1) {
    json = JSON.stringify(simples.slice(0, n));
    if (json.length <= 500) return json;
  }
  return JSON.stringify([simples[0] ?? { nombre: '', cantidad: 1, precio: 0 }]).slice(0, 500);
}

/**
 * Añade los parametros de un objeto al cuerpo de la peticion a Stripe, que
 * los espera en formato formulario (`a[b][c]=valor`).
 */
function anadirParametros(destino: string[], prefijo: string, valor: unknown): void {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => anadirParametros(destino, prefijo + '[' + i + ']', v));
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      anadirParametros(destino, prefijo + '[' + clave + ']', v);
    }
    return;
  }
  if (valor === undefined || valor === null) return;
  destino.push(prefijo + '=' + encodeURIComponent(String(valor)));
}

/**
 * Crea una sesion de pago de Stripe con las urls de retorno de nuestra web.
 *
 * El flujo de n8n deja las suyas fijas (example.com) y Stripe no deja
 * cambiarlas despues de crear la sesion, asi que se crea una sesion propia
 * con los mismos articulos, las urls correctas y el pedido plano en el
 * metadata (asi lo leen tanto el trigger de Stripe de n8n como nuestra
 * pagina de confirmacion).
 *
 * Si algo falla se devuelve null y se sigue usando la sesion de n8n, que
 * siempre funciona.
 */
async function crearSesionStripePropia(
  lineas: Array<{ nombre: string; cantidad: number; precio: number }>,
  metadata: Record<string, string>,
  urlExito: string,
  urlCancelacion: string,
): Promise<{ id: string; url: string } | null> {
  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey || !lineas.length) return null;

  try {
    const partes: string[] = [];
    anadirParametros(partes, 'mode', 'payment');
    anadirParametros(
      partes,
      'line_items',
      lineas.map((l) => ({
        quantity: l.cantidad,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(l.precio * 100),
          product_data: { name: l.nombre || 'Articulo' },
        },
      })),
    );
    anadirParametros(partes, 'success_url', urlExito);
    anadirParametros(partes, 'cancel_url', urlCancelacion);
    anadirParametros(partes, 'metadata', metadata);
    // El payment_intent lleva los mismos datos: algunos flujos de n8n los
    // leen de ahi en vez de desde la sesion.
    anadirParametros(partes, 'payment_intent_data', { metadata });
    if (metadata.pedido_id) anadirParametros(partes, 'client_reference_id', metadata.pedido_id);

    const r = await g.fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: partes.join('&'),
    });

    const texto = await r.text();
    if (!r.ok) {
      log('[checkout] Stripe no acepto la sesion propia:', r.status, texto.slice(0, 300));
      return null;
    }
    const datos: any = JSON.parse(texto);
    const url = String(datos?.url ?? '');
    if (!url) return null;
    return { id: String(datos?.id ?? ''), url };
  } catch (error) {
    log('[checkout] no se pudo crear la sesion propia de Stripe:', error);
    return null;
  }
}

/**
 * Rellena el metadata de la sesion de Stripe con los datos del pedido y
 * corrige las urls de retorno.
 *
 * El flujo de n8n que avisa del pago (trigger de Stripe) lee los datos del
 * evento: si el metadata no los lleva, el mensaje sale con "Cliente",
 * "Sin telefono" y "0 EUR". Se lee primero la sesion para no perder el
 * metadata que puso el flujo de n8n al crearla.
 *
 * Ademas se cambian las urls de exito y de cancelacion: el flujo de n8n deja
 * las de ejemplo (example.com), y el cliente tiene que volver a la web para
 * ver la confirmacion y que se vacie el carrito.
 *
 * OJO: Stripe NO deja cambiar `success_url` ni `cancel_url` una vez creada la
 * sesion (responde "Received unknown parameters"), asi que las urls se le
 * piden al flujo de n8n al crear el pedido.
 */
async function actualizarMetadataStripe(
  sessionId: string,
  campos: Record<string, string>,
): Promise<boolean> {
  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey || !sessionId) return false;
  try {
    const lectura = await g.fetch(
      'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
      { headers: { Authorization: 'Bearer ' + secretKey } },
    );
    let previo: Record<string, string> = {};
    if (lectura.ok) {
      const datos: any = await lectura.json();
      previo = (datos?.metadata ?? {}) as Record<string, string>;
    }

    const unido: Record<string, string> = { ...previo };
    for (const [clave, valor] of Object.entries(campos)) {
      unido[clave] = String(valor ?? '').slice(0, 500);
    }

    // Stripe espera los parametros en formato formulario: metadata[clave]=valor
    const cuerpo = Object.keys(unido)
      .map((clave) => 'metadata[' + clave + ']=' + encodeURIComponent(unido[clave]))
      .join('&');

    const escritura = await g.fetch(
      'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + secretKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: cuerpo,
      },
    );
    if (!escritura.ok) {
      const texto = await escritura.text();
      log(
        '[checkout] Stripe no acepto el metadata de la sesion:',
        escritura.status,
        texto.slice(0, 300),
      );
      return false;
    }
    return true;
  } catch (error) {
    log('[checkout] no se pudo actualizar el metadata de la sesion:', error);
    return false;
  }
}

/**
 * Url base de la web (la misma que esta viendo el cliente) para construir las
 * urls de exito y de cancelacion de Stripe.
 */
function urlBaseDeLaPeticion(req: Req): string {
  const cabeceras = req?.headers;
  const host = String(
    cabeceras?.get?.('x-forwarded-host') ?? cabeceras?.get?.('host') ?? '',
  ).split(',')[0].trim();
  // Solo se usa si parece un nombre de dominio de verdad.
  if (host && host.includes('.') && !host.includes(' ')) {
    const proto = cabeceras?.get?.('x-forwarded-proto') ?? 'https';
    return proto + '://' + host.replace(/:\d+$/, '');
  }
  const env = entorno();
  const configurada = String(env.NEXT_PUBLIC_URL ?? env.PUBLIC_URL ?? '').trim();
  if (esUrlValida(configurada)) return configurada.replace(/\/+$/, '');
  return 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria.vercel.app';
}

/** Lee el cuerpo de la petición. */
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

/**
 * Actualiza el pedido en la tabla `pedidos` de Supabase.
 *
 * El flujo de n8n valida el campo `nombre` del webhook, pero NO lo copia a la
 * columna `cliente_nombre` (queda a null). Como el trigger "Pago completado en
 * Stripe" lee de ahi, el mensaje de Telegram salia sin el nombre del cliente.
 * Con esta actualizacion la fila ya lleva el nombre antes de que el cliente pague.
 */
/**
 * Devuelve el nombre de la columna que Supabase dice que no existe, o una
 * cadena vacia si el error es otro.
 *
 * PostgRest avisa de dos maneras distintas:
 *   PGRST204 -> "Could not find the 'x' column of 'pedidos' in the schema cache"
 *   42703    -> "column pedidos.x does not exist"
 */
function columnaInexistente(mensaje: string): string {
  const texto = String(mensaje ?? '');
  const pgrst = /Could not find the '([a-zA-Z_][a-zA-Z0-9_]*)' column/i.exec(texto);
  if (pgrst?.[1]) return pgrst[1];
  const postgres = /column (?:public\.)?(?:pedidos\.)?([a-zA-Z_][a-zA-Z0-9_]*) does not exist/i.exec(
    texto,
  );
  return postgres?.[1] ?? '';
}

async function actualizarPedido(
  pedidoId: string | number,
  campos: Record<string, unknown>,
): Promise<void> {
  // Se usa urlSupabase() / claveSupabase() para que funcione aunque las
  // variables de entorno falten o contengan placeholders.
  const cfg = configSupabase();
  if (!cfg || !pedidoId) return;

  // La tabla `pedidos` se creo sin todas las columnas (por ejemplo
  // `stripe_session_id` o `pagado_at`). Si se manda un campo que no existe,
  // Supabase rechaza el PATCH entero y el pedido se queda sin actualizar
  // (por eso el nombre del cliente se quedaba vacio). Aqui se detecta la
  // columna que falta y se reintenta sin ella.
  let pendientes: Record<string, unknown> = { ...campos };

  for (let intento = 0; intento < 5; intento += 1) {
    try {
      const r = await g.fetch(cfg.url + '/rest/v1/pedidos?id=eq.' + pedidoId, {
        method: 'PATCH',
        headers: {
          apikey: cfg.key,
          Authorization: 'Bearer ' + cfg.key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(pendientes),
      });

      if (r.ok) {
        if (intento > 0) {
          info('[checkout] Pedido actualizado omittingiendo columnas inexistentes', {
            pedido_id: pedidoId,
            descartadas: Object.keys(campos).filter((clave) => !(clave in pendientes)),
          });
        }
        return;
      }

      const texto = await r.text();
      const columna = columnaInexistente(texto);
      if (!columna || !(columna in pendientes)) {
        log('[checkout] Supabase no acepto la actualizacion:', r.status, texto.slice(0, 300));
        return;
      }
      delete pendientes[columna];
      log('[checkout] La columna "' + columna + '" no existe en la tabla pedidos: se omite.');
    } catch (error) {
      log('[checkout] no se pudo actualizar el pedido:', error);
      return;
    }
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req?.method && req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const env = entorno();
  // Si la variable no esta puesta o es un placeholder, se usa la de por defecto.
  const webhook = urlWebhookN8n(true);
  if (!webhook) {
    log('[checkout] N8N_WEBHOOK_URL no esta configurada');
    responder(res, { error: 'El pago online no está configurado todavía' }, 503);
    return;
  }

  const body = leerCuerpo(req) as {
    items?: ItemCarrito[];
    customerEmail?: string;
    customerName?: string;
    telefono?: string;
    tipoEntrega?: string;
    total?: string | number;
    direccion?: Direccion;
    mesa?: string;
    urlOrigen?: string;
  } | null;

  if (!body) {
    responder(res, { error: 'Cuerpo de la petición no válido' }, 400);
    return;
  }

  const nombre = String(body.customerName ?? '').trim();
  const telefono = normalizarTelefono(String(body.telefono ?? '').trim());
  const email = String(body.customerEmail ?? '').trim();
  const mesa = String(body.mesa ?? '').trim();
  const tipoEntrega = body.tipoEntrega === 'domicilio' ? 'domicilio' : 'recogida';

  if (!nombre) {
    responder(res, { error: 'Falta el nombre del cliente' }, 400);
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    responder(res, { error: 'El correo electrónico no es válido' }, 400);
    return;
  }

  const direccion = body.direccion ?? {};
  const partesDireccion = [
    direccion.calle,
    direccion.numero,
    direccion.piso,
    direccion.codigoPostal,
    direccion.ciudad,
  ]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  const direccionCompleta = partesDireccion.join(', ');

  if (tipoEntrega === 'domicilio') {
    if (!direccionCompleta) {
      responder(res, { error: 'Falta la dirección de entrega' }, 400);
      return;
    }
    if (!telefono) {
      responder(res, { error: 'Para entrega a domicilio hace falta el teléfono' }, 400);
      return;
    }
  }

  // El id de cada articulo es el de la tabla `productos` de Supabase.
  // n8n los usa para recalcular los precios.
  const crudos = (body.items ?? []).filter(
    (item) => item && Number(item.quantity) > 0,
  );
  if (!crudos.length) {
    responder(res, { error: 'El carrito está vacío' }, 400);
    return;
  }

  const items = await resolverIds(
    crudos.map((item) => ({
      id: String(item.id ?? ''),
      nombre: item.name,
      qty: Number(item.quantity),
    })),
  );
  if (!items) {
    responder(res, { error: 'El carrito tiene artículos no válidos' }, 400);
    return;
  }

  // Total que declara el cliente: solo para compararlo con el de n8n.
  const totalDeclarado = (body.items ?? []).reduce(
    (suma, item) => suma + aCentavos(item.price ?? '') * (Number(item.quantity) || 0),
    0,
  );

  // Total que el navegador ya habia calculado antes de hacer la peticion. Si
  // no cuadra con la carta, se avisa en el log (el que cobra siempre es el
  // precio de la tabla `productos`).
  if (body.total !== undefined && body.total !== '') {
    const totalDelNavegador = aCentavos(body.total);
    if (Math.abs(totalDelNavegador - totalDeclarado) > 1) {
      log('[checkout] El total del navegador no cuadra con los precios de la carta', {
        total_navegador: totalDelNavegador,
        total_carta: totalDeclarado,
      });
    }
  }

  // Catalogo con los nombres y los precios reales de los articulos (los
  // precios de la tabla `productos`, los mismos que usa n8n para el total).
  const catalogo = await catalogoProductos(items.map((item) => item.id));

  // Precio que declara el navegador: solo se usa si el producto no esta en
  // el catalogo (si esta, manda el precio de la base de datos).
  const precioDeclarado = new Map<string, number>();
  for (const item of body.items ?? []) {
    precioDeclarado.set(String(item.id ?? ''), aCentavos(item.price ?? '') / 100);
  }

  // Lineas del pedido. Se mandan con TODOS los nombres que usa el flujo:
  //  - `id` y `qty`      -> los necesita el flujo para crear el pedido.
  //  - `nombre`, `cantidad` y `precio` -> los necesita el flujo para pintar el
  //    detalle del pedido en el mensaje de Telegram y en la tablet.
  const lineas = items.map((item) => {
    const producto = catalogo.get(item.id);
    const precio = producto?.precio ?? precioDeclarado.get(String(item.id)) ?? 0;
    const nombreProducto = producto?.nombre ?? '';
    const precioRedondeado = Math.round(precio * 100) / 100;
    return {
      id: item.id,
      qty: item.qty,
      cantidad: item.qty,
      nombre: nombreProducto,
      name: nombreProducto,
      precio: precioRedondeado,
      price: precioRedondeado,
      subtotal: Math.round(precioRedondeado * item.qty * 100) / 100,
      precio_unitario: precioRedondeado,
    };
  });

  // Total con los precios de la carta (es el que cobra n8n).
  const totalEuros =
    Math.round(lineas.reduce((suma, l) => suma + l.subtotal, 0) * 100) / 100;
  const codigoPedido = generarCodigoPedido();
  const direccionFinal = direccionCompleta || 'Recogida en el local';
  const telefonoFinal = telefono || 'Sin teléfono';

  // Urls de retorno: el flujo de n8n deja las suyas (example.com) y el
  // cliente tiene que volver a la web para ver la confirmacion y que se
  // vacie el carrito. Stripe no deja cambiarlas despues, asi que se le piden
  // aqui al crear la sesion.
  const base = urlBaseDeLaPeticion(req);
  const urlExito =
    base +
    '/?pedido=ok&codigo=' +
    encodeURIComponent(codigoPedido) +
    '&session_id={CHECKOUT_SESSION_ID}';
  const urlCancelacion = base + '/?pedido=cancelado';

  const payload = {
    // ── Formato plano que lee el flujo de n8n ──
    order_code: codigoPedido,
    cliente_nombre: nombre,
    direccion: direccionFinal,
    telefono: telefonoFinal,
    total: totalEuros,
    items: lineas,

    // ── Nombres que usa el flujo para crear el pedido ──
    nombre,
    cliente_telefono: telefonoFinal,
    cliente_direccion: direccionFinal,

    // ── Nombres del contrato anterior (para que no cambien los nodos) ──
    evento: 'pedido.creado',
    idPedido: '',
    idPago: '',
    fecha: new Date().toISOString(),
    modoPrueba: true,
    correo: email,
    tipoEntrega: tipoEntrega,
    recogida: tipoEntrega !== 'domicilio',
    domicilio: tipoEntrega === 'domicilio',
    modoRecogida: mesa ? 'mesa' : 'recogida',
    articulos: lineas.map((l) => ({
      id: l.id,
      name: l.nombre,
      qty: l.cantidad,
      price: l.precio.toFixed(2).replace('.', ',') + ' €',
    })),
    subtotal: totalEuros,
    impuestos: 0,
    metodoPago: 'card',
    urlOrigen: String(body.urlOrigen ?? ''),
    restaurante: 'Las Mesas · Café & Bar',
    telefonoRestaurante: '+34 928 896 097',
    whatsappRestaurante: '346010000000',

    // ── Campos extra por si el flujo los utilice ──
    codigo: codigoPedido,
    codigo_pedido: codigoPedido,
    email,
    cliente_email: email,
    success_url: urlExito,
    cancel_url: urlCancelacion,
    url_exito: urlExito,
    url_cancelacion: urlCancelacion,
    tipo: mesa ? 'mesa' : 'domicilio',
    modo_entrega: tipoEntrega,
    mesa: mesa || null,
    mesa_id: mesa ? Number(mesa) : null,
    modo_recogida: mesa ? 'mesa' : 'recogida',
    total_cents: Math.round(totalEuros * 100),
    total_centimos: Math.round(totalEuros * 100),
    total_texto: totalEuros.toFixed(2),
    moneda: 'eur',
  };

  info('[checkout] DATOS RECIBIDOS', {
    items: body.items,
    cliente: { nombre, email, telefono },
    tipoEntrega,
    direccion,
    mesa,
  });

  info('[checkout] Enviando pedido a n8n', {
    webhook,
    items: items.length,
    totalDeclarado,
  });

  try {
    const respuesta = await g.fetch(limpiarUrl(webhook), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const texto = await respuesta.text();
    let datos: any = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = null;
    }

    if (!respuesta.ok || !datos?.ok) {
      const mensaje =
        datos?.error ||
        datos?.motivo ||
        datos?.message ||
        `El servidor de pedidos respondió con el código ${respuesta.status}.`;
      log('[checkout] N8N RECHAZO EL PEDIDO', {
        estado: respuesta.status,
        cuerpo: texto,
        datos,
      });
      responder(res, { error: mensaje }, 400);
      return;
    }

    info('[checkout] RESPUESTA DE N8N', {
      ok: datos?.ok,
      pedido_id: datos?.pedido_id,
      total: datos?.total,
      total_cents: datos?.total_cents,
      checkout_url: datos?.checkout_url,
    });

    const urlN8n: string = datos.checkout_url ?? datos.url ?? '';
    if (!urlN8n) {
      responder(res, { error: 'El servidor de pedidos no devolvió la pasarela de pago' }, 502);
      return;
    }

    // El pedido en formato plano. Viaja en el metadata de la sesion de Stripe
    // (lo lee el trigger "Pago completado en Stripe" de n8n) y tambien se
    // manda al flujo de n8n con el webhook de creacion.
    const metadataPlana: Record<string, string> = {
      order_code: codigoPedido,
      cliente_nombre: nombre,
      direccion: direccionFinal,
      telefono: telefonoFinal,
      total: totalEuros.toFixed(2),
      items: itemsParaMetadata(lineas),
      nombre,
      cliente_telefono: telefonoFinal,
      cliente_direccion: direccionFinal,
      total_centimos: String(Math.round(totalEuros * 100)),
      codigo: codigoPedido,
      email,
      pedido_id: String(datos.pedido_id ?? ''),
      tipo: mesa ? 'mesa' : 'domicilio',
      modo_entrega: tipoEntrega,
      modoRecogida: mesa ? 'mesa' : 'recogida',
      mesa: mesa || '',
      mesa_id: mesa ? String(mesa) : '',
    };

    // Sesion propia de Stripe con las urls de retorno correctas (el flujo de
    // n8n deja las suyas fijas en example.com). Solo se usa si el total
    // coincide con el de n8n; si no, se sigue con la sesion de n8n.
    const totalN8n = Number(datos.total ?? totalEuros);
    const cuadra = Math.abs(totalN8n - totalEuros) < 0.01;
    let urlSesion = urlN8n;
    let sessionId = idSesionDeUrl(urlN8n);
    let metadataActualizada = false;
    let sesionPropia = false;

    if (cuadra) {
      const propia = await crearSesionStripePropia(
        lineas,
        metadataPlana,
        urlExito,
        urlCancelacion,
      );
      if (propia) {
        urlSesion = propia.url;
        sessionId = propia.id;
        metadataActualizada = true;
        sesionPropia = true;
      }
    } else {
      log('[checkout] El total de n8n no cuadra con el de la carta', {
        total_n8n: totalN8n,
        total_carta: totalEuros,
      });
    }

    // Rellenar los datos del pedido: el flujo de n8n no copia el nombre a la
    // columna cliente_nombre. Ademas se guarda el payment_intent de la sesion
    // para que el trigger "Pago completado en Stripe" de n8n localice el
    // pedido por ese campo.
    const paymentIntent = await obtenerPaymentIntent(sessionId);

    // Si se usa la sesion de n8n, su metadata se actualiza con los datos
    // planos: si no los lleva, el mensaje sale con "Cliente", "Sin telefono"
    // y "0 EUR" y el detalle va en blanco.
    if (!sesionPropia) {
      metadataActualizada = await actualizarMetadataStripe(sessionId, metadataPlana);
    }

    await actualizarPedido(datos.pedido_id, {
      cliente_nombre: nombre,
      cliente_telefono: telefonoFinal,
      // OJO: en esta base de datos la columna se llama payment_intent.
      payment_intent: paymentIntent || null,
      // El id de la sesion de Stripe: es lo que permite al trigger "Pago
      // completado en Stripe" de n8n localizar el pedido en la tabla.
      stripe_session_id: sessionId || null,
    });
    info('[checkout] Pedido enlazado con Stripe', {
      pedido_id: datos.pedido_id,
      session_id: sessionId,
      payment_intent: paymentIntent,
      metadata_actualizada: metadataActualizada,
      sesion_propia: sesionPropia,
    });

    info('[checkout] Pedido creado', {
      pedido_id: datos.pedido_id,
      total_cents: datos.total_cents,
    });

    responder(res, {
      url: urlSesion,
      pedido_id: datos.pedido_id ?? '',
      // n8n devuelve el total en euros ("total") y a veces en centimos.
      total: datos.total_cents
        ? (datos.total_cents / 100).toFixed(2)
        : datos.total !== undefined && datos.total !== null
          ? Number(datos.total).toFixed(2)
          : '',
      totalCentimos: datos.total_cents ?? (datos.total ? Math.round(Number(datos.total) * 100) : 0),
      articulos: (body.items ?? []).map((i) => ({
        id: i.id,
        name: i.name ?? '',
        qty: i.quantity,
        price: i.price ?? '',
      })),
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    log('[checkout] No se pudo contactar con n8n:', mensaje, error);
    // Se devuelve el motivo real para poder diagnosticarlo desde el navegador.
    responder(
      res,
      {
        error: 'No se pudo contactar con el servidor de pedidos',
        detalle: mensaje,
        url: webhook,
      },
      502,
    );
  }
}
