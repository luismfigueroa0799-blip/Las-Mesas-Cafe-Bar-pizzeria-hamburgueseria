// Vuelca un workflow de n8n: nodos, conexiones, expresiones y credenciales.
import { readFileSync } from 'node:fs';

const wf = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log('='.repeat(70));
console.log('WORKFLOW:', wf.name);
console.log('activo:', wf.active, '| id:', wf.id);
console.log('='.repeat(70));

console.log('\n=== NODOS ===');
for (const n of wf.nodes) {
  console.log(`\n--- ${n.name}  [${n.type} v${n.typeVersion}]`);
  if (n.credentials) {
    console.log('    credenciales:', Object.entries(n.credentials).map(([k, v]) => `${k}=${v.name}`).join(', '));
  }
  if (n.disabled) console.log('    DESACTIVADO');
  const p = n.parameters ?? {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'options' && v && Object.keys(v).length === 0) continue;
    const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
    console.log(`    ${k}: ${t}`);
  }
}

console.log('\n\n=== CONEXIONES ===');
for (const [origen, tipos] of Object.entries(wf.connections ?? {})) {
  for (const [tipo, salidas] of Object.entries(tipos)) {
    salidas.forEach((salida, i) => {
      for (const c of salida.connections ?? []) {
        console.log(`  ${origen} --[${tipo}:${i}]--> ${c.node}`);
      }
    });
  }
}

console.log('\n\n=== REFERENCIAS A NODOS INEXISTENTES ===');
const nombres = wf.nodes.map((n) => n.name);
let rotos = 0;
for (const n of wf.nodes) {
  const txt = JSON.stringify(n.parameters ?? {});
  const re = /\$\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (!nombres.includes(m[1])) {
      console.log(`  ${n.name} -> $('${m[1]}')  *** NO EXISTE ***`);
      rotos += 1;
    }
  }
}
if (!rotos) console.log('  (ninguna)');
