import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, renameSync } from 'node:fs';
import path from 'node:path';

const DESCARGAS = 'C:/Users/luism/Downloads';
const REPO =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/docs/n8n';

const NUEVOS = [
  'n8n-crear-pedido-domicilio.json',
  'n8n-confirmacion-pago-stripe.json',
  'n8n-confirmacion-pago-stripe-sin-insert.json',
];

// ── 1) Comprobar que los 3 de Descargas son workflows validos ──
console.log('=== Verificacion de los 3 de Descargas ===');
for (const nombre of NUEVOS) {
  const p = path.join(DESCARGAS, nombre);
  if (!existsSync(p)) {
    console.log(`  ${nombre}: FALTA`);
    continue;
  }
  const wf = JSON.parse(readFileSync(p, 'utf8'));
  const nombres = wf.nodes.map((n) => n.name);
  const texto = JSON.stringify(wf);
  const refs = new Set(nombres);
  const rotas = [...texto.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]).filter((r) => !refs.has(r));
  console.log(`  ${nombre}`);
  console.log(`     workflow: ${wf.name} | activo: ${wf.active}`);
  console.log(`     nodos: ${nombres.length} | referencias rotas: ${rotas.length ? rotas.join(', ') : 'ninguna'}`);
  console.log(`     tiene detalle_texto: ${texto.includes('detalle_texto')} | email con asunto real: ${texto.includes('Nuevo pedido')}`);
}

// ── 2) Borrar los ficheros antiguos con el nombre viejo ──
console.log('\n=== Borrando los duplicados con el nombre antiguo ===');
for (const archivo of readdirSync(DESCARGAS)) {
  if (!archivo.toLowerCase().endsWith('.json')) continue;
  if (NUEVOS.includes(archivo)) continue;
  let wf;
  try {
    wf = JSON.parse(readFileSync(path.join(DESCARGAS, archivo), 'utf8'));
  } catch {
    continue;
  }
  if (!wf || !Array.isArray(wf.nodes)) continue;
  const nombres = wf.nodes.map((n) => n.name);
  const esNuestro =
    nombres.includes('Pago completado en Stripe') || nombres.some((n) => n.includes('Recibir pedido'));
  if (esNuestro) {
    unlinkSync(path.join(DESCARGAS, archivo));
    console.log(`  BORRADO "${archivo}"`);
  }
}

// ── 3) Sincronizar los nombres del repo con los de Descargas ──
console.log('\n=== Sincronizando el repo ===');
const equivalencias = [
  ['pedidos-domicilio-crear-pago.json', 'n8n-crear-pedido-domicilio.json'],
  ['pedidos-confirmacion-pago-stripe.json', 'n8n-confirmacion-pago-stripe.json'],
  [
    'pedidos-confirmacion-pago-stripe-sin-insert.json',
    'n8n-confirmacion-pago-stripe-sin-insert.json',
  ],
];
for (const [viejo, nuevo] of equivalencias) {
  const origen = path.join(REPO, viejo);
  const destino = path.join(REPO, nuevo);
  if (!existsSync(origen)) {
    if (existsSync(destino)) console.log(`  ${nuevo} ya estaba`);
    continue;
  }
  // Se copia el contenido de Descargas (fuente de verdad) al repo.
  writeFileSync(destino, readFileSync(path.join(DESCARGAS, nuevo)), 'utf8');
  unlinkSync(origen);
  console.log(`  ${viejo} -> ${nuevo}`);
}

// ── 4) Copia del README en el repo ──
writeFileSync(
  path.join(REPO, 'LEEME.md'),
  readFileSync(path.join(DESCARGAS, 'LEEME-workflows-n8n.md'), 'utf8'),
  'utf8',
);
console.log('  + LEEME.md');

console.log('\n=== Contenido final de la carpeta n8n del repo ===');
for (const f of readdirSync(REPO)) console.log(`  ${f}`);
