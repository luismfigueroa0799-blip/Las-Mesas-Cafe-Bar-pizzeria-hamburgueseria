/**
 * Prueba del flujo real: carrito -> /api/checkout -> n8n -> Supabase.
 * Comprueba que el pedido se crea con el nombre del cliente y que devuelve la
 * url de la pasarela de pago.
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

// Carrito con 4 productos, con los ids REALES de la tabla productos.
const carrito = {
  items: [
    { id: '4', name: 'La suprema', price: '6,50 €', quantity: 1 },
    { id: '5', name: 'La tradicional', price: '3,60 €', quantity: 1 },
    { id: '6', name: 'Burger Pizza', price: '12,00 €', quantity: 1 },
    { id: '14', name: 'Cono de papas', price: '1,85 €', quantity: 1 },
  ],
  customerEmail: 'test@test.com',
  customerName: 'Ana Perez',
  telefono: '600 00 00 00',
  tipoEntrega: 'domicilio',
  direccion: {
    calle: 'Calle Mayor',
    numero: '24',
    piso: '3 B',
    codigoPostal: '35018',
    ciudad: 'Las Palmas de Gran Canaria',
  },
  mesa: '',
  urlOrigen: 'https://ejemplo.com',
};

console.log('--- 1) Carrito del navegador (4 productos) ---');
console.log(JSON.stringify(carrito.items));
console.log('');

const res = resMock();
await checkout(
  { method: 'POST', url: 'http://x/api/checkout', headers: { get: () => 'x' }, body: carrito },
  res,
);

console.log('--- 2) Respuesta de /api/checkout ---');
console.log('status:', res._status);
console.log('pedido_id:', res._body?.pedido_id);
console.log('total:', res._body?.total, '| totalCentimos:', res._body?.totalCentimos);
console.log('url:', String(res._body?.url ?? '').slice(0, 95));
console.log('error:', res._body?.error ?? '(ninguno)');
console.log('');

// 3) Comprobar el pedido en Supabase
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (url && key && res._body?.pedido_id) {
  const r = await fetch(
    `${url}/rest/v1/pedidos?id=eq.${res._body.pedido_id}&select=id,cliente_nombre,cliente_telefono,direccion,total,items,estado`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const [pedido] = await r.json();
  console.log('--- 3) Pedido en Supabase ---');
  console.log('  cliente_nombre  :', JSON.stringify(pedido?.cliente_nombre));
  console.log('  cliente_telefono:', JSON.stringify(pedido?.cliente_telefono));
  console.log('  direccion       :', JSON.stringify(pedido?.direccion));
  console.log('  total           :', pedido?.total);
  console.log('  items           :', JSON.stringify(pedido?.items));
  console.log('  estado          :', pedido?.estado);
  console.log('');

  const ok =
    pedido?.cliente_nombre === 'Ana Perez' &&
    pedido?.cliente_telefono === '34600000000' &&
    pedido?.total === 23.95 &&
    pedido?.items?.length === 4;

  console.log(
    ok
      ? 'OK: el pedido tiene nombre, telefono, total y 4 productos.'
      : 'FALLO: algun dato del pedido no es correcto.',
  );
  process.exit(ok ? 0 : 1);
}

console.log(res._status === 200 ? 'OK: checkout correcto.' : 'FALLO');
process.exit(res._status === 200 ? 0 : 1);
