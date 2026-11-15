// Version v4 del flujo: ademas del aviso a Telegram, el flujo RESPONDE al
// webhook con el objeto ya normalizado. Asi se puede ver (con un simple
// POST) exactamente que tiene n8n, sin capturas de pantalla.
//
//   Webhook -> Preparar aviso (Code) -+-> Insert rows in a table
//                                    +-> Send a text message
//                                    +-> Respond to Webhook  (devuelve el objeto)
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN =
  process.env.FLUJO_ORIGEN ?? 'C:/Users/luism/Downloads/My workflow.json';
const DESTINO =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/scripts/n8n-solicitud-celebracion-v4.json';

const flujo = JSON.parse(readFileSync(ORIGEN, 'utf8'));

const CODIGO_JS = `// Prepara la solicitud de celebracion: saca los datos de donde esten (raiz,
// body, o body como texto) y deja el aviso escrito en una sola propiedad.
const salida = [];

for (const item of items) {
  const j = item.json ?? {};
  let b = j.body ?? j;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  const f = { ...j, ...b };

  const nombre = String(f.nombre ?? '');
  const contacto = String(f.contacto ?? '');
  const tipo = String(f.tipoEvento ?? f.tipo_evento ?? '');
  const fecha = String(f.fechaAproximada ?? f.fecha_aproximada ?? '');
  const personas = Number(f.numeroPersonas ?? f.numero_personas ?? 0);
  const detalles = String(f.detalles ?? '');

  salida.push({
    json: {
      // Lo que veia el webhook, para poder diagnosticarlo.
      _origen: j,
      nombre,
      contacto,
      tipo_evento: tipo,
      fecha_aproximada: fecha,
      numero_personas: personas,
      detalles,
      mensaje:
        '🎉 ¡NUEVA SOLICITUD DE CELEBRACIÓN! 🎉\\n\\n' +
        '👤 Nombre: ' + nombre + '\\n' +
        '📞 Contacto: ' + contacto + '\\n' +
        '🎊 Tipo: ' + tipo + '\\n' +
        '📅 Fecha: ' + fecha + '\\n' +
        '👥 Personas: ' + personas + '\\n\\n' +
        '📝 Detalles: ' + detalles,
    },
  });
}

return salida;`;

const webhook = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
const postgres = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.postgres');
const telegram = flujo.nodes.find((n) => n.type === 'n8n-nodes-base.telegram');

const nodoCode = {
  parameters: { mode: 'runOnceForAllItems', jsCode: CODIGO_JS },
  id: 'd4e0f9a2-3b5c-4d7e-9f1a-2b3c4d5e6f7a',
  name: 'Preparar aviso',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [224, 80],
};

// El nodo que responde al webhook con el objeto normalizado.
const nodoResponder = {
  parameters: {
    respondWith: 'json',
    responseBody: '={{ JSON.stringify($json) }}',
    options: {},
  },
  id: 'e5f1a0b3-4c6d-4e8f-0a1b-3c4d5e6f7a8b',
  name: 'Ver datos',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position: [448, 320],
};

const MAPA = {
  nombre: 'nombre',
  contacto: 'contacto',
  tipo_evento: 'tipo_evento',
  fecha_aproximada: 'fecha_aproximada',
  numero_personas: 'numero_personas',
  detalles: 'detalles',
};
for (const [columna, campo] of Object.entries(MAPA)) {
  if (!postgres.parameters.columns.value[columna]) continue;
  postgres.parameters.columns.value[columna] = '={{ $json.' + campo + ' }}';
}

telegram.parameters.text = '={{ $json.mensaje }}';

// El Webhook tiene que dejar la respuesta al nodo "Ver datos"
// (Respond to Webhook). Sin esto, ese nodo falla y el flujo entero da 500.
webhook.parameters.responseMode = 'responseNode';
webhook.position = [0, 80];
postgres.position = [448, 0];
telegram.position = [448, 160];

flujo.nodes = flujo.nodes.filter((n) => n.type !== 'n8n-nodes-base.code');
flujo.nodes = flujo.nodes.filter((n) => n !== postgres && n !== telegram);
flujo.nodes.push(nodoCode, postgres, telegram, nodoResponder);

flujo.connections = {
  [webhook.name]: {
    main: [[{ node: nodoCode.name, type: nodoCode.type, index: 0 }]],
  },
  [nodoCode.name]: {
    main: [
      [
        { node: postgres.name, type: postgres.type, index: 0 },
        { node: telegram.name, type: telegram.type, index: 0 },
        { node: nodoResponder.name, type: nodoResponder.type, index: 0 },
      ],
    ],
  },
};

flujo.name = 'Solicitud de celebración (v4)';
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
console.log('Telegram: ' + telegram.parameters.text);
