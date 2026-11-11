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
// Tipos globales mínimos para que este archivo compile con cualquier tsconfig
// (sin depender de "lib": ["dom"] ni de @types/node).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

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

export default async function handler(req: any): Promise<any> {
  const inicio = Date.now();

  info('[checkout] Petición recibida', {
    metodo: req?.method,
    url: req?.url,
    origen: req?.headers?.get?.('origin') ?? '(sin origin)',
  });

  if (req?.method && req.method !== 'POST') {
    log('[checkout] Método no permitido:', req?.method);
    return responder({ error: 'Método no permitido' }, 405);
  }

  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey) {
    log('[checkout] Falta STRIPE_SECRET_KEY en el servidor');
    return responder({ error: 'Falta STRIPE_SECRET_KEY en el servidor' }, 500);
  }

  let body: {
    items?: ItemCarrito[];
    customerEmail?: string;
    customerName?: string;
    telefono?: string;
    tipoEntrega?: string;
    direccion?: Direccion;
    mesa?: string;
    urlOrigen?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch (error) {
    log('[checkout] Cuerpo no válido', error);
    return responder({ error: 'Cuerpo de la petición no válido' }, 400);
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
    return responder({ error: 'El carrito está vacío' }, 400);
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

  const email = String(body.customerEmail ?? '').trim();
  const nombre = String(body.customerName ?? '').trim();
  const telefono = String(body.telefono ?? '').trim();
  const tipoEntrega = body.tipoEntrega === 'domicilio' ? 'domicilio' : 'recogida';
  const direccion = body.direccion ?? {};
  const mesa = String(body.mesa ?? '').trim();
  const direccionCompleta = direccionLegible(direccion);

  if (!email) {
    return responder({ error: 'Falta el correo electrónico del cliente' }, 400);
  }
  if (!nombre) {
    return responder({ error: 'Falta el nombre del cliente' }, 400);
  }
  if (!telefono) {
    return responder({ error: 'Falta el teléfono del cliente' }, 400);
  }
  if (tipoEntrega === 'domicilio' && !direccionCompleta) {
    return responder({ error: 'Falta la dirección de entrega' }, 400);
  }

  const headers = req?.headers;
  const host = headers?.get?.('host') ?? 'lasmesasbarcafet.com';
  const baseUrl = entorno().NEXT_PUBLIC_URL || `https://${host}`;

  const URLSearchParamsCtor = g.URLSearchParams;

  // ------------------------------------------------------------------
  // 1. Customer de Stripe con los datos ya rellenados.
  // ------------------------------------------------------------------
  let customerId = '';
  try {
    const customerParams = new URLSearchParamsCtor();
    customerParams.set('email', email);
    customerParams.set('name', nombre);
    if (telefono) customerParams.set('phone', telefono);
    if (tipoEntrega === 'domicilio' && direccionCompleta) {
      customerParams.set('address[line1]', direccionCompleta);
      if (direccion.codigoPostal) customerParams.set('address[postal_code]', direccion.codigoPostal);
      if (direccion.ciudad) customerParams.set('address[city]', direccion.ciudad);
      customerParams.set('address[country]', 'ES');
    }

    const respuesta = await g.fetch(`${STRIPE_API}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: customerParams.toString(),
    });

    const datos: any = await respuesta.json();
    if (respuesta.ok && datos?.id) {
      customerId = datos.id;
      info('[checkout] Customer creado', { id: datos.id, ms: Date.now() - inicio });
    } else {
      log('[checkout] No se pudo crear el customer', {
        status: respuesta.status,
        error: datos?.error?.message,
      });
    }
  } catch (error) {
    log('[checkout] Error creando el customer', error);
  }

  // ------------------------------------------------------------------
  // 2. Sesión de checkout.
  // ------------------------------------------------------------------
  const params = new URLSearchParamsCtor();
  params.set('mode', 'payment');
  params.set('success_url', `${baseUrl}/?pedido=ok&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${baseUrl}/?pedido=cancelado#carta`);

  if (customerId) {
    // Con el customer, Stripe hereda nombre, email, teléfono y dirección.
    // OJO: Stripe solo admite customer_update[name], customer_update[address]
    // y customer_update[shipping]. Para el teléfono se usa phone_number_collection.
    params.set('customer', customerId);
    params.set('customer_update[name]', 'auto');
    params.set('customer_update[address]', 'auto');
    if (telefono) {
      params.set('phone_number_collection[enabled]', 'true');
    }
  } else if (email) {
    params.set('customer_email', email);
  }

  // Recogida en local: no hace falta dirección de envío.
  // Envío a domicilio: Stripe muestra el formulario nativo de dirección,
  // pre-rellenado con los datos del customer.
  if (tipoEntrega === 'domicilio') {
    params.set('shipping_address_collection[allowed_countries][0]', 'ES');
  }

  // Metadata: viaja al webhook para llegar a n8n.
  params.set('metadata[nombre]', nombre);
  params.set('metadata[telefono]', telefono);
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
  params.set(
    'metadata[items]',
    JSON.stringify(
      items.map((i) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price })),
    ),
  );

  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'eur');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(aCentavos(item.price)));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  info('[checkout] Parámetros enviados a Stripe', {
    modo: params.get('mode'),
    lineItems: items.length,
    customer: customerId || '(sin customer)',
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
      return responder(
        { error: datos?.error?.message ?? 'Stripe rechazó la sesión' },
        502,
      );
    }

    info('[checkout] Sesión creada correctamente', {
      sessionId: datos.id,
      url: datos.url,
      cliente: customerId,
      ms: Date.now() - inicio,
    });

    return responder({
      sessionId: datos.id,
      url: datos.url,
      cliente: customerId,
    });
  } catch (error) {
    log('[checkout] Error contacting Stripe', error);
    return responder({ error: 'No se pudo contactar con Stripe' }, 500);
  }
}
