import { readFileSync, writeFileSync } from 'node:fs';

const f = process.argv[2];
const wf = JSON.parse(readFileSync(f, 'utf8'));

const nodo = wf.nodes.find((n) => n.name === 'Insert rows in a table');
const schema = nodo.parameters.columns.schema;
const existentes = new Set(schema.map((c) => c.id));

// El nodo genera el INSERT solo con las columnas de su schema, asi que
// hay que declarar las que faltan en la tabla `pedidos` de Neon.
const nuevas = [
  { id: 'cliente_telefono', displayName: 'cliente_telefono', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
  { id: 'total', displayName: 'total', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true, removed: false },
  { id: 'tipo_entrega', displayName: 'tipo_entrega', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
];

let anadidas = 0;
for (const c of nuevas) {
  if (!existentes.has(c.id)) {
    schema.push(c);
    anadidas += 1;
  }
}

// El orden de las columnas del schema debe seguir al del mapeo.
const orden = Object.keys(nodo.parameters.columns.value).filter((k) => k !== 'id');
nodo.parameters.columns.schema.sort((a, b) => {
  const ia = orden.indexOf(a.id);
  const ib = orden.indexOf(b.id);
  if (ia === -1 && ib === -1) return 0;
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
});

writeFileSync(f, JSON.stringify(wf, null, 2), 'utf8');
console.log('columnas anadidas al schema del nodo Postgres:', anadidas);
console.log('schema final:', schema.map((c) => c.id).join(', '));
