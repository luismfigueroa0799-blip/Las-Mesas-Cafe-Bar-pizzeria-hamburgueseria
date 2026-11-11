// Consulta una sesión de Stripe para confirmar que el pago se completó.
// Se usa en la página de retorno para mostrar la confirmación del pedido.
// Variables de entorno: STRIPE_SECRET_KEY

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

export default async function handler(req: any): Promise<any> {
  if (req?.method && req.method !== 'GET' && req?.method !== 'POST') {
    return responder({ error: 'Método no permitido' }, 405);
  }

  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey) {
    return responder({ error: 'Falta STRIPE_SECRET_KEY en el servidor' }, 500);
  }

  // El session_id puede venir en la query (GET) o en el cuerpo (POST).
  let sessionId = '';
  try {
    const url = new g.URL(req?.url ?? 'http://localhost');
    sessionId = url.searchParams.get('session_id') ?? '';
  } catch {
    sessionId = '';
  }
  if (!sessionId && req?.method === 'POST') {
    try {
      const cuerpo = await req.json();
      sessionId = String(cuerpo?.session_id ?? '');
    } catch {
      sessionId = '';
    }
  }

  if (!sessionId) {
    return responder({ error: 'Falta session_id' }, 400);
  }

  try {
    const respuesta = await g.fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    const datos: any = await respuesta.json();
    if (!respuesta.ok) {
      return responder({ error: datos?.error?.message ?? 'Sesión no encontrada' }, 404);
    }

    const pagado = datos.payment_status === 'paid' || datos.status === 'complete';
    let articulos: unknown = [];
    try {
      articulos = datos.metadata?.items ? JSON.parse(datos.metadata.items) : [];
    } catch {
      articulos = [];
    }

    return responder({
      idPedido: datos.id,
      pagado,
      estado: datos.payment_status,
      total: datos.amount_total ? (datos.amount_total / 100).toFixed(2) : '',
      moneda: datos.currency ?? 'eur',
      correo: datos.customer_details?.email ?? datos.customer_email ?? '',
      articulos,
      modoRecogida: datos.metadata?.modoRecogida ?? 'recogida',
      mesa: datos.metadata?.mesa ?? '',
      fecha: datos.created ? new Date(datos.created * 1000).toISOString() : '',
    });
  } catch (error) {
    return responder({ error: 'No se pudo consultar Stripe' }, 502);
  }
}
