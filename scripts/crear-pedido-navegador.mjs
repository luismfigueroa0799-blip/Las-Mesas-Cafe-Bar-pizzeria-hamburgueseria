const BASE = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const cuerpo = {
  items: [{ id: '4', name: 'La suprema', price: '6,50 EUR', quantity: 2 }],
  customerEmail: 'luis@gmail.com',
  customerName: 'Prueba Navegador',
  telefono: '600000000',
  tipoEntrega: 'recogida',
  total: '13.00',
  direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
};
const r = await fetch(BASE + '/api/checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
});
const d = await r.json();
console.log('pedido_id:', d.pedido_id);
console.log('URL:', d.url);
const fs = await import('node:fs');
fs.writeFileSync(process.env.TEMP + '/pago-url.txt', String(d.url ?? ''), 'utf8');
fs.writeFileSync(process.env.TEMP + '/pago-pedido.txt', String(d.pedido_id ?? ''), 'utf8');
