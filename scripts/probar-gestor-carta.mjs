// Prueba del gestor de carta: crear, editar y borrar un producto.
import { writeFileSync } from 'node:fs';

const SU = 'https://fohxajfpnriusuybdteu.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const EMAIL = `prueba-carta-${Date.now()}@lasmesas.com`;
const PASSWORD = 'Prueba-2026!clave';

const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// Usuario de prueba
await fetch(SU + '/auth/v1/admin/users', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'staff' },
  }),
});
const login = await (
  await fetch(BASE + '/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
).json();
console.log('1) Login staff:', login.token ? 'OK' : JSON.stringify(login));
if (!login.token) process.exit(1);
const auth = { Authorization: 'Bearer ' + login.token };

// ── CREAR ──
let r = await fetch(BASE + '/api/admin-productos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({
    accion: 'guardar',
    name: 'Prueba del gestor',
    description: 'Producto de prueba',
    price: 7.25,
    image_url: '/assets/logo-las-mesas.jpeg',
    category_id: 9,
    is_available: true,
  }),
});
let creado = await r.json();
console.log('2) CREAR:', r.status, JSON.stringify(creado).slice(0, 160));
const id = creado?.producto?.id;

// ── Aparece en la carta publica ──
let publico = await (await fetch(BASE + '/api/productos')).json();
let enCarta = publico.find((p) => Number(p.id) === Number(id));
console.log('3) En la carta publica:', enCarta ? 'si' : 'NO');
console.log('   datos:', JSON.stringify(enCarta));

// ── EDITAR ──
r = await fetch(BASE + '/api/admin-productos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({
    accion: 'guardar',
    id,
    name: 'Prueba editada',
    description: 'Descripcion nueva',
    price: 9.5,
    image_url: '/assets/hero-las-mesas.webp',
    category_id: 12,
    is_available: false,
  }),
});
const editado = await r.json();
console.log('4) EDITAR:', r.status, JSON.stringify(editado).slice(0, 160));

publico = await (await fetch(BASE + '/api/productos')).json();
enCarta = publico.find((p) => Number(p.id) === Number(id));
console.log('   en la carta ahora:', JSON.stringify(enCarta));

// ── BORRAR ──
r = await fetch(BASE + '/api/admin-productos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ accion: 'borrar', id }),
});
console.log('5) BORRAR:', r.status, JSON.stringify(await r.json()));

publico = await (await fetch(BASE + '/api/productos')).json();
console.log('   sigue en la carta:', publico.some((p) => Number(p.id) === Number(id)));
console.log('   total de productos ahora:', publico.length);

// ── Validaciones: nombre vacio y precio invalido ──
r = await fetch(BASE + '/api/admin-productos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ accion: 'guardar', name: '  ', price: 1 }),
});
console.log('6) Validar nombre vacio:', r.status, JSON.stringify(await r.json()));

r = await fetch(BASE + '/api/admin-productos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ accion: 'guardar', name: 'X', price: 'abc' }),
});
console.log('   Validar precio malo:', r.status, JSON.stringify(await r.json()));

// ── Limpiar ──
const usuarios = await (await fetch(SU + '/auth/v1/admin/users?per_page=100', { headers: cab })).json();
for (const u of usuarios.users ?? []) {
  if (String(u.email).startsWith('prueba-carta-')) {
    await fetch(SU + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: cab });
  }
}
console.log('7) Usuario de prueba borrado');
