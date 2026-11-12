const sk = process.env.STRIPE_SECRET_KEY;
const BASE = {
  mode: 'payment',
  'line_items[0][price_data][currency]': 'eur',
  'line_items[0][price_data][product_data][name]': 'Test',
  'line_items[0][price_data][unit_amount]': '1200',
  'line_items[0][quantity]': '1',
  success_url: 'https://ejemplo.com/?pedido=ok',
  cancel_url: 'https://ejemplo.com/#carta',
};
async function crear(extra, etiqueta) {
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...BASE, ...extra }).toString(),
  });
  const j = await r.json();
  console.log(`--- ${etiqueta} ---`);
  if (j.error) { console.log('  ERROR:', j.error.message); return; }
  console.log('  customer_details.name :', JSON.stringify(j.customer_details?.name));
  console.log('  customer_details.email:', JSON.stringify(j.customer_details?.email));
  console.log('  customer_email        :', JSON.stringify(j.customer_email));
}
await crear({ customer_email: 'test@test.com', customer_creation: 'always' }, 'V4: customer_email + customer_creation=always');
await crear({ customer_email: 'test@test.com', customer_creation: 'always', 'customer_update[name]': 'auto' }, 'V5: + customer_update[name]');
await crear({ customer_email: 'test@test.com', customer_creation: 'always', 'shipping_address_collection[allowed_countries][0]': 'ES' }, 'V6: + shipping_address_collection');
