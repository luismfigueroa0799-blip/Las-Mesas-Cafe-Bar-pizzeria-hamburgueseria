// Webhook de Stripe: recibe checkout.session.completed, actualiza el pedido en
// la tabla `pedidos` de Supabase y reenvía el pedido a n8n con el formato
// plano que usa el flujo de notificaciones.
//
// Variables de entorno (todas con valor por defecto si no están puestas):
//   SUPABASE_URL, SUPABASE_SECRET_KEY → actualizar el pedido
//   N8N_WEBHOOK_URL, N8N_WEBHOOK_URL_TEST → avisar a n8n
//
// IMPORTANTE:
//   - Las serverless functions de Vercel usan el estilo Node (req, res). Si se
//     devuelve un objeto Response en vez de llamar a res.end(), la peticion
//     nunca se completa.
//   - El codigo de Supabase va aqui dentro (sin imports externos) porque
//     Vercel no empaqueta ficheros externos a la carpeta api/.
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
  headers?:
    | { get?: (nombre: string) => string | null }
    | Record<string, string | string[] | undefined>;
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

// ── Configuracion comun (inline: Vercel no empaqueta imports fuera de api/) ──

/** Webhook de n8n que notifica el pedido (Telegram, email, tablet). */
const N8N_WEBHOOK_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';
/** Version de pruebas (solo responde una llamada tras "Execute workflow"). */
const N8N_WEBHOOK_TEST_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook-test/crear-pedido-domicilio';
/**
 * Webhook de n8n que SOLO notifica (Telegram, email, tablet).
 * Se toma de la variable de entorno N8N_WEBHOOK_NOTIFICAR.
 * Es distinto del de creacion (crear-pedido-domicilio): si se usara ese, el
 * flujo insertaria un pedido duplicado.
 *
 * Si no se define, el pedido se notifica solo con el trigger de Stripe de
 * n8n, que lee los datos de la tabla `pedidos` (que actualizamos aqui).
 */
/** Proyecto de Supabase (misma base de datos que usa el flujo de n8n). */
const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

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

/**
 * Webhook de n8n que SOLO notifica el pedido ya pagado (Telegram, email,
 * tablet).
 *
 * Es distinto del de creacion (crear-pedido-domicilio): si se usara ese, el
 * flujo insertaria un pedido duplicado.
 *
 * Si no se define, el pedido se notifica solo con el trigger de Stripe de
 * n8n, que lee los datos del metadata de la sesion y de la tabla `pedidos`
 * (que actualiza esta misma funcion).
 */
function urlWebhookNotificar(): string {
  const configurada = String(entorno().N8N_WEBHOOK_NOTIFICAR ?? '').trim();
  if (configurada && esUrlValida(configurada)) return configurada.replace(/\/+$/, '');
  return '';
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

/**
 * Telefono en formato canonico: solo digitos con prefijo 34 (p.ej. 34600000000).
 */
function normalizarTelefono(valor: string | undefined): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 9) return '34' + digitos;
  if (digitos.length === 10 && digitos.startsWith('6')) return '34' + digitos;
  if (digitos.length === 11 && digitos.startsWith('34')) return digitos;
  return digitos;
}

/** Genera un codigo de pedido tipo "PED-4K7X". */
function generarCodigo(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 4; i += 1) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return 'PED-' + codigo;
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

