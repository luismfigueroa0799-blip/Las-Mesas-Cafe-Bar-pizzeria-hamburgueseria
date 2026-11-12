const url = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app/api/checkout';
const cuerpo = {
  items: [{ id: '4', name: 'La suprema', price: '6,50 EUR', quantity: 1 }],
  customerEmail: 'luis@gmail.com',
  customerName: 'Luis Figueras',
  telefono: '600000000',
  tipoEntrega: 'domicilio',
  total: '6.50',
  direccion: { calle: 'Calle Mayor', numero: '24', piso: '3 B', codigoPostal: '35018', ciudad: 'Las Palmas' },
};
const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
const texto = await r.text();
console.log('HTTP', r.status);
console.log(texto.slice(0, 400));
try {
  const d = JSON.parse(texto);
  const sesion = String(d.url ?? '').match(/cs_[a-zA-Z0-9_]+/)?.[0];
  if (sesion) {
    const sk = process.env.STRIPE_SECRET_KEY;
    const s = await fetch('https://api.stripe.com/v1/checkout/sessions/' + sesion, { headers: { Authorization: 'Bearer ' + sk } });
    const sd = await s.json();
    console.log('\n--- SESION DE STRIPE ---');
    console.log('success_url:', sd.success_url);
    console.log('cancel_url :', sd.cancel_url);
    console.log('amount_total:', sd.amount_total);
    console.log('metadata   :', JSON.stringify(sd.metadata, null, 2));
  }
} catch (e) { console.log('sin json', e.message); }
