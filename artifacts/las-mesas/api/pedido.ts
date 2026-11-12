// Consulta una sesión de Stripe para confirmar que el pago se completó.
// Se usa en la página de retorno para mostrar la confirmación del pedido.
//
// Variables de entorno: STRIPE_SECRET_KEY
//
// IMPORTANTE: las serverless functions de Vercel usan el estilo Node (req, res).
// Si se devuelve un objeto Response en vez de llamar a res.end(), la petición
// nunca se completa y el cliente se queda esperando.
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
  // res.json() es el metodo nativo de Vercel: pone el Content-Type, envia el
  // cuerpo y cierra la peticion. Con res.end() el cuerpo llegaba vacio.
  res.status(estado);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

/** Obtiene un parámetro de la query string. */
function param(req: Req, nombre: string): string {
  const valor = req?.query?.[nombre];
  if (Array.isArray(valor)) return valor[0] ?? '';
  return valor ?? '';
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req?.method && req.method !== 'GET' && req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const secretKey = entorno().STRIPE_SECRET_KEY;
  if (!secretKey) {
    responder(res, { error: 'Falta STRIPE_SECRET_KEY en el servidor' }, 500);
    return;
  }

  // El session_id puede venir en la query (GET) o en el cuerpo (POST).
  let sessionId = param(req, 'session_id');
  if (!sessionId && req?.method === 'POST' && req.body && typeof req.body === 'object') {
    sessionId = String((req.body as Record<string, unknown>).session_id ?? '');
  }

  if (!sessionId) {
    responder(res, { error: 'Falta session_id' }, 400);
    return;
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
      responder(res, { error: datos?.error?.message ?? 'Sesión no encontrada' }, 404);
      return;
    }

    const pagado = datos.payment_status === 'paid' || datos.status === 'complete';
    let articulos: unknown = [];
    try {
      articulos = datos.metadata?.items ? JSON.parse(datos.metadata.items) : [];
    } catch {
      articulos = [];
    }

    responder(res, {
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
    responder(res, { error: 'No se pudo consultar Stripe' }, 502);
  }
}
