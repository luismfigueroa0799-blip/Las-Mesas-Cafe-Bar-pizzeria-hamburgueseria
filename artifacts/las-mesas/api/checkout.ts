// Creación de la sesión de pago de Stripe (API REST, sin dependencias extra).
// Variables de entorno: STRIPE_SECRET_KEY y NEXT_PUBLIC_URL.

interface ItemCarrito {
  id: string;
  name: string;
  price: string;
  quantity: number;
}

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

function aCentavos(precio: string): number {
  const limpio = precio.replace(/[^\d,.]/g, '').replace(',', '.');
  const valor = parseFloat(limpio);
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return new Response(JSON.stringify({ error: 'Falta STRIPE_SECRET_KEY en el servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { items?: ItemCarrito[]; customerEmail?: string; customerName?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la petición no válido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const items = (body.items ?? []).filter((item) => item.quantity > 0 && aCentavos(item.price) > 0);
  if (!items.length) {
    return new Response(JSON.stringify({ error: 'El carrito está vacío' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_URL ||
    `https://${req.headers.get('host') ?? 'lasmesasbarcafet.com'}`;

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${baseUrl}/?pedido=ok`);
  params.set('cancel_url', `${baseUrl}/#carta`);
  if (body.customerEmail) params.set('customer_email', body.customerEmail);
  params.set(
    'metadata[items]',
    JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price }))),
  );

  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'eur');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(aCentavos(item.price)));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  try {
    const respuesta = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const datos = await respuesta.json();
    if (!respuesta.ok) {
      console.error('Stripe error:', datos);
      return new Response(
        JSON.stringify({ error: datos?.error?.message ?? 'Stripe rechazó la sesión' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ sessionId: datos.id, url: datos.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error contacting Stripe:', error);
    return new Response(JSON.stringify({ error: 'No se pudo contactar con Stripe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
