// Comprueba si el nodo "Consultar productos" (Supabase) de los workflows de
// n8n funciona: si el webhook responde 400 (validacion) el flujo llego al
// nodo de validacion; si responde 500, fallo mas abajo.
const casos = [
  {
    flujo: 'crear-pedido-domicilio  (workflow de Neon)',
    url: 'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio',
    body: { nombre: 'Luis', direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 4, qty: 1 }] },
  },
  {
    flujo: 'crear-pedido  (workflow de mesa, mismo nodo Supabase)',
    url: 'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido',
    body: { nombre: 'Luis', direccion: 'Calle Mayor 24, 35018 Las Palmas', cliente_telefono: '34600000000', items: [{ id: 4, qty: 1 }] },
  },
];

for (const c of casos) {
  const r = await fetch(c.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c.body),
  });
  const t = await r.text();
  const interpretacion =
    r.status === 400
      ? 'OK -> llego al nodo de validacion (el de Supabase NO es el problema)'
      : r.status === 500
        ? 'FALLO -> reviso el nodo de Supabase / el nodo de codigo'
        : `-> HTTP ${r.status}`;
  console.log(`${c.flujo}\n   ${interpretacion}\n   ${t.slice(0, 140)}\n`);
}
