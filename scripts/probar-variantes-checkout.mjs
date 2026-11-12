// Prueba varios pedidos para encontrar el que falla al crear la sesion.
const BASE = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';

const casos = [
  {
    nombre: 'La suprema x1 (6,50) - domicilio',
    body: {
      items: [{ id: '4', name: 'La suprema', price: '6,50 EUR', quantity: 1 }],
      customerEmail: 'luis@gmail.com', customerName: 'Luis Figueras',
      telefono: '600000000', tipoEntrega: 'domicilio', total: '6.50',
      direccion: { calle: 'Calle Mayor', numero: '24', piso: '', codigoPostal: '35018', ciudad: 'Las Palmas' },
    },
  },
  {
    nombre: 'Cafe Solo x1 (1,50) - recogida  <-- TU PEDIDO',
    body: {
      items: [{ id: '1', name: 'Café Solo', price: '1,50 €', quantity: 1 }],
      customerEmail: 'luis@gmail.com', customerName: 'Luis Figueras',
      telefono: '600000000', tipoEntrega: 'recogida', total: '1.50',
      direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
    },
  },
  {
    nombre: 'Cafe Solo x1 (1,50) - domicilio',
    body: {
      items: [{ id: '1', name: 'Café Solo', price: '1,50 €', quantity: 1 }],
      customerEmail: 'luis@gmail.com', customerName: 'Luis Figueras',
      telefono: '600000000', tipoEntrega: 'domicilio', total: '1.50',
      direccion: { calle: 'Calle Mayor', numero: '24', piso: '', codigoPostal: '35018', ciudad: 'Las Palmas' },
    },
  },
  {
    nombre: '4 articulos distintos',
    body: {
      items: [
        { id: '1', name: 'Café Solo', price: '1,50 €', quantity: 1 },
        { id: '2', name: 'Café con Leche', price: '2,00 €', quantity: 2 },
        { id: '3', name: 'Croissant', price: '2,50 €', quantity: 1 },
        { id: '5', name: 'La tradicional', price: '3,60 €', quantity: 1 },
      ],
      customerEmail: 'luis@gmail.com', customerName: 'Luis Figueras',
      telefono: '600000000', tipoEntrega: 'recogida', total: '11.20',
      direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
    },
  },
];

for (const c of casos) {
  const r = await fetch(BASE + '/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c.body),
  });
  const texto = await r.text();
  let ok = false;
  try { ok = JSON.parse(texto)?.url !== undefined; } catch { /* nada */ }
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${c.nombre}`);
  console.log(`        HTTP ${r.status}  ${texto.slice(0, 260).replace(/\s+/g, ' ')}\n`);
}
