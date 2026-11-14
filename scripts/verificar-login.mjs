import { readFileSync } from 'node:fs';

const t = readFileSync(
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/src/admin/Login.tsx',
  'utf8',
);

console.log('=== Lo que NO debe aparecer ===');
const prohibido = ['type="email"', 'Registrarse', 'Recuperar', 'olvid', 'Forgot', 'Crear cuenta'];
for (const p of prohibido) {
  console.log(`  ${p.padEnd(16)} ${t.includes(p) ? 'HAY (mal)' : 'no'}`);
}

console.log('\n=== Lo que SI debe estar ===');
for (const p of ['signInWithPassword', 'EMAIL_STAFF', 'type="password"', 'current-password', 'autoFocus']) {
  console.log(`  ${p.padEnd(22)} ${t.includes(p) ? 'si' : 'FALTA'}`);
}

console.log('\n=== Cuentas ===');
console.log('  inputs de tipo email :', (t.match(/type="email"/g) || []).length);
console.log('  inputs totales      :', (t.match(/<input/g) || []).length);
console.log('  botones <button>    :', (t.match(/<button/g) || []).length);
const m = /signInWithPassword\(\{\s*email:\s*([^,]+),\s*password/.exec(t);
console.log('  signInWithPassword usa:', m ? m[1].trim() : '(no encontrado)');
