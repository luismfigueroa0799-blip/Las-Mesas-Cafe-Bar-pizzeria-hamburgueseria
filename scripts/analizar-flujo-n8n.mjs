import { readFileSync } from 'node:fs';

const f = process.argv[2];
const wf = JSON.parse(readFileSync(f, 'utf8'));

const nombres = wf.nodes.map((n) => n.name);
console.log('workflow:', wf.name, '| activo:', wf.active);
console.log('nodos:', nombres.join(' | '));

console.log('\n=== REFERENCIAS A NODOS QUE NO EXISTEN ===');
let rotos = 0;
for (const n of wf.nodes) {
  const txt = JSON.stringify(n.parameters ?? {});
  const re = /\$\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (!nombres.includes(m[1])) {
      console.log(`  ${n.name}  ->  $('${m[1]}')   *** NO EXISTE ***`);
      rotos += 1;
    }
  }
}
if (!rotos) console.log('  (ninguna)');

console.log('\n=== CONEXIONES (main) ===');
const conn = wf.connections ?? {};
for (const [origen, tipos] of Object.entries(conn)) {
  for (const [tipo, salidas] of Object.entries(tipos)) {
    for (const salida of salidas) {
      for (const c of salida.connections ?? []) {
        console.log(`  ${origen} --${tipo}--> ${c.node}`);
      }
    }
  }
}

console.log('\n=== NODO POSTGRES (Neon): parametros de conexion ===');
for (const n of wf.nodes) {
  if (n.type.includes('postgres')) {
    const p = n.parameters ?? {};
    console.log('  nodo:', n.name);
    for (const clave of ['host', 'port', 'database', 'user', 'password', 'schema', 'table', 'operation']) {
      if (p[clave] !== undefined) console.log(`    ${clave}: ${JSON.stringify(p[clave])}`);
    }
    console.log('    credenciales:', JSON.stringify(n.credentials));
    console.log('    parametros completos:', JSON.stringify(p).slice(0, 1500));
  }
}

console.log('\n=== NODO SUPABASE ===');
for (const n of wf.nodes) {
  if (n.type.includes('supabase')) {
    console.log('  nodo:', n.name, JSON.stringify(n.parameters), JSON.stringify(n.credentials));
  }
}
