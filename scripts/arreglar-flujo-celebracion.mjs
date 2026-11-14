// Arregla el flujo de n8n de las solicitudes de celebracion.
//
//   1) SIN argumentos: informa de como esta el flujo (nodos, conexiones y
//      todas las expresiones {{ ... }} que usa).
//   2) Con --aplicar: inserta un nodo "Code" que normaliza los datos
//      justo despues del webhook y deja todos los nodos (Postgres y
//      Telegram) leyendo de ahi, con las MISMAS expresiones en todos.
//
// Necesita la API key de n8n en la variable de entorno N8N_API_KEY.
// En n8n: Settings -> n8n API -> Create an API key (con permiso de escritura).
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = (process.env.N8N_BASE_URL ?? 'https://barcafeteria.app.n8n.cloud').replace(
  /\/+$/,
  '',
);
const API = BASE + '/api/v1';
const KEY = String(process.env.N8N_API_KEY ?? '').trim();
const CAMINO = 'solicitud-celebracion';
const aplicar = process.argv.includes('--aplicar');

if (!KEY) {
  console.error('Falta la variable N8N_API_KEY.');
  process.exit(1);
}

async function n8n(ruta, opciones = {}) {
  const r = await fetch(API + ruta, {
    ...opciones,
    headers: {
      'X-N8N-API-KEY': KEY,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) {
    console.error(`n8n ${opciones.method ?? 'GET'} ${ruta} -> HTTP ${r.status}`);
    console.error(texto.slice(0, 600));
    process.exit(1);
  }
  return texto ? JSON.parse(texto) : null;
}

// ── 1) Buscar el flujo del webhook ──
const lista = await n8n('/workflows?limit=100');
const candidatos = (lista.data ?? []).filter((w) =>
  (w.nodes ?? []).some(
    (n) => n.type === 'n8n-nodes-base.webhook' && String(n.parameters?.path ?? '') === CAMINO,
  ),
);
if (!candidatos.length) {
  console.error('No se ha encontrado ningun flujo con el webhook "' + CAMINO + '".');
  console.error('Flujos que hay:');
  for (const w of lista.data ?? []) console.error('  - ' + w.id + '  ' + w.name + '  activo=' + w.active);
  process.exit(1);
}
const flujo = await n8n('/workflows/' + candidatos[0].id);
console.log('Flujo: "' + flujo.name + '"  (id ' + flujo.id + ', activo=' + flujo.active + ')');
console.log('');

const nodos = flujo.nodes ?? [];
const conexiones = flujo.connections ?? {};

// ── 2) Informar ──
console.log('=== Nodos ===');
for (const n of nodos) {
  console.log(`  [${n.type}] "${n.name}"${n.disabled ? ' (DESACTIVADO)' : ''}`);
}
console.log('');
console.log('=== Conexiones ===');
for (const [origen, c] of Object.entries(conexiones)) {
  for (const salida of c.main ?? []) {
    for (const destino of salida ?? []) {
      console.log(`  ${origen}  ->  ${destino.node}`);
    }
  }
}
console.log('');
console.log('=== Expresiones {{ ... }} que usa cada nodo ===');
for (const n of nodos) {
  const texto = JSON.stringify(n.parameters ?? {});
  const encontradas = [...texto.matchAll(/\{\{([^}]*)\}\}/g)].map((m) => m[1].trim());
  if (!encontradas.length) continue;
  console.log(`  "${n.name}":`);
  for (const e of [...new Set(encontradas)]) console.log('      ' + e);
}

if (!aplicar) {
  console.log('\n(Para aplicar el arreglo: node scripts/arreglar-flujo-celebracion.mjs --aplicar)');
  process.exit(0);
}

// ── 3) Aplicar el arreglo ──
// El nodo Code normaliza: saca los datos de donde esten (raiz o body, objeto
// o texto) y los deja con el nombre de las columnas de la tabla.
const webhook = nodos.find(
  (n) => n.type === 'n8n-nodes-base.webhook' && String(n.parameters?.path ?? '') === CAMINO,
);
const idCode = 'Normalizar-solicitud';
const jsCode = `// Normaliza la solicitud de celebracion: deja los datos con el nombre de
// las columnas de la tabla solicitudes_celebracion, este donde estuvieran.
const salida = [];
for (const item of items) {
  const j = item.json ?? {};
  let b = j.body ?? j;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  const f = { ...j, ...b };
  salida.push({
    json: {
      nombre: f.nombre ?? '',
      contacto: f.contacto ?? '',
      tipo_evento: f.tipoEvento ?? f.tipo_evento ?? '',
      fecha_aproximada: f.fechaAproximada ?? f.fecha_aproximada ?? '',
      numero_personas: Number(f.numeroPersonas ?? f.numero_personas ?? 0),
      detalles: f.detalles ?? '',
    },
  });
}
return salida;`;

if (nodos.some((n) => n.name === idCode)) {
  console.log('\nEl flujo ya tiene el nodo "' + idCode + '". No se toca nada.');
  process.exit(0);
}

const nuevosNodos = nodos.map((n) => ({ ...n }));

// 3a) Quitar las conexiones que salían del webhook
const salidasWebhook = conexiones[webhook.name]?.main ?? [];
const destinos = [];
for (const s of salidasWebhook) for (const d of s ?? []) destinos.push(d.node);
delete conexiones[webhook.name];

// 3b) Insertar el nodo Code justo despues del webhook
const posWebhook = nuevosNodos.findIndex((n) => n.name === webhook.name);
nuevosNodos.splice(posWebhook + 1, 0, {
  parameters: { mode: 'runOnceForAllItems', jsCode },
  id: idCode,
  name: idCode,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [webhook.position?.[0] ?? 0, (webhook.position?.[1] ?? 0) + 180],
});

// 3c) El webhook va al Code, y el Code va a todos los que venian del webhook
conexiones[webhook.name] = { main: [[{ node: idCode, type: 'n8n-nodes-base.code', index: 0 }]] };
conexiones[idCode] = {
  main: [
    destinos.map((nombre) => ({
      node: nombre,
      type: nuevosNodos.find((n) => n.name === nombre)?.type ?? 'n8n-nodes-base.node',
      index: 0,
    })),
  ],
};

// 3d) Arreglar las expresiones: todas pasan a leerse del nodo Code
const TRADUCION = {
  nombre: 'nombre',
  contacto: 'contacto',
  tipoEvento: 'tipo_evento',
  fechaAproximada: 'fecha_aproximada',
  numeroPersonas: 'numero_personas',
  detalles: 'detalles',
};
let cambios = 0;
for (const n of nuevosNodos) {
  if (n.name === idCode) continue;
  let texto = JSON.stringify(n.parameters ?? {});
  let antes = texto;
  for (const [de, a] of Object.entries(TRADUCION)) {
    texto = texto.replaceAll(`{{ $json.body.${de} }}`, `{{ $json.${a} }}`);
    texto = texto.replaceAll(`{{ $json.${de} }}`, `{{ $json.${a} }}`);
    texto = texto.replaceAll(`{{$json.body.${de}}}`, `{{ $json.${a} }}`);
    texto = texto.replaceAll(`{{$json.${de}}}`, `{{ $json.${a} }}`);
  }
  if (texto !== antes) {
    n.parameters = JSON.parse(texto);
    cambios += 1;
  }
}

console.log(`\nNodos con expresiones corregidos: ${cambios}`);
console.log('Destinos que ahora cuelgan del nodo Code: ' + destinos.join(', '));

// 3e) Subir el flujo
await n8n('/workflows/' + flujo.id, {
  method: 'PUT',
  body: JSON.stringify({
    name: flujo.name,
    nodes: nuevosNodos,
    connections: conexiones,
    settings: flujo.settings ?? {},
    staticData: flujo.staticData,
  }),
});
console.log('Flujo actualizado.');

// 3f) Dejarlo activo
if (!flujo.active) {
  await n8n('/workflows/' + flujo.id + '/activate', { method: 'POST' });
  console.log('Flujo activado.');
}

// 3g) Guardar copia local
const copia = 'scripts/n8n-celebracion-arreglado.json';
writeFileSync(copia, JSON.stringify(flujo, null, 2), 'utf8');
console.log('Copia del flujo original guardada en ' + copia);
