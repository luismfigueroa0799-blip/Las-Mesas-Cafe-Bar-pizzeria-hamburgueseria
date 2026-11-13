import { readFileSync, writeFileSync } from 'node:fs';

// Actualiza el workflow de creacion de pedidos para que la carta se lea de
// NEON (tabla products) y no de Supabase.
//
// Motivo: los productos se han movido a Neon (id, name, description, price,
// image_url, is_available, category_id) y el panel de inventario cambia
// ahi el campo is_available. Si el flujo sigue leyendo la tabla de Supabase,
// los ids no coinciden y el flujo rechazaria el pedido con "El producto X no
// existe".
//
// Cambios:
//  1) "Consultar productos": de Supabase a Postgres (Neon), tabla products.
//  2) "Recalcular precio real": lee price e is_available (con兼容 con los
//     nombres antiguos por si el flujo sigue leyendo de Supabase).

const origen = process.argv[2];
const destino = process.argv[3];

const wf = JSON.parse(readFileSync(origen, 'utf8'));
const nodo = (nombre) => wf.nodes.find((n) => n.name === nombre);
const cambios = [];

// ── 1) El nodo de productos pasa a Neon ──
const consultar = nodo('Consultar productos');
if (consultar) {
  consultar.type = 'n8n-nodes-base.postgres';
  consultar.typeVersion = 2.8;
  consultar.credentials = { postgres: { id: '1X9SZfp6WIb993oR', name: 'Postgres account' } };
  consultar.parameters = {
    operation: 'getAll',
    schema: { __rl: true, mode: 'list', value: 'public' },
    table: { __rl: true, value: 'products', mode: 'list', cachedResultName: 'products' },
    columns: { mappingMode: 'autoMapInputData' },
    options: { queryBatching: 'single' },
  };
  cambios.push('"Consultar productos" ahora lee la tabla products de Neon (Postgres)');
}

// ── 2) El codigo que recalcula el precio ──
const recalcular = nodo('Recalcular precio real');
if (recalcular) {
  const js = recalcular.parameters.jsCode;

  const antesProducto = `  const prod = productos.find(function (p) { return String(p.id) === String(it.id); });
  if (!prod) return rechazar(400, 'El producto ' + it.id + ' no existe.');
  if (prod.disponible !== true) return rechazar(409, 'El producto ' + (prod.nombre || it.id) + ' no esta disponible.');
  const precio = Number(prod.precio);`;

  const despuesProducto = `  const prod = productos.find(function (p) { return String(p.id) === String(it.id); });
  if (!prod) return rechazar(400, 'El producto ' + it.id + ' no existe.');
  // La tabla products de Neon usa price e is_available; los nombres antiguos
  // se siguen admitiendo por si el flujo lee de Supabase.
  const nombreProd = prod.name !== undefined ? prod.name : prod.nombre;
  const disponible = prod.is_available !== undefined
    ? prod.is_available !== false
    : prod.disponible !== false;
  if (!disponible) return rechazar(409, 'El producto ' + (nombreProd || it.id) + ' no esta disponible.');
  const precio = Number(prod.price !== undefined ? prod.price : prod.precio);`;

  if (js.includes(antesProducto)) {
    recalcular.parameters.jsCode = js.replace(antesProducto, despuesProducto);
  } else {
    console.log('AVISO: el bloque del producto no coincide (revisar a mano)');
  }

  // El nombre que se guarda en la linea del pedido.
  const antesNombre = `    nombre: prod.nombre !== undefined ? prod.nombre : null,`;
  const despuesNombre = `    nombre: prod.name !== undefined ? prod.name : (prod.nombre !== undefined ? prod.nombre : null),`;
  if (recalcular.parameters.jsCode.includes(antesNombre)) {
    recalcular.parameters.jsCode = recalcular.parameters.jsCode.replace(
      antesNombre,
      despuesNombre,
    );
  } else {
    console.log('AVISO: el bloque del nombre no coincide (revisar a mano)');
  }

  cambios.push('"Recalcular precio real" lee price e is_available');
}

writeFileSync(destino, JSON.stringify(wf, null, 2), 'utf8');
console.log('Workflow actualizado guardado en:', destino);
for (const c of cambios) console.log('  +', c);
