// Reproduce localmente el caso "items vacio" vs "body vacio".
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
const esbuildMod = await import(pathToFileURL(rutaEsbuild).href);
const build = esbuildMod.build ?? esbuildMod.default.build;

const salida = path.join(process.env.TEMP || '.', 'checkout-repro.mjs');
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
    url: 'http://localhost/api/checkout',
    headers: { get: () => 'localhost' },
    body: cuerpo,
  };
}

function respuestaMock() {
  const r = {
    _status: 200,
    _body: null,
    status(c) {
      r._status = c;
      return r;
    },
    json(cuerpo) {
      r._body = cuerpo;
    },
    setHeader() {},
    end(cuerpo) {
      if (cuerpo !== undefined) r._body = cuerpo;
    },
    send(cuerpo) {
      r._body = cuerpo;
    },
  };
  return r;
}

const casos = [
  ['body vacio {}', {}],
  ['items vacio', { items: [] }],
  ['items con precio', { items: [{ id: '1', name: 'X', price: '12,00', quantity: 1 }] }],
];

for (const [titulo, cuerpo] of casos) {
  const res = respuestaMock();
  try {
    await handler(peticion(cuerpo), res);
    console.log(`${titulo.padEnd(22)} -> status=${res._status} body=${JSON.stringify(res._body)}`);
  } catch (error) {
    console.log(`${titulo.padEnd(22)} -> EXCEPCION: ${error?.message}`);
    console.log(error?.stack?.split('\n').slice(0, 4).join('\n'));
  }
}
