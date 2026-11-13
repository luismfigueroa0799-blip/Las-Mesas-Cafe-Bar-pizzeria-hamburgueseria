// Valida el panel de inventario de punta a punta:
//   1) Crea un usuario de prueba en Supabase Auth (con rol staff).
//   2) Hace login contra /api/admin-login.
//   3) Lista los productos con el token.
//   4) Cambia la disponibilidad de uno y lo restaura.
import { writeFileSync } from 'node:fs';

// La clave de servicio se toma del entorno (nunca del repositorio).
const SU = process.env.SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!KEY) {
  console.error('Falta SUPABASE_SECRET_KEY en el entorno.');
  process.exit(1);
}
const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const EMAIL = `prueba-panel-${Date.now()}@lasmesas.com`;
const PASSWORD = 'Prueba-2026!clave';

const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// 1) Crear el usuario de prueba con el rol staff
let r = await fetch(SU + '/auth/v1/admin/users', {
  method: 'POST',
  headers: cab,
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'staff' },
  }),
});
let usuario = await r.json();
console.log('1) Usuario de prueba:', r.status, usuario.id ?? JSON.stringify(usuario).slice(0, 160));
if (!usuario.id) {
  // Puede existir ya: lo buscamos.
  r = await fetch(SU + '/auth/v1/admin/users?per_page=100', { headers: cab });
  const lista = await r.json();
  usuario = (lista?.users ?? []).find((u) => u.email === EMAIL);
  if (!usuario) {
    console.error('No se pudo crear el usuario');
    process.exit(1);
  }
}

// 2) Login contra nuestra API
r = await fetch(BASE + '/api/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const login = await r.json();
console.log('2) Login:', r.status, login.token ? 'token OK (' + login.token.length + ' chars)' : JSON.stringify(login));
if (!login.token) process.exit(1);

// 3) Listar productos con el token
r = await fetch(BASE + '/api/admin-productos', { headers: { Authorization: 'Bearer ' + login.token } });
const productos = await r.json();
console.log('3) Lista de productos:', r.status, Array.isArray(productos) ? productos.length : JSON.stringify(productos).slice(0, 200));
if (!Array.isArray(productos) || !productos.length) process.exit(1);
console.log('   ejemplo:', JSON.stringify(productos[0]));

// 4) Cambiar la disponibilidad de uno y restaurarlo
const id = productos[0].id;
const antes = productos[0].disponible;
const nuevo = !antes;
r = await fetch(BASE + '/api/admin/toggle-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
  body: JSON.stringify({ id, is_available: nuevo }),
});
console.log('4) Toggle is_available =', nuevo, '->', r.status, JSON.stringify(await r.json()));

// 5) Comprobar que la API publica lo refleja
const publico = await (await fetch(BASE + '/api/productos')).json();
const enPublico = publico.find((p) => Number(p.id) === Number(id));
console.log('5) La API publica lo marca como disponible =', enPublico?.disponible, '(esperado', nuevo + ')');

// 6) Restaurar
r = await fetch(BASE + '/api/admin/toggle-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
  body: JSON.stringify({ id, is_available: antes }),
});
console.log('6) Restaurado:', r.status);

// 7) Borrar el usuario de prueba
r = await fetch(SU + '/auth/v1/admin/users/' + usuario.id, { method: 'DELETE', headers: cab });
console.log('7) Usuario de prueba borrado:', r.status);

writeFileSync(process.env.TEMP + '/prueba-panel.txt', EMAIL, 'utf8');
