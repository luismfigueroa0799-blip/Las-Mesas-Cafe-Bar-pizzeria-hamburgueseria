// Descubre paths de webhook de n8n usando GET: un path registrado responde
// "This webhook is not registered for GET requests", uno que no existe
// responde "The requested webhook ... is not registered".
// El GET no dispara el flujo, asi que es seguro.
const BASE = 'https://barcafeteria.app.n8n.cloud/webhook/';

const candidatos = [
  // Pago / Stripe
  'pago', 'pagos', 'pago-completado', 'pago-completado-stripe', 'pago-stripe',
  'pago-realizado', 'pago-real', 'pagos-stripe', 'confirmar-pago', 'confirmacion-pago',
  'confirmacion-pago-stripe', 'confirmacion', 'stripe-pago', 'stripe-pago-completado',
  'pago-completado-en-stripe', 'pago-completado-stripe-2', 'pago-y-telegram',
  // Pedido
  'pedido', 'pedidos', 'pedido-pagado', 'pedidos-pagado', 'pedido-pagado-stripe',
  'pedido-confirmado', 'pedido-confirmacion', 'nuevo-pedido', 'notificar-pedido',
  'notificacion-pedido', 'aviso-pedido', 'avisar-pedido', 'pedido-creado',
  // Checkout / sesion
  'checkout', 'checkout-completado', 'sesion-pagada', 'sesion-completada',
  'stripe-webhook', 'webhook-stripe', 'webhook-pago', 'stripe', 'stripe-webhooks',
  // Nombres propios
  'las-mesas', 'lasmesas', 'las-mesas-pago', 'las-mesas-pedidos', 'pedidos-stripe',
  'pedidos-confirmacion-pago-stripe', 'confirmacion-pago-stripe-2', 'pago-stripe-2',
  'pedido-pagado-stripe-2', 'pagos-telegram', 'telegram-pago', 'telegram',
  'tablet', 'tablet-pago', 'aviso-telegram', 'pedidos-telegram', 'restaurante-pago',
];

const probar = async (path) => {
  try {
    const r = await fetch(BASE + path, { method: 'GET' });
    const t = await r.text();
    const existe = /not registered for GET requests/i.test(t);
    return { path, existe, msg: t.slice(0, 90).replace(/\s+/g, ' ') };
  } catch (e) {
    return { path, existe: false, msg: String(e.message).slice(0, 60) };
  }
};

const resultados = [];
for (let i = 0; i < candidatos.length; i += 8) {
  const tanda = candidatos.slice(i, i + 8);
  resultados.push(...(await Promise.all(tanda.map(probar))));
}

const encontrados = resultados.filter((r) => r.existe);
console.log('Probados:', resultados.length);
if (encontrados.length) {
  console.log('\n*** WEBHOOKS ENCONTRADOS ***');
  for (const r of encontrados) console.log('  /webhook/' + r.path);
} else {
  console.log('\nNo hay ningun webhook con esos nombres.');
}
const extra = resultados.filter((r) => !r.existe && /not registered\.$/i.test(r.msg) === false);
for (const r of extra.slice(0, 5)) console.log('  ?', r.path, r.msg);
