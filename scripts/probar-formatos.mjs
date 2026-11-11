/**
 * Comprueba la normalizacion de telefono y el calculo de precios en centimos.
 *
 * Uso:  node scripts/probar-formatos.mjs
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

const salida = path.join(process.env.TEMP || '.', 'formatos-prueba.mjs');
await build({
  entryPoints: [path.join(repoRaiz, 'scripts', 'formatos-entrada.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: salida,
  logLevel: 'error',
});

const { normalizarTelefono, telefonoValido, soloDigitos, precioANumero, precioACentavos } =
  await import(pathToFileURL(salida).href);

let fallos = 0;

function comprobar(descripcion, obtenido, esperado) {
  const ok = obtenido === esperado;
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${descripcion}`);
  if (!ok) {
    console.log(`        esperado: ${JSON.stringify(esperado)}`);
    console.log(`        obtenido: ${JSON.stringify(obtenido)}`);
  }
}

console.log('--- Telefono (formato que espera n8n: solo digitos con prefijo 34) ---');
comprobar('"600 00 00 00"      -> 34600000000', normalizarTelefono('600 00 00 00'), '34600000000');
comprobar('"+34 600 00 00 00"  -> 34600000000', normalizarTelefono('+34 600 00 00 00'), '34600000000');
comprobar('"600000000"         -> 34600000000', normalizarTelefono('600000000'), '34600000000');
comprobar('"34600000000"       -> 34600000000', normalizarTelefono('34600000000'), '34600000000');
comprobar('"928 89 60 97"      -> 34928896097', normalizarTelefono('928 89 60 97'), '34928896097');
comprobar('"(600) 00-00-00"    -> 34600000000', normalizarTelefono('(600) 00-00-00'), '34600000000');
comprobar('vacio               -> ""', normalizarTelefono(''), '');
comprobar('soloDigitos("(600) 00-00-00")', soloDigitos('(600) 00-00-00'), '600000000');

console.log('\n--- Validez del telefono ---');
comprobar('"600000000" es valido', telefonoValido('600000000'), true);
comprobar('"34600000000" es valido', telefonoValido('34600000000'), true);
comprobar('"123" no es valido', telefonoValido('123'), false);
comprobar('vacio no es valido', telefonoValido(''), false);

console.log('\n--- Precios en centimos (coma decimal) ---');
comprobar('"9,50 €"  -> 9.5', precioANumero('9,50 €'), 9.5);
comprobar('"12,00 €" -> 12', precioANumero('12,00 €'), 12);
comprobar('"1,40 €"  -> 1.4', precioANumero('1,40 €'), 1.4);
comprobar('"1,85 €"  -> 1.85', precioANumero('1,85 €'), 1.85);
comprobar('"0,30 €"  -> 0.3', precioANumero('0,30 €'), 0.3);
comprobar('"9,50"    -> 9.5', precioANumero('9,50'), 9.5);
comprobar('"12.50"   -> 12.5 (punto)', precioANumero('12.50'), 12.5);
comprobar('"1.234,56" -> 1234.56 (miles es)', precioANumero('1.234,56'), 1234.56);
comprobar('centimos "9,50 €"  -> 950', precioACentavos('9,50 €'), 950);
comprobar('centimos "12,00 €" -> 1200', precioACentavos('12,00 €'), 1200);
comprobar('centimos "1,40 €"  -> 140', precioACentavos('1,40 €'), 140);

console.log('\n--- Total del carrito (el caso del bug de 0,50 EUR) ---');
const carro = [
  { precio: '9,50 €', cantidad: 1 },
  { precio: '12,00 €', cantidad: 1 },
  { precio: '1,40 €', cantidad: 2 },
];
const total = carro.reduce((s, i) => s + precioANumero(i.precio) * i.cantidad, 0);
comprobar('total = 24.30 (no 23.80)', total, 24.3);
const totalCentimos = carro.reduce(
  (s, i) => s + precioACentavos(i.precio) * i.cantidad,
  0,
);
comprobar('total en centimos = 2430', totalCentimos, 2430);

console.log('');
if (fallos === 0) {
  console.log('Todas las comprobaciones han pasado.');
} else {
  console.log(`${fallos} comprobacion(es) fallida(s).`);
  process.exit(1);
}
