const BASE = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
// Caso extremo: 10 articulos distintos -> el detalle es largo de verdad.
const ids = ['1','2','3','4','5','6','7','8','9','10'];
const body = {
  items: ids.map((id) => ({ id, name: 'Producto ' + id, price: '3,60 €', quantity: 2 })),
  customerEmail: 'luis@gmail.com', customerName: 'Luis Figueras',
  telefono: '600000000', tipoEntrega: 'domicilio', total: '72.00',
  direccion: { calle: 'Calle Mayor', numero: '24', piso: '3 B', codigoPostal: '35018', ciudad: 'Las Palmas de Gran Canaria' },
};
const r = await fetch(BASE + '/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
const t = await r.text();
console.log('10 articulos ->', r.status, t.slice(0, 150).replace(/\s+/g,' '));
let d = null; try { d = JSON.parse(t); } catch {}
if (d?.url) {
  const sk = process.env.STRIPE_SECRET_KEY;
  const s = await fetch('https://api.stripe.com/v1/checkout/sessions/' + String(d.url).match(/cs_[a-zA-Z0-9_]+/)[0], { headers: { Authorization: 'Bearer ' + sk } });
  const sd = await s.json();
  const md = sd.metadata ?? {};
  const largos = Object.entries(md).filter(([, v]) => String(v).length > 500);
  console.log('   claves del metadata:', Object.keys(md).length);
  console.log('   valores de mas de 500 chars:', largos.length ? largos.map(([k,v]) => k + '=' + v.length).join(', ') : 'ninguno');
  console.log('   items (JSON):', md.items);
  console.log('   detalle_texto:', JSON.stringify(md.detalle_texto));
  console.log('   resumen:', JSON.stringify(md.resumen));
}