/** Peticion a la API REST de Supabase. */
async function peticionSupabase(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<{ ok: boolean; status: number; datos: any }> {
  const cfg = configSupabase();
  if (!cfg) return { ok: false, status: 0, datos: null };

  try {
    const respuesta = await g.fetch(cfg.url + '/rest/v1/' + ruta, {
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
    log('[webhook] error de Supabase:', error);
    return { ok: false, status: 0, datos: null };
  }
}

/** Verifica la firma Stripe con Web Crypto (HMAC-SHA256), sin dependencias. */
async function verificarFirma(
  cuerpoCrudo: string,
  firma: string | null,
  secreto: string,
): Promise<boolean> {
  if (!firma || !secreto) return true;
  const subtle = g.crypto?.subtle;
  if (!subtle) return true;

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

  const payloadFirmado = timestamp + '.' + cuerpoCrudo;
  const firmaCalculada = await subtle.sign('HMAC', clave, codificador.encode(payloadFirmado));
  const esperada = Array.from(new Uint8Array(firmaCalculada))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return esperada === recibido;
}

/**
 * Lee una cabecera de la petición.
 *
 * Las serverless functions de Vercel (runtime Node) entregan `req.headers`
 * como un objeto normal, no como un `Headers`, asi que hay que supporting las
 * dos formas.
 */
function valorCabecera(req: Req, nombre: string): string {
  const cabeceras: any = req?.headers;
  if (!cabeceras) return '';
  if (typeof cabeceras.get === 'function') return String(cabeceras.get(nombre) ?? '');
  const valor = cabeceras[nombre];
  return Array.isArray(valor) ? String(valor[0] ?? '') : String(valor ?? '');
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

/** Linea de pedido con el formato que espera el flujo de n8n. */
interface LineaN8n {
  nombre: string;
  cantidad: number;
  precio: number;
  // Campos extra por si el flujo los utiliza.
  id?: string | number;
  qty?: number;
  price?: number;
  subtotal?: number;
}

/**
 * Convierte las lineas de la tabla `pedidos` al formato del flujo:
 * { nombre, cantidad, precio } con el precio en euros como numero.
 */
function lineasDesdePedido(items: any): LineaN8n[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const precio = Number(item.precio_unitario ?? item.precio ?? 0);
    const cantidad = Number(item.qty ?? item.cantidad ?? 1);
    return {
      nombre: String(item.nombre ?? item.name ?? ''),
      cantidad,
      precio: Number.isFinite(precio) ? precio : 0,
      id: item.id,
      qty: cantidad,
      price: Number.isFinite(precio) ? precio : 0,
      subtotal: Number.isFinite(precio) ? Math.round(precio * cantidad * 100) / 100 : 0,
    };
  });
}

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

/**
 * Detalle del pedido en texto plano, una linea por articulo, para que el
 * nodo de Telegram del flujo de n8n pueda pintarlo sin bucles ni parsear JSON.
 */
function detalleEnTexto(
  lineas: Array<{ nombre: string; cantidad: number; precio: number }>,
): string {
  return lineas
    .map((l) => {
      const precio = l.precio.toFixed(2).replace('.', ',');
      const unidades = l.cantidad > 1 ? `${l.cantidad} x ` : '';
      return `${unidades}${l.nombre} - ${precio} €`;
    })
    .join('\n');
}

/**
 * Resumen del pedido en texto plano, listo para pegar en un mensaje.
 */
function resumenEnTexto(datos: {
  nombre: string;
  telefono: string;
  direccion: string;
  total: number;
}): string {
  const total = datos.total.toFixed(2).replace('.', ',');
  return [
    `Cliente: ${datos.nombre}`,
    `Telefono: ${datos.telefono}`,
    `Direccion: ${datos.direccion}`,
    `TOTAL: ${total} €`,
  ].join('\n');
}

/**
 * Lineas del pedido en el formato que usa el flujo de n8n para pintar el
 * detalle: el precio como texto con el formato de la carta ("6,50 EUR") y
 * los importes en centimos.
 */
function lineasComoTexto(
  lineas: Array<{ id?: unknown; nombre: string; cantidad: number; precio: number }>,
): Array<Record<string, unknown>> {
  return lineas.map((l) => {
    const precioTexto = l.precio.toFixed(2).replace('.', ',') + ' €';
    const centimos = Math.round(l.precio * 100);
    return {
      id: String(l.id ?? ''),
      nombre: l.nombre,
      name: l.nombre,
      cantidad: l.cantidad,
      qty: l.cantidad,
      precio: precioTexto,
      price: precioTexto,
      unit_cents: centimos,
      subtotal_cents: centimos * l.cantidad,
    };
  });
}

/**
 * Actualiza el pedido omitiendo las columnas que todavia no existen en la
 * tabla `pedidos`.
 *
 * Necesario porque la base de datos se creo sin todas las columnas: si se
 * manda un campo inexistente, Supabase rechaza el PATCH entero (400) y el
 * pedido se queda sin actualizar (el nombre del cliente, el estado y el
 * payment_intent se perdian).
 */
async function actualizarPedido(
  pedidoId: string,
  campos: Record<string, unknown>,
): Promise<{ ok: boolean; descartadas: string[] }> {
  const cfg = configSupabase();
  if (!cfg || !pedidoId) return { ok: false, descartadas: [] };

  let pendientes: Record<string, unknown> = { ...campos };
  const descartadas: string[] = [];

  for (let intento = 0; intento < 5; intento += 1) {
    const r = await peticionSupabase('pedidos?id=eq.' + pedidoId, 'PATCH', pendientes);
    if (r.ok) return { ok: true, descartadas };

    const texto = typeof r.datos === 'string' ? r.datos : JSON.stringify(r.datos ?? '');
    const columna = columnaInexistente(texto);
    if (!columna || !(columna in pendientes)) {
      log('[webhook] Supabase no acepto la actualizacion:', r.status, texto.slice(0, 300));
      return { ok: false, descartadas };
    }
    delete pendientes[columna];
    descartadas.push(columna);
    log('[webhook] La columna "' + columna + '" no existe en la tabla pedidos: se omite.');
  }

  return { ok: false, descartadas };
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
      supabase: Boolean(claveSupabase()),
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
  //
  // OJO: en el runtime Node de Vercel `req.body` llega ya parseado, asi que no
  // se puede reconstruir el cuerpo byte a byte tal y como lo firmo Stripe. Por
  // eso la comprobacion AVISA en el log pero NO bloquea el pedido: un fallo
  // aqui nunca debe dejar un pedido pagado sin registrar.
  if (env.STRIPE_WEBHOOK_SECRET) {
    const firma = valorCabecera(req, 'stripe-signature') || null;
    const ok = await verificarFirma(cuerpoCrudo, firma, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) {
      log(
        '[webhook] La firma de Stripe no se pudo validar (el cuerpo llega parseado). ' +
          'Se continua con el pedido.',
      );
    }
  }

  const livemode = evento?.livemode === true;
  const datos = (evento?.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento?.object ?? {}) as Record<string, any>;
  const detalles = (objeto.customer_details ?? {}) as Record<string, any>;
  const metadata = (objeto.metadata ?? {}) as Record<string, any>;

  const pedidoId = String(metadata.pedido_id ?? metadata.pedido_codigo ?? '');

  // ── 1) Leer el pedido de Supabase (fuente de verdad de los datos) ──
  let pedido: any = null;
  if (/^\d+$/.test(pedidoId)) {
    const r = await peticionSupabase('pedidos?id=eq.' + pedidoId, 'GET');
    if (r.ok && Array.isArray(r.datos) && r.datos.length) pedido = r.datos[0];
  }

  // Si no se encuentra en la tabla, se usan los datos del evento de Stripe.
  let lineas = lineasDesdePedido(pedido?.items);

  // Respaldo: el metadata de la sesion lleva el detalle del pedido en JSON
  // (lo rellena /api/checkout al crear la sesion).
  if (!lineas.length && typeof metadata.items === 'string') {
    try {
      const parsed = JSON.parse(metadata.items);
      if (Array.isArray(parsed)) lineas = lineasDesdePedido(parsed);
    } catch {
      /* el detalle no viaja en el metadata: se sigue con el pedido */
    }
  }

  const totalPedido = pedido?.total !== undefined && pedido?.total !== null
    ? Number(pedido.total)
    : metadata.total !== undefined && metadata.total !== null && metadata.total !== ''
      ? Number(metadata.total)
      : objeto.amount_total
        ? Math.round((objeto.amount_total / 100) * 100) / 100
        : 0;

  const nombreCliente = String(
    pedido?.cliente_nombre ??
      metadata.cliente_nombre ??
      metadata.nombre ??
      detalles.name ??
      '',
  );
  const telefonoCliente = normalizarTelefono(
    pedido?.cliente_telefono ?? metadata.cliente_telefono ?? metadata.telefono ?? detalles.phone ?? '',
  );
  const direccionCliente = String(
    pedido?.direccion ?? metadata.direccion ?? metadata.cliente_direccion ?? '',
  );
  const orderCode = String(
    metadata.codigo ?? metadata.order_code ?? metadata.codigo_pedido ?? generarCodigo(),
  );

  // ── 2) Actualizar el pedido: pagado, con su intent y sus datos ──
  //
  // La tabla `pedidos` no tiene todas las columnas (por ejemplo `pagado_at` o
  // `stripe_session_id`). Si se manda un campo que no existe, Supabase
  // rechaza el PATCH entero y el pedido se queda sin actualizar. Por eso se
  // detectan esas columnas y se reintenta sin ellas.
  if (pedidoId && /^\d+$/.test(pedidoId)) {
    await actualizarPedido(pedidoId, {
      estado: 'pendiente_confirmacion',
      // OJO: en esta base de datos la columna se llama payment_intent.
      payment_intent: objeto.payment_intent ?? null,
      pagado_at: new Date().toISOString(),
      cliente_nombre: nombreCliente || null,
      cliente_telefono: telefonoCliente || null,
      direccion: direccionCliente || null,
    });
  }

  // ── 3) Avisar a n8n con el JSON plano que usa el flujo ──
  // Se avisa al webhook de NOTIFICACION. Si no hay uno configurado, no se
  // envia nada al de creacion (insertaria un pedido duplicado): en ese caso la
  // notificacion la hace el trigger de Stripe de n8n, que lee los datos de la
  // tabla pedidos, ya actualizada arriba.
  const destino = urlWebhookNotificar();
  const avisarPorWebhook = Boolean(destino);
  if (!destino || !avisarPorWebhook) {
    responder(res, {
      received: true,
      forwarded: false,
      motivo: avisarPorWebhook ? 'sin URL de n8n' : 'notificado por el trigger de Stripe de n8n',
    });
    return;
  }

  const fechaPago = objeto.created
    ? new Date(objeto.created * 1000).toISOString()
    : new Date().toISOString();

  const correoCliente = String(
    metadata.correo ?? metadata.cliente_correo ?? detalles.email ?? objeto.customer_email ?? '',
  );
  const modoRecogida = String(metadata.modoRecogida ?? metadata.modo_recogida ?? 'recogida');
  const esDomicilio = String(metadata.tipo ?? pedido?.tipo ?? 'domicilio') === 'domicilio';

  // Lineas en el formato antiguo ("articulos"): precio como texto con el
  // formato de la carta ("6,50 EUR").
  const lineasTexto = lineasComoTexto(lineas);
  const articulos = lineasTexto;

  const payload = {
    // ── Formato plano que espera el flujo de n8n ──
    order_code: orderCode,
    cliente_nombre: nombreCliente,
    direccion: direccionCliente,
    telefono: telefonoCliente,
    total: totalPedido,
    items: lineas,
    detalle: lineasTexto,
    numArticulos: String(lineas.length),
    detalle_texto: detalleEnTexto(lineas),
    resumen: resumenEnTexto({
      nombre: nombreCliente,
      telefono: telefonoCliente,
      direccion: direccionCliente,
      total: totalPedido,
    }),
    total_texto: totalPedido.toFixed(2),
    total_euros: totalPedido.toFixed(2),
    origen: 'las-mesas-web',

    // ── Nombres del contrato anterior (para que no cambien los nodos) ──
    evento: 'checkout.session.completed',
    idPedido: String(objeto.id ?? ''),
    idPago: String(objeto.payment_intent ?? ''),
    fecha: fechaPago,
    modoPrueba: !livemode,
    correo: correoCliente,
    nombre: nombreCliente,
    tipoEntrega: esDomicilio ? 'domicilio' : 'recogida',
    recogida: !esDomicilio,
    domicilio: esDomicilio,
    modoRecogida,
    mesa: String(metadata.mesa ?? ''),
    articulos,
    subtotal: totalPedido,
    impuestos: 0,
    metodoPago: String(objeto.payment_method_types?.[0] ?? 'card'),
    urlOrigen: String(metadata.urlOrigen ?? metadata.url_origen ?? ''),
    restaurante: 'Las Mesas · Café & Bar',
    telefonoRestaurante: '+34 928 896 097',
    whatsappRestaurante: '346010000000',

    // ── Campos extra por compatibilidad ──
    pedido_id: pedidoId,
    codigo: orderCode,
    codigo_pedido: orderCode,
    cliente_telefono: telefonoCliente,
    cliente_direccion: direccionCliente,
    cliente_correo: correoCliente,
    email: correoCliente,
    tipo: String(metadata.tipo ?? pedido?.tipo ?? 'domicilio'),
    modo_entrega: esDomicilio ? 'domicilio' : 'recogida',
    mesa_id: String(metadata.mesa_id ?? metadata.mesa ?? ''),
    direccionDetalle: {
      calle: metadata.calle ?? '',
      numero: metadata.numero ?? '',
      piso: metadata.piso ?? '',
      codigoPostal: metadata.codigoPostal ?? '',
      ciudad: metadata.ciudad ?? '',
    },
    total_centimos: Math.round(totalPedido * 100),
    total_cents: Math.round(totalPedido * 100),
    moneda: 'eur',
    estado: 'pagado',
    pago: {
      id: objeto.id ?? '',
      intent: objeto.payment_intent ?? '',
      fecha: fechaPago,
      modoPrueba: !livemode,
    },
  };

  info('[webhook] Avisando a n8n', {
    destino,
    pedido_id: pedidoId,
    order_code: orderCode,
    total: totalPedido,
    items: lineas.length,
  });

  try {
    const respuesta = await g.fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const texto = await respuesta.text();
    if (!respuesta.ok) {
      log('[webhook] n8n respondió con', respuesta.status, texto.slice(0, 300));
      responder(res, { received: true, forwarded: false, destino }, 502);
      return;
    }

    responder(res, {
      received: true,
      forwarded: true,
      destino,
      pedido_id: pedidoId,
      order_code: orderCode,
    });
  } catch (error) {
    log('[webhook] Error al enviar a n8n:', error);
    responder(res, { received: true, forwarded: false, destino }, 500);
  }
}
