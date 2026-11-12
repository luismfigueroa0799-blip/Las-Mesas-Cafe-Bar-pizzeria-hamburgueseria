const WEBHOOK = 'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';
const base = {
  nombre: 'Luis Figueras',
  direccion: 'Recogida en el local',
  cliente_telefono: '34600000000',
  items: [{ id: 4, qty: 1 }],
};
for (let i = 1; i <= 5; i += 1) {
  const r = await fetch(WEBHOOK, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base),
  });
  const t = await r.text();
  console.log('intento', i, '-> HTTP', r.status, t.slice(0, 90).replace(/\s+/g, ' '));
  if (r.status === 200) break;
  await new Promise((res) => setTimeout(res, 4000));
}
