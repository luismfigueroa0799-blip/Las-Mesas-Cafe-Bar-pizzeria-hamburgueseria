// Prueba de extremo a extremo en produccion:
// 1) Crea el pedido por /api/checkout
// 2) Paga la sesion de Stripe con la tarjeta de prueba
// 3) Comprueba que Stripe avisa a /api/webhook y que el pedido queda pagado
import { readFileSync } from 'node:fs';

const BASE = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const sk = process.env.STRIPE_SECRET_KEY;
const sb = process.env.SUPABASE_SECRET_KEY;
const su = process.env.SUPABASE_URL;

const auth = { Authorization: 'Bearer ' + sk };

// 1) Crear el pedido
const cuerpo = {
  items: [{ id: '4', name: 'La suprema', price: '6,50 EUR', quantity: 1 }],
  customerEmail: 'luis@gmail.com',
  customerName: 'Prueba E2E',
  telefono: '600000000',
  tipoEntrega: 'recogida',
  total: '6.50',
  direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
};
const r = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});
const datos = await r.json();
console.log('1) /api/checkout ->', r.status, 'pedido_id:', datos.pedido_id, 'total:', datos.total);
const sesion = String(datos.url ?? '').match(/cs_[a-zA-Z0-9_]+/)?.[0];
console.log('   sesion:', sesion);

// 2) Tarjeta de prueba y pago
const pm = await fetch('https://api.stripe.com/v1/payment_methods', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
  body:
    'type=card&card[number]=4242424242424242&card[exp_month]=12&card[exp_year]=2030&card[cvc]=123',
});
const pmDatos = await pm.json();
console.log('2) payment method:', pmDatos.id ?? JSON.stringify(pmDatos).slice(0, 200));

const completo = await fetch(
  'https://api.stripe.com/v1/checkout/sessions/' + sesion + '/complete',
  {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'payment_method=' + pmDatos.id,
  },
);
const cd = await completo.json();
console.log('   pago:', completo.status, 'payment_status:', cd.payment_status, 'status:', cd.status);
console.log('   payment_intent:', cd.payment_intent);

// 3) Esperar al webhook de Stripe
await new Promise((res) => setTimeout(res, 8000));

// 4) Estado del pedido en Supabase
const leido = await fetch(
  su + '/rest/v1/pedidos?select=id,estado,cliente_nombre,cliente_telefono,direccion,total,payment_intent,items&id=eq.' +
    datos.pedido_id,
  { headers: { apikey: sb, Authorization: 'Bearer ' + sb } },
);
const fila = (await leido.json())[0];
console.log('\n3) PEDIDO EN SUPABASE TRAS EL PAGO:');
console.log(JSON.stringify(fila, null, 2));

const checks = [
  ['estado = pendiente_confirmacion', fila?.estado === 'pendiente_confirmacion'],
  ['cliente_nombre = "Prueba E2E"', fila?.cliente_nombre === 'Prueba E2E'],
  ['cliente_telefono = 34600000000', fila?.cliente_telefono === '34600000000'],
  ['total = 6.5', Number(fila?.total) === 6.5],
  ['payment_intent guardado', typeof fila?.payment_intent === 'string' && fila.payment_intent.length > 5],
  ['items con nombre', fila?.items?.[0]?.nombre === 'La suprema'],
];
console.log('\n=== COMPROBACIONES ===');
let fallos = 0;
for (const [n, ok] of checks) {
  console.log(`  ${ok ? 'OK  ' : 'FALLO'} ${n}`);
  if (!ok) fallos += 1;
}
console.log(fallos === 0 ? 'PAGO DE EXTREMO A EXTREMO CORRECTO' : `${fallos} FALLOS`);
