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

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

function aCentavos(precio: string): number {
  const limpio = String(precio).replace(/[^\d,.]/g, '').replace(',', '.');
  const valor = parseFloat(limpio);
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

export default async function handler(req: any): Promise<any> {
  if (req?.method && req.method !== 'POST') {
    return responder({ error: 'Método no permitido' }, 405);
  }

  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey) {
    return responder({ error: 'Falta STRIPE_SECRET_KEY en el servidor' }, 500);
  }

  let body: {
    items?: ItemCarrito[];
    customerEmail?: string;
    customerName?: string;
    mesa?: string;
    urlOrigen?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return responder({ error: 'Cuerpo de la petición no válido' }, 400);
  }

  const items = (body.items ?? []).filter(
    (item) => item && item.quantity > 0 && aCentavos(item.price) > 0,
  );
  if (!items.length) {
    return responder({ error: 'El carrito está vacío' }, 400);
  }

  const headers = req?.headers;
  const host = headers?.get?.('host') ?? 'lasmesasbarcafet.com';
  const baseUrl = entorno().NEXT_PUBLIC_URL || `https://${host}`;

  const URLSearchParamsCtor = g.URLSearchParams;
  const params = new URLSearchParamsCtor();
  params.set('mode', 'payment');
  params.set('success_url', `${baseUrl}/?pedido=ok`);
  params.set('cancel_url', `${baseUrl}/#carta`);
  if (body.customerEmail) params.set('customer_email', body.customerEmail);
  if (body.customerName) params.set('metadata[nombreCliente]', body.customerName);
  params.set(
    'metadata[items]',
    JSON.stringify(
      items.map((i) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price })),
    ),
  );
  // Recogida en mesa (?mesa=N) o para llevar.
  const mesa = String(body.mesa ?? '').trim();
  params.set('metadata[modoRecogida]', mesa ? 'mesa' : 'recogida');
  if (mesa) params.set('metadata[mesa]', mesa);
  if (body.urlOrigen) params.set('metadata[urlOrigen]', body.urlOrigen);

  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'eur');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(aCentavos(item.price)));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  try {
    const respuesta = await g.fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const datos: any = await respuesta.json();
    if (!respuesta.ok) {
      log('Stripe error:', datos);
      return responder(
        { error: datos?.error?.message ?? 'Stripe rechazó la sesión' },
        502,
      );
    }

    return responder({ sessionId: datos.id, url: datos.url });
  } catch (error) {
    log('Error contacting Stripe:', error);
    return responder({ error: 'No se pudo contactar con Stripe' }, 500);
  }
}
