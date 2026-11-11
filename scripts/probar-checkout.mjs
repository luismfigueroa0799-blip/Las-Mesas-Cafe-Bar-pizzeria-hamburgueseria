// Prueba local del handler /api/checkout contra la API real de Stripe.
// Uso:  node --experimental-strip-types scripts/probar-checkout.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', 'artifacts', 'las-mesas');

// Clave de prueba leída del entorno (no se escribe en el repo).
const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Falta STRIPE_SECRET_KEY en el entorno.');
  process.exit(1);
}
process.env.STRIPE_SECRET_KEY = secretKey;
process.env.NEXT_PUBLIC_URL = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app';

// Cargamos el handler compilando el TS al vuelo con esbuild (ya está en el repo).
const { readdirSync, existsSync } = await import('node:fs');
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
const esbuildUrl = pathToFileURL(rutaEsbuild).href;
const esbuildMod = await import(esbuildUrl);
const build = esbuildMod.build ?? esbuildMod.default.build;
const salida = path.join(process.env.TEMP || '.', 'checkout-prueba.mjs');
await build({
  entryPoints: [path.join(raiz, 'api', 'checkout.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: salida,
  logLevel: 'error',
});

const { default: handler } = await import(pathToFileURL(salida).href);

const peticion = {
  method: 'POST',
  headers: { get: () => 'localhost' },
  json: async () => ({
    items: [
      { id: 'pc-3', name: 'Burger Pizza', price: '12,00 €', quantity: 1 },
      { id: 'cz-1', name: 'Tropical', price: '1,40 €', quantity: 2 },
    ],
    customerEmail: 'cliente@ejemplo.com',
    customerName: 'Ana Pérez',
    telefono: '600 00 00 00',
    tipoEntrega: 'domicilio',
    direccion: {
      calle: 'Calle Mayor',
      numero: '24',
      piso: '3º B',
      codigoPostal: '35018',
      ciudad: 'Las Palmas de Gran Canaria',
    },
    mesa: '',
    urlOrigen: 'https://ejemplo.com/app',
  }),
};

const respuesta = await handler(peticion);
console.log('Estado:', respuesta.status);
const cuerpo = await respuesta.json();
console.log('Claves:', Object.keys(cuerpo).join(', '));
console.log('sessionId:', cuerpo.sessionId ?? '(ninguno)');
console.log('url:', cuerpo.url ?? '(ninguna)');
console.log('cliente:', cuerpo.cliente ?? '(ninguno)');
console.log('error:', cuerpo.error ?? '(ninguno)');
if (cuerpo.url && cuerpo.url.startsWith('https://checkout.stripe.com/')) {
  console.log('\nOK: la pasarela de pago de Stripe se genera correctamente.');
} else {
  console.log('\nFALLO: no se ha generado una url de Stripe válida.');
  process.exit(1);
}
