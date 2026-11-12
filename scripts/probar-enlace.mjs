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
  return path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
}
const em = await import(pathToFileURL(esb()).href);
const build = em.build ?? em.default.build;
const out = path.join(process.env.TEMP || '.', 'ck2.mjs');
await build({ entryPoints: [path.join(raiz, 'api', 'checkout.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { default: checkout } = await import(pathToFileURL(out).href);

function resMock() {
  const r = { _status: 200, _body: null,
    status(c){r._status=c;return r;}, json(b){r._body=b;}, setHeader(){},
    end(b){if(b!==undefined)r._body=b;}, send(b){r._body=b;} };
  return r;
}

const body = {
  items: [{ id: '4', name: 'La suprema', price: '6,50 €', quantity: 1 }],
  customerEmail: 'luis@gmail.com', customerName: 'Luis Test',
  telefono: '600000000', tipoEntrega: 'recogida',
  direccion: { calle:'', numero:'', piso:'', codigoPostal:'', ciudad:'' },
};
const r = resMock();
await checkout({ method:'POST', url:'http://x/api/checkout', headers:{get:()=>'x'}, body }, r);
console.log('status:', r._status, '| pedido_id:', r._body?.pedido_id, '| total:', r._body?.total);
console.log('session:', String(r._body?.url ?? '').match(/cs_[a-zA-Z0-9]+/)?.[0] ?? '(ninguna)');
console.log('pedido_id para consultar:', r._body?.pedido_id);
