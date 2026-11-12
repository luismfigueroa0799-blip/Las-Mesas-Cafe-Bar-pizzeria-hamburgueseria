// Encuentra que campo del body rompe el flujo de n8n: manda el body minimo
// (el que el flujo acepta) y va anadiendo un campo cada vez.
const WEBHOOK = 'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';

const base = {
  nombre: 'Luis Figueras',
  direccion: 'Recogida en el local',
  cliente_telefono: '34600000000',
  items: [{ id: 4, qty: 1 }],
};

const extras = {
  'total (numero)': { total: 9.5 },
  'total (texto)': { total: '9.50' },
  'cliente_nombre': { cliente_nombre: 'Luis Figueras' },
  'telefono': { telefono: '34600000000' },
  'order_code': { order_code: 'PED-TEST' },
  'items con nombre/precio': {
    items: [{ id: 4, qty: 1, cantidad: 1, nombre: 'La suprema', name: 'La suprema', precio: 6.5, price: 6.5 }],
  },
  'detalle (array)': { detalle: [{ id: 4, nombre: 'La suprema', cantidad: 1, qty: 1, precio: '6,50 €' }] },
  'articulos (array)': { articulos: [{ id: 4, name: 'La suprema', qty: 1, price: '6,50 €' }] },
  'detalle_texto': { detalle_texto: 'La suprema - 6,50 €' },
  'resumen': { resumen: 'Cliente: Luis' },
  'numArticulos': { numArticulos: '1' },
  'evento': { evento: 'pedido.creado' },
  'idPedido': { idPedido: 'x' },
  'correo': { correo: 'luis@gmail.com' },
  'tipoEntrega': { tipoEntrega: 'recogida' },
  'recogida/domicilio': { recogida: true, domicilio: false },
  'subtotal': { subtotal: 9.5 },
  'impuestos': { impuestos: 0 },
  'metodoPago': { metodoPago: 'card' },
  'urlOrigen': { urlOrigen: 'https://x' },
  'restaurante': { restaurante: 'Las Mesas' },
  'modoRecogida': { modoRecogida: 'recogida' },
  'success_url': { success_url: 'https://x/?pedido=ok' },
  'unit_cents en items': {
    items: [{ id: 4, qty: 1, unit_cents: 650, subtotal_cents: 650 }],
  },
};

async function probar(etiqueta, cuerpo) {
  try {
    const r = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const t = await r.text();
    let ok = false;
    try { ok = JSON.parse(t)?.ok === true; } catch { /* nada */ }
    return { etiqueta, http: r.status, ok, cuerpo: t.slice(0, 110) };
  } catch (e) {
    return { etiqueta, http: 0, ok: false, cuerpo: String(e.message).slice(0, 80) };
  }
}

// 1) El body minimo, tal cual lo mandaba antes
const minimo = await probar('SOLO el body minimo (sin cambios)', base);
console.log('minimo      ->', minimo.http, minimo.ok ? 'OK' : 'FALLO', minimo.cuerpo);

// 2) Cada extra por separado
console.log('\n--- anadiendo un campo cada vez ---');
const fallos = [];
for (const [etiqueta, extra] of Object.entries(extras)) {
  const r = await probar(etiqueta, { ...base, ...extra });
  const marca = r.ok ? 'OK   ' : 'FALLO';
  console.log(`  ${marca} ${etiqueta.padEnd(26)} HTTP ${r.http}  ${r.cuerpo}`);
  if (!r.ok) fallos.push({ etiqueta, ...r });
}

console.log('\n=== CAMPOS QUE ROMPEN EL FLUJO ===');
if (!fallos.length) console.log('  (ninguno)');
for (const f of fallos) console.log(`  ${f.etiqueta} -> HTTP ${f.http}: ${f.cuerpo}`);
