/**
 * Muestra el metadata real de una sesion de Stripe (para verificar que n8n
 * recibe los campos que necesita).
 *
 * Uso:  node scripts/ver-metadata-stripe.mjs <session_id>
 */
const sk = process.env.STRIPE_SECRET_KEY;
const sessionId = process.argv[2];

if (!sk || !sessionId) {
  console.error('Uso: STRIPE_SECRET_KEY=sk_... node scripts/ver-metadata-stripe.mjs cs_test_...');
  process.exit(1);
}

const respuesta = await fetch(
  `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
  { headers: { Authorization: `Bearer ${sk}` } },
);
const datos = await respuesta.json();

if (!respuesta.ok) {
  console.error('Error de Stripe:', datos.error?.message);
  process.exit(1);
}

console.log('=== METADATA DE LA SESION (lo que lee n8n) ===');
for (const [clave, valor] of Object.entries(datos.metadata ?? {})) {
  console.log(`  ${clave.padEnd(22)} = ${String(valor).slice(0, 90)}`);
}
console.log('');
console.log('amount_total :', datos.amount_total, '(centimos)');
console.log('currency     :', datos.currency);
console.log('payment_status:', datos.payment_status);
console.log('customer_email:', datos.customer_email);
console.log('');

// Campos que el flujo de n8n necesita
const m = datos.metadata ?? {};
const requiere = [
  'pedido_id',
  'cliente_nombre',
  'cliente_telefono',
  'direccion',
  'items',
  'total',
];
console.log('=== CHECK DE CAMPOS QUE USA N8N ===');
for (const campo of requiere) {
  const valor = m[campo];
  const ok = valor !== undefined && valor !== null && String(valor).length > 0;
  console.log(`  ${ok ? 'OK  ' : 'FALTA'} ${campo.padEnd(18)} ${ok ? '' : '<-- vacio'}`);
}
console.log('');
try {
  const items = JSON.parse(m.items ?? '[]');
  console.log('items parseados:', items.length);
  for (const i of items) {
    console.log(`   - ${i.nombre ?? i.name} x${i.cantidad ?? i.qty} = ${i.precio ?? i.price}`);
  }
} catch {
  console.log('items NO es JSON valido');
}
