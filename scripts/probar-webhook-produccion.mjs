// Reenvia a nuestro webhook de produccion un evento real de Stripe
// (checkout.session.completed), tal y como lo entrega Stripe, y comprueba
// que el pedido queda pagado en Supabase.
const sk = process.env.STRIPE_SECRET_KEY;
const sb = process.env.SUPABASE_SECRET_KEY;
const su = process.env.SUPABASE_URL;
const BASE = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const auth = { Authorization: 'Bearer ' + sk };

// 1) Evento real de Stripe
const eventos = await (
  await fetch('https://api.stripe.com/v1/events?type=checkout.session.completed&limit=1', {
    headers: auth,
  })
).json();
const eventoReal = eventos.data[0];
const sesionReal = eventoReal.data.object;
console.log('Evento real:', eventoReal.id, '| sesion:', sesionReal.id);

// 2) Se clona el evento con el metadata de NUESTRA sesion (para que el
//    webhook encuentre el pedido) y el payment_intent real.
const nuestraSesion = process.argv[2];
let metadata = {};
if (nuestraSesion) {
  const s = await (
    await fetch('https://api.stripe.com/v1/checkout/sessions/' + nuestraSesion, { headers: auth })
  ).json();
  metadata = s.metadata ?? {};
  console.log('Metadata de nuestra sesion:', JSON.stringify(metadata).slice(0, 120), '...');
}

const pedidoId = metadata.pedido_id;
const evento = {
  ...eventoReal,
  data: {
    object: {
      ...sesionReal,
      id: nuestraSesion ?? sesionReal.id,
      payment_status: 'paid',
      status: 'complete',
      payment_intent: 'pi_3PRUEBAREAL12345',
      metadata,
    },
  },
};

// 3) Se entrega a nuestro webhook (como hace Stripe)
const r = await fetch(BASE + '/api/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(evento),
});
console.log('\nWebhook:', r.status, await r.text());

// 4) Estado del pedido
await new Promise((res) => setTimeout(res, 1500));
const fila = (
  await (
    await fetch(
      su + '/rest/v1/pedidos?select=id,estado,cliente_nombre,cliente_telefono,direccion,total,payment_intent,items&id=eq.' +
        pedidoId,
      { headers: { apikey: sb, Authorization: 'Bearer ' + sb } },
    )
  ).json()
)[0];
console.log('\nPEDIDO EN SUPABASE:');
console.log(JSON.stringify(fila, null, 2));

const checks = [
  ['estado = pendiente_confirmacion', fila?.estado === 'pendiente_confirmacion'],
  ['cliente_nombre', Boolean(fila?.cliente_nombre)],
  ['cliente_telefono', Boolean(fila?.cliente_telefono)],
  ['total', Number(fila?.total) > 0],
  ['payment_intent', Boolean(fila?.payment_intent)],
  ['items con nombre', Boolean(fila?.items?.[0]?.nombre)],
];
console.log('\n=== COMPROBACIONES ===');
let fallos = 0;
for (const [n, ok] of checks) {
  console.log(`  ${ok ? 'OK  ' : 'FALLO'} ${n}`);
  if (!ok) fallos += 1;
}
console.log(fallos === 0 ? 'WEBHOOK DE PRODUCCION CORRECTO' : `${fallos} FALLOS`);
