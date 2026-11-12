const BASE = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';

// SPA
const spa = await fetch(BASE + '/');
const html = await spa.text();
console.log('SPA:', spa.status, '| titulo ok:', html.includes('Las Mesas'), '| bundle:', /assets\/index-[^"]+\.js/.test(html));

// Catalogo
const p = await fetch(BASE + '/api/productos');
const productos = await p.json();
console.log('Catalogo:', p.status, '| productos:', productos.length);
console.log('  con acentos correctos:', JSON.stringify(productos.slice(0, 2).map(x => x.nombre)));

// Webhook (salud)
const w = await fetch(BASE + '/api/webhook');
console.log('Webhook GET:', w.status, JSON.stringify(await w.json()));

// Checkout (carrito real)
const c = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ id: '4', name: 'La suprema', price: '6,50 EUR', quantity: 1 }],
    customerEmail: 'luis@gmail.com', customerName: 'Comprobacion Final',
    telefono: '600000000', tipoEntrega: 'recogida', total: '6.50',
    direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
  }),
});
const cd = await c.json();
console.log('Checkout:', c.status, '| pedido_id:', cd.pedido_id, '| total:', cd.total, '| url Stripe:', String(cd.url).slice(0, 55) + '...');

// Limpieza del pedido de comprobacion
const sb = process.env.SUPABASE_SECRET_KEY;
await fetch(process.env.SUPABASE_URL + '/rest/v1/pedidos?cliente_nombre=eq.Comprobacion%20Final', {
  method: 'DELETE', headers: { apikey: sb, Authorization: 'Bearer ' + sb },
});
console.log('Pedido de comprobacion borrado');
