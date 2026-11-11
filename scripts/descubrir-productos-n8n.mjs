/**
 * Descubre qué ids de producto acepta el webhook de n8n y con qué precio.
 *
 * Uso:  node scripts/descubrir-productos-n8n.mjs
 */
const WEBHOOK =
  process.env.N8N_WEBHOOK_URL ||
  'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';

const MAXIMO = Number(process.env.MAX_ID || 80);

async function probar(id) {
  const cuerpo = {
    nombre: 'Luis Test',
    direccion: 'Calle Mayor 24, 3 B, 35018 Las Palmas',
    cliente_telefono: '600000000',
    items: [{ id, qty: 1 }],
  };
  try {
    const respuesta = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(45000),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (datos.ok) return { id, precio: datos.total, pedido_id: datos.pedido_id };
    return null;
  } catch {
    return null;
  }
}

// Se prueban de 5 en 5 para no saturar n8n.
const encontrados = [];
for (let inicio = 1; inicio <= MAXIMO; inicio += 5) {
  const lote = [];
  for (let id = inicio; id < inicio + 5 && id <= MAXIMO; id += 1) {
    lote.push(probar(id));
  }
  const resultados = await Promise.all(lote);
  for (const r of resultados) {
    if (r) {
      encontrados.push(r);
      console.log(`  id=${String(r.id).padStart(3)}  precio=${r.precio} €  pedido_id=${r.pedido_id}`);
    }
  }
  process.stdout.write('.');
}

console.log('\n');
console.log(`Productos encontrados: ${encontrados.length}`);
console.log(JSON.stringify(encontrados, null, 2));
