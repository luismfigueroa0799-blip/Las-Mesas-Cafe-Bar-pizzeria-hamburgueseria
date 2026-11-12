/**
 * Comprueba que el catálogo se agrupa correctamente en categorías y que cada
 * producto tiene id (para que n8n pueda validarlo).
 *
 * Uso:  node scripts/probar-catalogo.mjs
 */
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', 'artifacts', 'las-mesas');
const repoRaiz = path.resolve(raiz, '..', '..');

function localizarEsbuild() {
  const d = path.join(repoRaiz, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (existsSync(d)) return d;
  const alm = path.join(repoRaiz, 'node_modules', '.pnpm');
  const c = readdirSync(alm).find((n) => n.startsWith('esbuild@'));
  const r = path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
  return existsSync(r) ? r : null;
}

const em = await import(pathToFileURL(localizarEsbuild()).href);
const build = em.build ?? em.default.build;
const salida = path.join(process.env.TEMP || '.', 'catalogo.mjs');
await build({
  entryPoints: [path.join(raiz, 'src', 'products.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: salida,
  logLevel: 'error',
  loader: { '.json': 'json' },
});

const { getProductos, categoriasDe, CATEGORIES } = await import(
  pathToFileURL(salida).href
);

// Sin fetch (no hay navegador): se simula que la API no responde para probar
// el catalogo local de respaldo.
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });

const productos = await getProductos();
console.log('Productos cargados:', productos.length);
console.log('');

const cats = categoriasDe(productos);
console.log('Categorias generadas:', cats.length);
for (const c of cats) {
  const n = productos.filter((p) => p.category_slug === c.slug).length;
  console.log(`  ${String(n).padStart(3)}  ${c.name}  (${c.slug})`);
}

console.log('');
const sinId = productos.filter((p) => !p.id);
console.log('Productos SIN id (n8n los rechazaria):', sinId.length);
if (sinId.length) {
  for (const p of sinId.slice(0, 10)) console.log('   -', p.name);
}

const sinPrecio = productos.filter((p) => !p.precio_eur);
console.log('Productos SIN precio:', sinPrecio.length);

const primera = CATEGORIES[0];
const enPrimera = productos.filter((p) => p.category_slug === primera.slug);
console.log('');
console.log(
  `Primera categoria "${primera.name}" -> ${enPrimera.length} productos (si es 0, la carta saldra vacia)`,
);
for (const p of enPrimera) {
  console.log(`   - [${p.id}] ${p.name}  ${p.price}`);
}
