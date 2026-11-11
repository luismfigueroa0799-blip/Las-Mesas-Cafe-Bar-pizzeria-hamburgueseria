// Tipos globales mínimos para que este archivo compile con cualquier tsconfig
// (sin depender de "lib": ["dom"] ni de @types/node).
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

function log(...args: unknown[]): void {
  const c = g.console;
  if (c && typeof c.error === 'function') c.error(...args);
}

export default async function handler(req: any): Promise<any> {
  if (req?.method === 'GET') {
    return responder({ status: 'ok', message: 'Webhook de pedidos activo' });
  }

  if (req?.method && req.method !== 'POST') {
    return responder({ error: 'Método no permitido' }, 405);
  }

  let evento: Record<string, any>;
  try {
    evento = (await req.json()) as Record<string, any>;
  } catch {
    return responder({ error: 'Cuerpo no válido' }, 400);
  }

  const webhookUrl = entorno().N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    log('N8N_WEBHOOK_URL no configurada: se acepta el evento sin reenviar.');
    return responder({ received: true, forwarded: false });
  }

  // Solo nos interesan los pedidos completados.
  const tipo = String(evento?.type ?? '');
  if (tipo && !tipo.includes('checkout.session.completed')) {
    return responder({ received: true, forwarded: false, ignored: tipo });
  }

  const datos = (evento?.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento?.object ?? {}) as Record<string, any>;
  const detalles = (objeto.customer_details ?? {}) as Record<string, any>;

  let articulos: unknown = [];
  try {
    articulos = objeto.metadata?.items ? JSON.parse(objeto.metadata.items) : [];
  } catch {
    articulos = [];
  }

  const pedido = {
    evento: tipo || 'checkout.session.completed',
    idPedido: objeto.id,
    fecha: objeto.created
      ? new Date(objeto.created * 1000).toISOString()
      : new Date().toISOString(),
    correo: detalles.email ?? objeto.customer_email ?? '',
    nombre: detalles.name ?? '',
    telefono: detalles.phone ?? '',
    total: objeto.amount_total ? (objeto.amount_total / 100).toFixed(2) : '',
    moneda: objeto.currency ?? 'eur',
    articulos,
    metodoPago: objeto.payment_method_types?.[0] ?? '',
    modoRecogida: objeto.metadata?.modoRecogida ?? 'recogida',
    mesa: objeto.metadata?.mesa ?? '',
  };

  try {
    const respuesta = await g.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
    });

    if (!respuesta.ok) {
      log('n8n respondió con', respuesta.status);
      return responder({ received: true, forwarded: false }, 502);
    }

    return responder({ received: true, forwarded: true });
  } catch (error) {
    log('Error al enviar a n8n:', error);
    return responder({ received: true, forwarded: false }, 500);
  }
}
