// Genera la version BLINDADA del flujo de n8n: mete un nodo Code entre el
// webhook y los demas, para que el Postgres y el Telegram reciban SIEMPRE
// el mismo objeto, este donde esten.
//
//   Webhook -> Code "Normalizar solicitud" -> [ Postgres, Telegram ]
//
// Salida: scripts/n8n-solicitud-celebracion-v2.json
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN =
  process.env.FLUJO_ORIGEN ?? 'C:/Users/luism/Downloads/My workflow.json';
const DESTINO =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/scripts/n8n-solicitud-celebracion-v2.json';

const flujo = JSON.parse(readFileSync(ORIGEN, 'utf8'));

const CODIGO_JS = `// Normaliza la solicitud de celebracion: deja los datos con el nombre de
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

/** Nombres que produce el nodo Code (los de las columnas de la tabla). */
const EXPRESIONES = {
  nombre: '{{ $json.nombre ?? $json.body.nombre }}',
  contacto: '{{ $json.contacto ?? $json.body.contacto }}',
  tipo_evento:
    '{{ $json.tipo_evento ?? $json.tipoEvento ?? $json.body.tipoEvento ?? $json.body.tipo_evento }}',
  fecha_aproximada:
    '{{ $json.fecha_aproximada ?? $json.fechaAproximada ?? $json.body.fechaAproximada }}',
  numero_personas:
    '{{ $json.numero_personas ?? $json.numeroPersonas ?? $json.body.numeroPersonas }}',
  detalles: '{{ $json.detalles ?? $json.body.detalles }}',
};

const webhook = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
const postgres = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.postgres');
const telegram = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.telegram');

// ── El nodo Code ──
const nodoCode = {
  parameters: { mode: 'runOnceForAllItems', jsCode: CODIGO_JS },
  id: 'b7f3c1a2-4d5e-4f60-9a1b-8c2d3e4f5a6b',
  name: 'Normalizar solicitud',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [224, 80],
};

// ── Expresiones ──
for (const [columna, expresion] of Object.entries(EXPRESIONES)) {
  if (!postgres.parameters.columns.value[columna]) continue;
  postgres.parameters.columns.value[columna] = '=' + expresion;
}
telegram.parameters.text =
  '=🎉 ¡NUEVA SOLICITUD DE CELEBRACIÓN! 🎉\n\n' +
  '👤 Nombre: ' + EXPRESIONES.nombre + '\n' +
  '📞 Contacto: ' + EXPRESIONES.contacto + '\n' +
  '🎊 Tipo: ' + EXPRESIONES.tipo_evento + '\n' +
  '📅 Fecha: ' + EXPRESIONES.fecha_aproximada + '\n' +
  '👥 Personas: ' + EXPRESIONES.numero_personas + '\n\n' +
  '📝 Detalles: ' + EXPRESIONES.detalles;

// ── Posiciones para que se lea bien ──
webhook.position = [0, 80];
postgres.position = [448, 0];
telegram.position = [448, 160];

// ── Nodos: webhook -> code -> [postgres, telegram] ──
flujo.nodes = flujo.nodes.filter((n) => n !== postgres && n !== telegram);
flujo.nodes = flujo.nodes.filter((n) => n.type !== 'n8n-nodes-base.code');
flujo.nodes.push(nodoCode, postgres, telegram);

flujo.connections = {
  [webhook.name]: {
    main: [[{ node: nodoCode.name, type: nodoCode.type, index: 0 }]],
  },
  [nodoCode.name]: {
    main: [
      [
        { node: postgres.name, type: postgres.type, index: 0 },
        { node: telegram.name, type: telegram.type, index: 0 },
      ],
    ],
  },
};

flujo.name = 'Solicitud de celebración (v2)';
flujo.active = false;

writeFileSync(DESTINO, JSON.stringify(flujo, null, 2), 'utf8');
console.log('Generado: ' + DESTINO);
console.log('');
console.log('Nodos:');
for (const n of flujo.nodes) console.log('  [' + n.type + '] ' + n.name);
console.log('');
console.log('Conexiones:');
for (const [k, c] of Object.entries(flujo.connections)) {
  for (const s of c.main ?? []) for (const d of s ?? []) console.log('  ' + k + ' -> ' + d.node);
}
console.log('');
console.log('Postgres:');
for (const [c, v] of Object.entries(postgres.parameters.columns.value)) {
  console.log('  ' + c.padEnd(19) + ' = ' + v);
}
