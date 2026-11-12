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
async function actualizarPedido(
  pedidoId: string | number,
  campos: Record<string, unknown>,
): Promise<void> {
  const env = entorno();
  const url = (env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key || !pedidoId) return;

  try {
    await g.fetch(url + '/rest/v1/pedidos?id=eq.' + pedidoId, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(campos),
    });
  } catch (error) {
    log('[checkout] no se pudo actualizar el pedido:', error);
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
  const items: Array<{ id: number; qty: number }> = [];
  for (const item of body.items ?? []) {
    const id = idNumerico(item?.id ?? '');
    const qty = Number(item?.quantity ?? 0);
    if (id === null || !Number.isFinite(qty) || qty < 1) {
      responder(res, { error: 'El carrito tiene artículos no válidos' }, 400);
      return;
    }
    items.push({ id, qty: Math.floor(qty) });
  }
  if (!items.length) {
    responder(res, { error: 'El carrito está vacío' }, 400);
    return;
  }

  // Total que declara el cliente: solo para compararlo con el de n8n.
  const totalDeclarado = (body.items ?? []).reduce(
    (suma, item) => suma + aCentavos(item.price ?? '') * (Number(item.quantity) || 0),
    0,
  );

  const payload = {
    nombre,
    direccion: direccionCompleta || 'Recogida en el local',
    cliente_telefono: telefono || 'Sin teléfono',
    items,
    // Campos extra por si el flujo los utilize.
    tipo: mesa ? 'mesa' : 'domicilio',
    mesa: mesa || null,
    email,
    mesa_id: mesa ? Number(mesa) : null,
    modo_recogida: mesa ? 'mesa' : 'recogida',
  };

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
      log('[checkout] n8n rechazo el pedido:', datos);
      responder(res, { error: mensaje }, 400);
      return;
    }

    const urlSesion: string = datos.checkout_url ?? datos.url ?? '';
    if (!urlSesion) {
      responder(res, { error: 'El servidor de pedidos no devolvió la pasarela de pago' }, 502);
      return;
    }

    // Rellenar el nombre (y el telefono normalizado) en el pedido: el
    // flujo de n8n no copia el nombre a la columna cliente_nombre.
    await actualizarPedido(datos.pedido_id, {
      cliente_nombre: nombre,
      cliente_telefono: telefono || 'Sin telefono',
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
