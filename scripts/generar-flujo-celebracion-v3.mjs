// Version v3 del flujo: el nodo Code construye el TEXTO del aviso completo,
// asi que el nodo de Telegram solo tiene que pintar una cosa:
//     ={{ $json.mensaje }}
//
// Sin "??", sin "body", sin adivinar donde esta cada campo: el Code pone
// el mensaje entero en una propiedad y ya.
//
//   Webhook -> Code "Preparar aviso" -> [ Postgres, Telegram ]
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN =
  process.env.FLUJO_ORIGEN ?? 'C:/Users/luism/Downloads/My workflow.json';
const DESTINO =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/scripts/n8n-solicitud-celebracion-v3.json';

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
  id: 'c3d9e8f1-2a4b-4c6d-8e0f-1a2b3c4d5e6f',
  name: 'Preparar aviso',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [224, 80],
};

// ── Postgres: el Code ya deja los campos con el nombre de las columnas ──
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

// ── Telegram: una sola expresion ──
telegram.parameters.text = '={{ $json.mensaje }}';

webhook.position = [0, 80];
postgres.position = [448, 0];
telegram.position = [448, 160];

flujo.nodes = flujo.nodes.filter((n) => n.type !== 'n8n-nodes-base.code');
flujo.nodes = flujo.nodes.filter((n) => n !== postgres && n !== telegram);
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

flujo.name = 'Solicitud de celebración (v3)';
flujo.active = false;

writeFileSync(DESTINO, JSON.stringify(flujo, null, 2), 'utf8');
console.log('Generado: ' + DESTINO);
console.log('');
console.log('Telegram: ' + telegram.parameters.text);
console.log('Postgres:');
for (const [c, v] of Object.entries(postgres.parameters.columns.value)) {
  console.log('  ' + c.padEnd(19) + ' = ' + v);
}
