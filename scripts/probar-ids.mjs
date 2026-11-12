import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', 'artifacts', 'las-mesas');
const repoRaiz = path.resolve(raiz, '..', '..');
function esb() {
  const d = path.join(repoRaiz, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (existsSync(d)) return d;
  const alm = path.join(repoRaiz, 'node_modules', '.pnpm');
  const c = readdirSync(alm).find(n => n.startsWith('esbuild@'));
  const r = path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
  return existsSync(r) ? r : null;
}
const em = await import(pathToFileURL(esb()).href);
const build = em.build ?? em.default.build;
const out = path.join(process.env.TEMP || '.', 'ck-test.mjs');
await build({ entryPoints: [path.join(raiz, 'api', 'checkout.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { default: checkout } = await import(pathToFileURL(out).href);

function resMock() {
  const r = { _status: 200, _body: null,
    status(c){r._status=c;return r;}, json(b){r._body=b;}, setHeader(){},
    end(b){if(b!==undefined)r._body=b;}, send(b){r._body=b;} };
  return r;
}

const base = {
  customerEmail: 'luis@gmail.com', customerName: 'Luis', telefono: '600000000',
  tipoEntrega: 'recogida', direccion: { calle:'', numero:'', piso:'', codigoPostal:'', ciudad:'' },
};

const casos = [
  ['id numerico valido',      [{ id: '73', name: '1906', price: '2,90 €', quantity: 1 }]],
  ['id VACIO (carrito viejo)', [{ id: '',    name: '1906', price: '2,90 €', quantity: 1 }]],
  ['id con texto',             [{ id: 'abc', name: '1906', price: '2,90 €', quantity: 1 }]],
  ['sin id pero con nombre',   [{               name: '1906', price: '2,90 €', quantity: 1 }]],
  ['varios, uno sin id',      [{ id: '4', name: 'La suprema', price: '6,50 €', quantity: 1 },
                               {               name: '1906', price: '2,90 €', quantity: 1 }]],
];

for (const [titulo, items] of casos) {
  const r = resMock();
  await checkout({ method:'POST', url:'http://x/api/checkout', headers:{get:()=>'x'}, body:{ ...base, items } }, r);
  const ok = r._status === 200 && r._body?.url;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${titulo.padEnd(28)} status=${r._status} ${r._body?.error ?? 'url=' + String(r._body?.url ?? '').slice(0, 60)}`);
}
