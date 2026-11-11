/**
 * Muestra la configuración de pedidos activa (para comprobar qué URL de n8n se
 * va a usar). No hace falta desplegar nada.
 *
 * Uso:  node scripts/ver-config-pedidos.mjs
 */
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', 'artifacts', 'las-mesas');
const repoRaiz = path.resolve(raiz, '..', '..');

function localizarEsbuild() {
  const directo = path.join(repoRaiz, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (existsSync(directo)) return directo;
  const almacen = path.join(repoRaiz, 'node_modules', '.pnpm');
  if (!existsSync(almacen)) return null;
  const carpeta = readdirSync(almacen).find((n) => n.startsWith('esbuild@'));
  if (!carpeta) return null;
  const ruta = path.join(almacen, carpeta, 'node_modules', 'esbuild', 'lib', 'main.js');
  return existsSync(ruta) ? ruta : null;
}

const rutaEsbuild = localizarEsbuild();
if (!rutaEsbuild) {
  console.error('No se localizo esbuild. Ejecuta pnpm install en el repositorio.');
  process.exit(1);
}
const esbuildMod = await import(pathToFileURL(rutaEsbuild).href);
const build = esbuildMod.build ?? esbuildMod.default.build;

const salida = path.join(process.env.TEMP || '.', 'pedidos-config.mjs');
await build({
  entryPoints: [path.join(raiz, 'src', 'pedidos.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: salida,
  logLevel: 'error',
  define: { 'import.meta.env.VITE_N8N_WEBHOOK_URL': 'undefined' },
});

const { PEDIDOS, USAR_WEBHOOK_DE_PRUEBAS } = await import(pathToFileURL(salida).href);

console.log('Configuración de pedidos');
console.log('-------------------------');
console.log('activo                :', PEDIDOS.activo);
console.log('flag de pruebas       :', USAR_WEBHOOK_DE_PRUEBAS);
console.log('webhook en uso        :', PEDIDOS.webhook);
console.log('webhook de producción :', PEDIDOS.webhookProduccion);
console.log('webhook de pruebas    :', PEDIDOS.webhookPruebas);
console.log('');
console.log(
  PEDIDOS.webhook === PEDIDOS.webhookProduccion
    ? 'Se está usando la URL de PRODUCCIÓN (el workflow de n8n debe estar activo).'
    : 'Se está usando la URL de PRUEBAS (pulsa "Execute workflow" en n8n antes de pagar).',
);
