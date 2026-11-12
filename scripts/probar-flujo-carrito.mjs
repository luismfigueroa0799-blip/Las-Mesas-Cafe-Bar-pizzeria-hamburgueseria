/**
 * Prueba del flujo completo: carrito -> /api/checkout -> webhook a n8n.
 * Comprueba que los articulos y el total llegan bien.
 *
 * Uso:  node scripts/probar-flujo-carrito.mjs
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

// Se compilan por separado: ambos modulos exportan maxDuration.
async function compilar(entrada, nombre) {
  const salida = path.join(process.env.TEMP || '.', nombre);
  await build({
    entryPoints: [entrada],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: salida,
    logLevel: 'error',
  });
  return import(pathToFileURL(salida).href);
}

const { default: checkout } = await compilar(
  path.join(raiz, 'api', 'checkout.ts'),
  'flujo-checkout.mjs',
);
const { default: webhook } = await compilar(
  path.join(raiz, 'api', 'webhook.ts'),
  'flujo-webhook.mjs',
);

function resMock() {
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

// Carrito simulado (lo que envia el navegador)
const carrito = {
  items: [
    { id: '3', name: 'Burger Pizza', price: '12,00 €', quantity: 1 },
    { id: '62', name: 'Tropical', price: '1,40 €', quantity: 2 },
  ],
  customerEmail: 'cliente@ejemplo.com',
  customerName: 'Ana Pérez',
  telefono: '600 00 00 00',
  tipoEntrega: 'recogida',
  direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
  mesa: '',
  urlOrigen: 'https://ejemplo.com',
};

console.log('--- 1) Carrito que envia el navegador ---');
console.log(JSON.stringify(carrito.items));
console.log('');

// 2) Llamada a /api/checkout
const resC = resMock();
await checkout(
  { method: 'POST', url: 'http://x/api/checkout', headers: { get: () => 'x' }, body: carrito },
  resC,
);
console.log('--- 2) Respuesta de /api/checkout ---');
console.log('status:', resC._status);
console.log('total:', resC._body?.total, '| totalCentimos:', resC._body?.totalCentimos);
console.log('articulos:', JSON.stringify(resC._body?.articulos));
console.log('');

if (resC._status !== 200) {
  console.log('FALLO: el checkout no devolvio 200');
  process.exit(1);
}

// 3) Simular el evento de Stripe que llegaria al webhook
const evento = {
  type: 'checkout.session.completed',
  livemode: false,
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: resC._body.sessionId,
      payment_intent: 'pi_test_123',
      amount_total: resC._body.totalCentimos,
      currency: 'eur',
      payment_method_types: ['card'],
      customer_details: { email: carrito.customerEmail, name: carrito.customerName },
      metadata: {
        nombre: carrito.customerName,
        telefono: carrito.telefono,
        cliente_telefono: carrito.telefono,
        correo: carrito.customerEmail,
        tipoEntrega: carrito.tipoEntrega,
        total: resC._body.total,
        totalCentimos: String(resC._body.totalCentimos),
        numArticulos: '3',
        items: JSON.stringify(resC._body.articulos),
      },
    },
  },
};

// Interceptamos el fetch global para capturar lo que se envia a n8n.
let enviadoAN8n = null;
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, opciones) => {
  if (String(url).includes('n8n.cloud')) {
    enviadoAN8n = JSON.parse(opciones.body);
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return fetchOriginal(url, opciones);
};

const resW = resMock();
await webhook(
  { method: 'POST', url: 'http://x/api/webhook', headers: { get: () => null }, body: evento },
  resW,
);
globalThis.fetch = fetchOriginal;

console.log('--- 3) Payload que llega a n8n ---');
console.log('status webhook:', resW._status, '|', JSON.stringify(resW._body));
console.log('total      :', JSON.stringify(enviadoAN8n?.total));
console.log('articulos  :', JSON.stringify(enviadoAN8n?.articulos));
console.log('nombre     :', JSON.stringify(enviadoAN8n?.nombre));
console.log('telefono   :', JSON.stringify(enviadoAN8n?.telefono));
console.log('');

const ok =
  enviadoAN8n?.total === '14.80' &&
  Array.isArray(enviadoAN8n?.articulos) &&
  enviadoAN8n.articulos.length === 2 &&
  enviadoAN8n?.nombre === 'Ana Pérez' &&
  enviadoAN8n?.telefono === '34600000000';

console.log(
  ok
    ? 'OK: total, articulos, nombre y telefono llegan correctamente a n8n.'
    : 'FALLO: algun dato no llega bien.',
);
process.exit(ok ? 0 : 1);
