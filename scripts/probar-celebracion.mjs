// Prueba del formulario de solicitud de celebracion contra la API desplegada.
//
//   node scripts/probar-celebracion.mjs
//
// Comprueba:
//   1) que la API rechaza los datos incompletos (400),
//   2) que la API reenvia al webhook de n8n y devuelve el error de n8n
//      si el flujo no esta activo,
//   3) el mensaje de exito cuando el flujo responde bien.
const BASE =
  process.env.BASE_URL ??
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';

const completa = {
  nombre: 'Prueba tecnica',
  contacto: '+34 600 000 000',
  tipoEvento: 'Cumpleaños',
  fechaAproximada: '2026-12-24',
  numeroPersonas: 10,
  detalles: 'Prueba automatica del formulario de celebracion (se puede borrar).',
};

async function llamar(cuerpo, etiqueta) {
  const r = await fetch(BASE + '/api/solicitud-celebracion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const t = await r.text();
  console.log(`   ${etiqueta}: HTTP ${r.status}  ${t.slice(0, 300)}`);
  return { r, t };
}

console.log('1) Sin nombre (debe ser 400):');
await llamar({ ...completa, nombre: '' }, 'sin nombre');

console.log('\n2) Sin numero de personas (debe ser 400):');
await llamar({ ...completa, numeroPersonas: 0 }, 'sin personas');

console.log('\n3) Metodo incorrecto (debe ser 405):');
const r405 = await fetch(BASE + '/api/solicitud-celebracion', { method: 'GET' });
console.log(`   GET: HTTP ${r405.status}  ${(await r405.text()).slice(0, 200)}`);

console.log('\n4) Solicitud completa (va al webhook de n8n):');
await llamar(completa, 'completa');
