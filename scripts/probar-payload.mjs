// Prueba del flujo de checkout: captura el JSON que se envia a n8n, comprueba
// el metadata de la sesion de Stripe y el pedido guardado en Supabase.
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
  const c = readdirSync(alm).find((n) => n.startsWith('esbuild@'));
  return path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
}

const em = await import(pathToFileURL(esb()).href);
const build = em.build ?? em.default.build;
const out = path.join(process.env.TEMP || '.', 'ck-payload.mjs');
await build({
  entryPoints: [path.join(raiz, 'api', 'checkout.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { default: checkout } = await import(pathToFileURL(out).href);

// Se intercepta fetch para ver el cuerpo que se manda a n8n.
const realFetch = globalThis.fetch;
let cuerpoN8n = null;
globalThis.fetch = async (url, opciones = {}) => {
  const u = String(url);
  if (u.includes('barcafeteria.app.n8n.cloud')) {
    cuerpoN8n = JSON.parse(String(opciones.body ?? '{}'));
  }
  return realFetch(url, opciones);
};

function resMock() {
  const r = {
    _status: 200,
    _body: null,
    status(c) { r._status = c; return r; },
    json(b) { r._body = b; },
    setHeader() {},
    end(b) { if (b !== undefined) r._body = b; },
    send(b) { r._body = b; },
  };
  return r;
}

const body = {
  items: [
    { id: '4', name: 'La suprema', price: '6,50 â‚¬', quantity: 1 },
    { id: '1', name: 'CafÃ© Solo', price: '1,50 â‚¬', quantity: 2 },
  ],
  customerEmail: 'luis@gmail.com',
  customerName: 'Luis Figueras',
  telefono: '600000000',
  tipoEntrega: 'domicilio',
  direccion: {
    calle: 'Calle Mayor',
    numero: '24',
    piso: '3 B',
    codigoPostal: '35018',
    ciudad: 'Las Palmas de Gran Canaria',
  },
};

const r = resMock();
await checkout(
  { method: 'POST', url: 'http://x/api/checkout', headers: { get: () => 'x' }, body },
  r,
);

console.log('\n=== RESPUESTA DE /api/checkout ===');
console.log('status:', r._status);
console.log('pedido_id:', r._body?.pedido_id, '| total:', r._body?.total);
console.log('url:', String(r._body?.url ?? '').slice(0, 70));

console.log('\n=== JSON QUE LLEGA A N8N ===');
console.log(JSON.stringify(cuerpoN8n, null, 2));

function normalizar(v) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }

console.log('\n=== COMPROBACIONES DEL FORMATO PLANO ===');
{
  const checks = [
    ['order_code', typeof cuerpoN8n.order_code === 'string' && /^PED-/.test(cuerpoN8n.order_code)],
    ['cliente_nombre', cuerpoN8n.cliente_nombre === 'Luis Figueras'],
    ['direccion', typeof cuerpoN8n.direccion === 'string' && cuerpoN8n.direccion.includes('Mayor')],
    ['telefono', cuerpoN8n.telefono === '34600000000'],
    ['total (numero)', typeof cuerpoN8n.total === 'number' && cuerpoN8n.total === 9.5],
    ['items[0].nombre', normalizar(cuerpoN8n.items?.[0]?.nombre) === 'LA SUPREMA'],
    ['items[0].cantidad', cuerpoN8n.items?.[0]?.cantidad === 1],
    ['items[0].precio (numero)', cuerpoN8n.items?.[0]?.precio === 6.5],
    ['items[1].nombre', normalizar(cuerpoN8n.items?.[1]?.nombre) === 'CAFE SOLO'],
    ['items[1].cantidad', cuerpoN8n.items?.[1]?.cantidad === 2],
    ['items[1].precio (numero)', cuerpoN8n.items?.[1]?.precio === 1.5],
    ['nombre (compat)', cuerpoN8n.nombre === 'Luis Figueras'],
    ['cliente_telefono (compat)', cuerpoN8n.cliente_telefono === '34600000000'],
    ['items[0].id (creacion)', cuerpoN8n.items?.[0]?.id === 4],
    ['items[0].qty (creacion)', cuerpoN8n.items?.[0]?.qty === 1],
    ['sin objetos anidados', typeof cuerpoN8n.items?.[0]?.nombre === 'string'],
  ];
  let fallos = 0;
  for (const [nombre, ok] of checks) {
    console.log(`  ${ok ? 'OK  ' : 'FALLO'} ${nombre}`);
    if (!ok) fallos += 1;
  }
  console.log(fallos === 0 ? '\nTODO CORRECTO' : `\n${fallos} FALLOS`);
}

// Metadata de la sesion de Stripe
const sessionId = String(r._body?.url ?? '').match(/cs_[a-zA-Z0-9_]+/)?.[0];
if (sessionId) {
  const sk = process.env.STRIPE_SECRET_KEY;
  const res = await realFetch(
    'https://api.stripe.com/v1/checkout/sessions/' + sessionId,
    { headers: { Authorization: 'Bearer ' + sk } },
  );
  const datos = await res.json();
  console.log('\n=== METADATA DE LA SESION DE STRIPE ===');
  console.log(JSON.stringify(datos?.metadata, null, 2));
  const md = datos?.metadata ?? {};
  const mdChecks = [
    ['order_code', typeof md.order_code === 'string' && md.order_code.startsWith('PED-')],
    ['cliente_nombre', md.cliente_nombre === 'Luis Figueras'],
    ['direccion', String(md.direccion ?? '').includes('Mayor')],
    ['telefono', md.telefono === '34600000000'],
    ['total', md.total === '9.50'],
    ['items', String(md.items ?? '').includes('La suprema')],
    ['pedido_id conservado', md.pedido_id !== undefined],
    ['nombre conservado', md.nombre === 'Luis Figueras'],
    ['cliente_telefono conservado', md.cliente_telefono === '34600000000'],
    ['tipo conservado', md.tipo !== undefined],
  ];
  let fallosMd = 0;
  console.log('\n=== COMPROBACIONES DEL METADATA ===');
  for (const [nombre, ok] of mdChecks) {
    console.log(`  ${ok ? 'OK  ' : 'FALLO'} ${nombre}`);
    if (!ok) fallosMd += 1;
  }
  console.log(fallosMd === 0 ? 'METADATA CORRECTA' : `${fallosMd} FALLOS EN METADATA`);

  const sb = process.env.SUPABASE_SECRET_KEY;
  const r2 = await realFetch(
    'https://fohxajfpnriusuybdteu.supabase.co/rest/v1/pedidos?select=id,cliente_nombre,cliente_telefono,direccion,total,payment_intent,items,estado&id=eq.' +
      r._body?.pedido_id,
    { headers: { apikey: sb, Authorization: 'Bearer ' + sb } },
  );
  console.log('\n=== PEDIDO EN SUPABASE ===');
  console.log(await r2.text());
}
