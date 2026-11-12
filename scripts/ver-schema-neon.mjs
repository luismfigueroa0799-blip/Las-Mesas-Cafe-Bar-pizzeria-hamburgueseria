import { readFileSync } from 'node:fs';

const wf = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const n of wf.nodes) {
  if (n.type.includes('postgres')) {
    const cols = n.parameters?.columns?.schema ?? [];
    console.log('=== TABLA', n.parameters?.table?.value, '===');
    console.log('columna'.padEnd(20), 'tipo'.padEnd(12), 'obligatoria', 'por defecto');
    for (const c of cols) {
      console.log(
        String(c.displayName).padEnd(20),
        String(c.type).padEnd(12),
        String(c.required).padEnd(11),
        String(c.defaultMatch ?? ''),
      );
    }
    console.log('\nmapeo actual:');
    console.log(JSON.stringify(n.parameters?.columns?.value, null, 1));
  }
}
