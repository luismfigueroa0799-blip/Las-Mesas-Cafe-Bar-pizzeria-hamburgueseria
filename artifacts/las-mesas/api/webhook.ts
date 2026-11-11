// Recibe los eventos de Stripe y los reenvía al webhook de n8n.
// Variable de entorno: N8N_WEBHOOK_URL.

export default async function handler(req: Request): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (req.method === 'GET') {
    return json({ status: 'ok', message: 'Webhook de pedidos activo' });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('N8N_WEBHOOK_URL no configurada: se acepta el evento sin reenviar.');
    return json({ received: true, forwarded: false });
  }

  let evento: Record<string, unknown>;
  try {
    evento = await req.json();
  } catch {
    return json({ error: 'Cuerpo no válido' }, 400);
  }

  // Solo nos interesan los pedidos completados.
  const tipo = String(evento.type ?? '');
  if (tipo && !tipo.includes('checkout.session.completed')) {
    return json({ received: true, forwarded: false, ignored: tipo });
  }

  const datos = (evento.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento.object ?? {}) as Record<string, any>;

  const pedido = {
    evento: tipo || 'checkout.session.completed',
    idPedido: objeto.id,
    fecha: objeto.created ? new Date(objeto.created * 1000).toISOString() : new Date().toISOString(),
    correo: objeto.customer_details?.email ?? objeto.customer_email ?? '',
    nombre: objeto.customer_details?.name ?? '',
    telefono: objeto.customer_details?.phone ?? '',
    total: objeto.amount_total ? (objeto.amount_total / 100).toFixed(2) : '',
    moneda: objeto.currency ?? 'eur',
    articulos: (objeto.metadata?.items ? JSON.parse(objeto.metadata.items) : []),
    metodoPago: objeto.payment_method_types?.[0] ?? '',
    modoRecogida: objeto.metadata?.modoRecogida ?? 'recogida',
    mesa: objeto.metadata?.mesa ?? '',
  };

  try {
    const respuesta = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
    });

    if (!respuesta.ok) {
      console.error('n8n respondió con', respuesta.status);
      return json({ received: true, forwarded: false }, 502);
    }

    return json({ received: true, forwarded: true });
  } catch (error) {
    console.error('Error al enviar a n8n:', error);
    return json({ received: true, forwarded: false }, 500);
  }
}
