// Aísla en qué nodo falla el flujo "crear-pedido-domicilio" de n8n.
const WEBHOOK = 'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';

const casos = [
  {
    nombre: '1) Sin nombre (deberia responder 400 del nodo de validacion)',
    body: { direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 4, qty: 1 }] },
  },
  {
    nombre: '2) Nombre corto (deberia responder 400)',
    body: { nombre: 'A', direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 4, qty: 1 }] },
  },
  {
    nombre: '3) Producto que no existe (deberia responder 400)',
    body: { nombre: 'Luis', direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 99999, qty: 1 }] },
  },
  {
    nombre: '4) Producto inexistente + sin precio valido',
    body: { nombre: 'Luis', direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 'abc', qty: 1 }] },
  },
  {
    nombre: '5) Todo correcto (llega al INSERT en Neon)',
    body: { nombre: 'Luis', direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 4, qty: 1 }] },
  },
];

for (const c of casos) {
  const r = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c.body),
  });
  const t = await r.text();
  console.log(`${c.nombre}\n   HTTP ${r.status}  ${t.slice(0, 160)}\n`);
}
