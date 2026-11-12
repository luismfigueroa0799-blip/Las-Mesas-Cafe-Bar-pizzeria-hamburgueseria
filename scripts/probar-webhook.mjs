// Prueba del webhook de Stripe: se simula un evento checkout.session.completed
// y se comprueba que el pedido se actualiza en Supabase y que el JSON plano
// sale con los datos correctos.
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
const out = path.join(process.env.TEMP || '.', 'ck-webhook.mjs');
await build({
  entryPoints: [path.join(raiz, 'api', 'webhook.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { default: webhook } = await import(pathToFileURL(out).href);

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

// ── 1) Se crea un pedido de prueba con los datos reales ──
const sb = process.env.SUPABASE_SECRET_KEY;
const supa = process.env.SUPABASE_URL;
const cabeceras = { apikey: sb, Authorization: 'Bearer ' + sb, 'Content-Type': 'application/json' };

const creado = await fetch(supa + '/rest/v1/pedidos', {
  method: 'POST',
  headers: { ...cabeceras, Prefer: 'return=representation' },
  body: JSON.stringify({
    tipo: 'domicilio',
    items: [{ id: 4, qty: 1, nombre: 'La suprema', subtotal: 6.5, precio_unitario: 6.5 }],
    total: 6.5,
    estado: 'pendiente_pago',
    cliente_nombre: null,
    cliente_telefono: '34600000000',
    direccion: 'Calle Mayor 24, 35018 Las Palmas',
  }),
});
const textoCreado = await creado.text();
console.log('Alta del pedido:', creado.status, textoCreado.slice(0, 400));
const pedido = JSON.parse(textoCreado)[0];
console.log('Pedido de prueba creado:', pedido.id);

// ── 2) Evento de Stripe simulado ──
const evento = {
  id: 'evt_test_123',
  object: 'event',
  livemode: false,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_evento',
      object: 'checkout.session',
      payment_intent: 'pi_3TESTEVENTO123',
      amount_total: 650,
      metadata: {
        pedido_id: String(pedido.id),
        cliente_nombre: 'Luis Figueras',
        nombre: 'Luis Figueras',
        telefono: '34600000000',
        direccion: 'Calle Mayor 24, 35018 Las Palmas',
        total: '6.50',
        order_code: 'PED-TEST',
        items: '[{"nombre":"La suprema","cantidad":1,"precio":6.5}]',
      },
    },
  },
};

const r = resMock();
await webhook(
  {
    method: 'POST',
    url: 'http://x/api/webhook',
    headers: { get: () => null },
    body: JSON.stringify(evento),
  },
  r,
);
console.log('\n=== RESPUESTA DEL WEBHOOK ===');
console.log('status:', r._status);
console.log(JSON.stringify(r._body, null, 2));

// ── 3) Se comprueba el pedido en Supabase ──
const leido = await fetch(
  supa + '/rest/v1/pedidos?select=id,estado,cliente_nombre,cliente_telefono,direccion,total,payment_intent,items&id=eq.' +
    pedido.id,
  { headers: { apikey: sb, Authorization: 'Bearer ' + sb } },
);
const fila = (await leido.json())[0];
console.log('\n=== PEDIDO TRAS EL WEBHOOK ===');
console.log(JSON.stringify(fila, null, 2));

const checks = [
  ['estado = pendiente_confirmacion', fila.estado === 'pendiente_confirmacion'],
  ['cliente_nombre relleno', fila.cliente_nombre === 'Luis Figueras'],
  ['cliente_telefono', fila.cliente_telefono === '34600000000'],
  ['direccion', String(fila.direccion).includes('Mayor')],
  ['total intacto', Number(fila.total) === 6.5],
  ['payment_intent', fila.payment_intent === 'pi_3TESTEVENTO123'],
  ['items con nombre', fila.items?.[0]?.nombre === 'La suprema'],
];
console.log('\n=== COMPROBACIONES ===');
let fallos = 0;
for (const [nombre, ok] of checks) {
  console.log(`  ${ok ? 'OK  ' : 'FALLO'} ${nombre}`);
  if (!ok) fallos += 1;
}
console.log(fallos === 0 ? 'TODO CORRECTO' : `${fallos} FALLOS`);
