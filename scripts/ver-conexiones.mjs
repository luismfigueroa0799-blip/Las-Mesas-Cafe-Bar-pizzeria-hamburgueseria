import { readFileSync } from 'node:fs';

const wf = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log('claves del workflow:', Object.keys(wf).join(', '));
console.log('\n=== wf.connections (crudo) ===');
console.log(JSON.stringify(wf.connections, null, 1).slice(0, 3000));
