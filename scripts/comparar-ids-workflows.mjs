// Comprueba el id de workflow de cada archivo y si se solapan (importar dos
// workflows con el MISMO id sobrescribe el anterior).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dirs = process.argv.slice(2);
const todos = [];

for (const dir of dirs) {
  for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.json'))) {
    const p = path.join(dir, f);
    let wf;
    try {
      wf = JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      continue;
    }
    if (!wf || !Array.isArray(wf.nodes)) continue;
    const creds = new Set();
    for (const n of wf.nodes) {
      if (n.credentials) for (const [k, v] of Object.entries(n.credentials)) creds.add(`${k}: ${v.name}`);
    }
    todos.push({
      archivo: f,
      dir,
      id: wf.id,
      nombre: wf.name,
      activo: wf.active,
      webhook: wf.nodes.find((n) => n.type.includes('webhook'))?.parameters?.path ?? '-',
      nodos: wf.nodes.length,
      credenciales: [...creds],
    });
  }
}

console.log('=== WORKFLOWS ENCONTRADOS ===');
for (const w of todos) {
  console.log(`\n${w.archivo}`);
  console.log(`   id de workflow : ${w.id}`);
  console.log(`   nombre         : ${w.nombre}`);
  console.log(`   webhook        : ${w.webhook}   |  nodos: ${w.nodos}  |  activo: ${w.activo}`);
  console.log(`   credenciales   : ${w.credenciales.join(', ')}`);
}

console.log('\n=== IDs REPETIDOS (importar uno sobrescribe el otro) ===');
const porId = new Map();
for (const w of todos) {
  if (!w.id) continue;
  porId.set(w.id, [...(porId.get(w.id) ?? []), w.archivo]);
}
let repetidos = 0;
for (const [id, archivos] of porId) {
  if (archivos.length > 1) {
    repetidos += 1;
    console.log(`  id ${id}:`);
    for (const a of archivos) console.log(`      - ${a}`);
  }
}
if (!repetidos) console.log('  (ninguno)');
