// 1) Borra el usuario de prueba que se quedo.
// 2) Le pone una contrasena nueva al usuario staff.
// 3) Comprueba que el login funciona.
const SU = 'https://fohxajfpnriusuybdteu.supabase.co';
// La clave de servicio se toma del entorno (nunca del repositorio).
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!KEY) {
  console.error('Falta SUPABASE_SECRET_KEY en el entorno.');
  process.exit(1);
}
const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const EMAIL = 'admin@lasmesas.com';
// La contrasena se pasa por parametro (no se deja escrita en el repo).
const PASSWORD = process.argv[2] ?? '';
if (!PASSWORD) {
  console.error('Uso: node scripts/resetear-contrasena-staff.mjs <contrasena-nueva>');
  process.exit(1);
}

const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// 1) Limpiar usuarios de prueba
let r = await fetch(SU + '/auth/v1/admin/users?per_page=50', { headers: cab });
const lista = await r.json();
for (const u of lista.users ?? []) {
  if (String(u.email).startsWith('prueba-panel-')) {
    const b = await fetch(SU + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: cab });
    console.log('1) Usuario de prueba borrado:', u.email, '->', b.status);
  }
}

// 2) Poner la contrasena
const id = (lista.users ?? []).find((u) => u.email === EMAIL)?.id;
if (!id) {
  console.error('No se encuentra', EMAIL);
  process.exit(1);
}
r = await fetch(SU + '/auth/v1/admin/users/' + id, {
  method: 'PUT',
  headers: cab,
  body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
});
const actualizado = await r.json();
console.log('2) Contrasena puesta:', r.status, actualizado.id === id ? 'ok' : JSON.stringify(actualizado).slice(0, 200));
console.log('   identidades ahora:', (actualizado.identities ?? []).map((i) => i.provider).join(',') || '(ninguna)');

// 3) Comprobar el login contra nuestra API
r = await fetch(BASE + '/api/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const login = await r.json();
console.log('3) Login:', r.status, login.token ? 'TOKEN OK' : JSON.stringify(login));

// 4) Y que la API del panel acepte ese token
if (login.token) {
  r = await fetch(BASE + '/api/admin-productos', {
    headers: { Authorization: 'Bearer ' + login.token },
  });
  const productos = await r.json();
  console.log('4) Lista de productos:', r.status, Array.isArray(productos) ? productos.length : JSON.stringify(productos).slice(0, 200));
}
