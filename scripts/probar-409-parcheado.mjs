// Prueba del rechazo por producto AGOTADO (409) ejecutando el handler de
// checkout en local con la hora dentro del horario y con la consulta a Neon
// parcheada para devolver el producto como no disponible.
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const raiz =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria';
const src = raiz + '/artifacts/las-mesas';

// ── 1) Hora fija dentro del horario (12:00 UTC = 13:00 en Canarias) ──
const FIJO = Date.UTC(2026, 0, 15, 12, 0, 0);
const RealDate = Date;
class FechaFalsa extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIJO);
    else super(...args);
  }
  static now() {
    return FIJO;
  }
}
globalThis.Date = FechaFalsa;

// ── 2) Parcheamos fetch: la consulta a Neon dice "no disponible" y el flujo
//        de n8n no se llama (para que el Plan B sea el que decide) ──
const fetchReal = globalThis.fetch;
let consultaNeon = '';
globalThis.fetch = async (url, opciones = {}) => {
  const u = String(url);
  if (u.includes('/rest/v1/productos')) {
    // Consulta del catalogo: se devuelve con el producto marcado como NO
    // disponible para probar el rechazo.
    return new Response(
      JSON.stringify([
        { id: 4, nombre: 'La suprema', precio: 6.5, disponible: false },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (u.includes('/rest/v1/')) {
    return fetchReal(url, opciones);
  }

  if (u.includes('barcafeteria.app.n8n.cloud')) {
    // n8n no devuelve nada: asi se prueba el Plan B de la web.
    return new Response(JSON.stringify({ ok: false, error: 'n8n no disponible en la prueba' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetchReal(url, opciones);
};

// ── 3) Bundle del handler ──
function esb() {
  const d = path.join(raiz, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (existsSync(d)) return d;
  const alm = path.join(raiz, 'node_modules', '.pnpm');
  const c = readdirSync(alm).find((n) => n.startsWith('esbuild@'));
  return path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
}
const em = await import(pathToFileURL(esb()).href);
const build = em.build ?? em.default.build;
const out = path.join(process.env.TEMP || '.', 'ck-409.mjs');
await build({
  entryPoints: [path.join(src, 'api', 'checkout.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'error',
});
const { default: checkout } = await import(pathToFileURL(out).href);

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

const r = resMock();
await checkout(
  {
    method: 'POST',
    url: 'http://x/api/checkout',
    headers: { get: (n) => (n === 'host' ? 'localhost' : n === 'x-forwarded-proto' ? 'https' : null) },
    body: {
      items: [{ id: '4', name: 'La suprema', price: '6,50 EUR', quantity: 1 }],
      customerEmail: 'prueba@lasmesas.com',
      customerName: 'Prueba 409',
      telefono: '600000000',
      tipoEntrega: 'recogida',
      total: '6.50',
      direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
    },
  },
  r,
);

console.log('\n=== RESULTADO ===');
console.log('Consulta a Neon parcheada:', consultaNeon || 'NO');
console.log('HTTP', r._status);
console.log(JSON.stringify(r._body, null, 2));
console.log(
  r._status === 409
    ? '\nCORRECTO: el checkout rechaza el producto agotado con 409'
    : '\nREVISAR: no se ha rechazado con 409',
);
