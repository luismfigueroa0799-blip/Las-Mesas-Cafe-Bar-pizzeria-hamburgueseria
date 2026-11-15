const fs = require('fs');
const base = 'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/docs/n8n/';
const archivos = [
  'n8n-confirmacion-pago-stripe.json',
  'n8n-confirmacion-pago-stripe-sin-insert.json',
];
for (const f of archivos) {
  const j = JSON.parse(fs.readFileSync(base + f, 'utf8'));
  console.log('=============================================');
  console.log(f);
  console.log('name:', j.name);
  console.log('ACTIVE:', j.active);
  console.log('--- NODOS ---');
  for (const n of j.nodes || []) {
    console.log('  [' + n.type + '] ' + n.name);
    if (n.type === 'n8n-nodes-base.httpRequest') {
      console.log('      PARAMETROS HTTP:', JSON.stringify(n.parameters));
    }
    if (n.type === 'n8n-nodes-base.telegram') {
      console.log('      PARAMETROS TELEGRAM:', JSON.stringify(n.parameters));
    }
  }
  console.log('--- CONEXIONES ---');
  for (const k of Object.keys(j.connections || {})) {
    for (const s of j.connections[k].main || []) {
      for (const d of s || []) console.log('   ' + k + ' -> ' + d.node);
    }
  }
}
