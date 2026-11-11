// Pruebas del handler /api/checkout contra la API real de Stripe.
// Uso:  node scripts/probar-checkout.mjs
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', 'artifacts', 'las-mesas');
const repoRaiz = path.resolve(raiz, '..', '..');

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Falta STRIPE_SECRET_KEY en el entorno.');
  process.exit(1);
}
process.env.STRIPE_SECRET_KEY = secretKey;
process.env.NEXT_PUBLIC_URL = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app';

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

function peticion(cuerpo) {
  return {
    method: 'POST',
    headers: { get: () => 'localhost' },
    json: async () => cuerpo,
  };
}

const base = {
  items: [
    { id: 'pc-3', name: 'Burger Pizza', price: '12,00 €', quantity: 1 },
    { id: 'cz-1', name: 'Tropical', price: '1,40 €', quantity: 2 },
  ],
  customerEmail: 'cliente@ejemplo.com',
  customerName: 'Ana Pérez',
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
};

const casos = [
  {
    titulo: 'Telefono opcional (sin telefono) -> debe funcionar',
    cuerpo: { ...base, telefono: '' },
    espera: 200,
  },
  {
    titulo: 'Telefono con formato valido -> debe funcionar',
    cuerpo: { ...base, telefono: '600 00 00 00' },
    espera: 200,
  },
  {
    titulo: 'Email sin dominio -> debe fallar con 400',
    cuerpo: { ...base, telefono: '', customerEmail: 'cliente@' },
    espera: 400,
  },
  {
    titulo: 'Email vacio -> debe fallar con 400',
    cuerpo: { ...base, telefono: '', customerEmail: '' },
    espera: 400,
  },
  {
    titulo: 'Telefono con formato invalido -> debe fallar con 400',
    cuerpo: { ...base, telefono: 'abc' },
    espera: 400,
  },
];

let fallos = 0;

for (const caso of casos) {
  const respuesta = await handler(peticion(caso.cuerpo));
  const cuerpo = await respuesta.json();
  const ok = respuesta.status === caso.espera;
  if (!ok) fallos += 1;

  console.log(`${ok ? 'OK  ' : 'FALLO'} ${caso.titulo}`);
  console.log(`      estado=${respuesta.status} (esperado ${caso.espera})`);
  if (cuerpo.url) console.log(`      url=${cuerpo.url.slice(0, 70)}…`);
  if (cuerpo.error) console.log(`      error=${cuerpo.error}`);
  if (cuerpo.sessionId) console.log(`      sessionId=${cuerpo.sessionId}`);
}

console.log('');
if (fallos === 0) {
  console.log('Todas las comprobaciones han pasado.');
} else {
  console.log(`${fallos} comprobacion(es) fallida(s).`);
  process.exit(1);
}
