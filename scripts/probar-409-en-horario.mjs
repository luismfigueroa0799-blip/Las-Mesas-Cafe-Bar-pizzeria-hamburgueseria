// Comprueba el rechazo por producto AGOTADO (409) ejecutando el handler de
// checkout en local con la hora fijada dentro del horario de apertura
// (Canarias es UTC+1: las 12:00 UTC son las 13:00 en el local).
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const raiz =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria';
const src = raiz + '/artifacts/las-mesas';

// ── Fijar la hora: 12:00 UTC = 13:00 en Canarias (dentro de 08:00-23:00) ──
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

// ── Bundle del handler ──
function esb() {
  const d = path.join(raiz, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (existsSync(d)) return d;
  const alm = path.join(raiz, 'node_modules', '.pnpm');
  const c = readdirSync(alm).find((n) => n.startsWith('esbuild@'));
  return path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
}
const em = await import(pathToFileURL(esb()).href);
const build = em.build ?? em.default.build;
const out = path.join(process.env.TEMP || '.', 'ck-horario.mjs');
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

const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const KEY = process.env.SUPABASE_SECRET_KEY;

// ── Marcar "La suprema" como agotada en Neon ──
const su = 'https://fohxajfpnriusuybdteu.supabase.co';
const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// Buscar el id en la tabla products de Neon a traves del catalogo publico
const catalogo = await (await fetch(BASE + '/api/productos')).json();
const producto = catalogo.find((p) => p.nombre === 'La suprema');
console.log('Producto:', producto?.nombre, '| id:', producto?.id);

// Marcar agotado con la API del panel (usuario de prueba)
const email = `prueba-409-${Date.now()}@lasmesas.com`;
await fetch(su + '/auth/v1/admin/users', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({
    email,
    password: 'Prueba-2026!clave',
    email_confirm: true,
    app_metadata: { role: 'staff' },
  }),
});
const login = await (
  await fetch(BASE + '/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Prueba-2026!clave' }),
  })
).json();

await fetch(BASE + '/api/admin/toggle-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
  body: JSON.stringify({ id: producto.id, is_available: false }),
});
console.log('Marcado como agotado');

// ── Checkout en horario de apertura ──
const r = resMock();
await checkout(
  {
    method: 'POST',
    url: 'http://x/api/checkout',
    headers: { get: (n) => (n === 'host' ? 'localhost' : n === 'x-forwarded-proto' ? 'https' : null) },
    body: {
      items: [{ id: String(producto.id), name: producto.nombre, price: String(producto.precio), quantity: 1 }],
      customerEmail: 'prueba@lasmesas.com',
      customerName: 'Prueba 409',
      telefono: '600000000',
      tipoEntrega: 'recogida',
      total: String(producto.precio),
      direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
    },
  },
  r,
);
console.log('\n=== CHECKOUT EN HORARIO CON EL PRODUCTO AGOTADO ===');
console.log('HTTP', r._status, JSON.stringify(r._body));

// ── Restaurar ──
await fetch(BASE + '/api/admin/toggle-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
  body: JSON.stringify({ id: producto.id, is_available: true }),
});
const usuarios = await (await fetch(su + '/auth/v1/admin/users?per_page=100', { headers: cab })).json();
for (const u of usuarios.users ?? []) {
  if (String(u.email).startsWith('prueba-409-')) {
    await fetch(su + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: cab });
  }
}
console.log('\nRestaurado y usuario de prueba borrado');
