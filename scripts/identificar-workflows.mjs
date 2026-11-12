// Identifica cada workflow de n8n de la carpeta Downloads: de que flujo es,
// si tiene las correcciones y por que falla.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const archivos = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'));

for (const archivo of archivos) {
  const completo = path.join(dir, archivo);
  let wf;
  try {
    wf = JSON.parse(readFileSync(completo, 'utf8'));
  } catch {
    console.log(`\n### ${archivo}\n   (no es un JSON de n8n legible)`);
    continue;
  }
  if (!wf || !Array.isArray(wf.nodes)) {
    console.log(`\n### ${archivo}\n   (no parece un workflow de n8n)`);
    continue;
  }

  const st = statSync(completo);
  const nombres = wf.nodes.map((n) => n.name);
  const texto = JSON.stringify(wf);

  const webhook = wf.nodes.find((n) => n.type.includes('webhook'));
  const pathWebhook = webhook?.parameters?.path ?? '(sin webhook)';

  // Marcadores de correccion
  const refArreglada = texto.includes("$('Insert rows in a table')");
  const refVieja = texto.includes("$('Crear pedido a domicilio')");
  const tieneDetalle = texto.includes('detalle_texto');
  const tieneMetadataCompleto =
    texto.includes('metadata[cliente_nombre]') && texto.includes('metadata[items]');
  const tieneEditFields = nombres.includes('Edit Fields');
  const urlsEjemplo = texto.includes('example.com');

  // Problemas
  const problemas = [];
  const refs = new Set(nombres);
  for (const m of texto.matchAll(/\$\('([^']+)'\)/g)) {
    if (!refs.has(m[1]) && !problemas.includes(`referencia a nodo inexistente: ${m[1]}`)) {
      problemas.push(`referencia a nodo inexistente: ${m[1]}`);
    }
  }
  if (tieneEditFields) problemas.push('nodo "Edit Fields" con datos de prueba');
  if (urlsEjemplo) problemas.push('urls de retorno en example.com');
  if (!wf.active) problemas.push('DESACTIVADO (active: false)');

  console.log(`\n${'='.repeat(72)}`);
  console.log(`ARCHIVO : ${archivo}`);
  console.log(`        (${Math.round(st.size / 1024)} KB, modificado ${st.mtime.toLocaleString('es-ES')})`);
  console.log(`WORKFLOW: ${wf.name}`);
  console.log(`WEBHOOK : ${pathWebhook}   |  activo: ${wf.active}`);
  console.log(`NODOS   : ${nombres.join(' | ')}`);
  console.log(`CORRECCIONES:`);
  console.log(`   referencia al nodo de Neon (${refArreglada ? 'SI' : 'NO'})${refVieja ? ' / referencia VIEJA presente' : ''}`);
  console.log(`   detalle_texto / resumen ......... ${tieneDetalle ? 'SI' : 'NO'}`);
  console.log(`   metadata completo en Stripe ..... ${tieneMetadataCompleto ? 'SI' : 'NO'}`);
  console.log(`PROBLEMAS: ${problemas.length ? problemas.join(' | ') : 'ninguno'}`);
}
