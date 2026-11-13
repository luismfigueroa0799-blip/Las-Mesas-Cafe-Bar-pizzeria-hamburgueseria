// Prueba de punta a punta del producto agotado:
//   1) marca un producto real como agotado (con el panel)
//   2) comprueba que la carta publica lo sigue mostrando, con disponible=false
//   3) comprueba que el checkout lo rechaza
//   4) comprueba que la categoria se resuelve bien
//   5) lo restaura
const SU = 'https://fohxajfpnriusuybdteu.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const EMAIL = `prueba-agotado-${Date.now()}@lasmesas.com`;
const PASSWORD = 'Prueba-2026!clave';

const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// Usuario de prueba con rol staff
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
const usuario = await r.json();
console.log('1) Usuario de prueba:', r.status, usuario.id ? 'ok' : JSON.stringify(usuario).slice(0, 120));

// Login
r = await fetch(BASE + '/api/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const login = await r.json();
console.log('   Login:', r.status, login.token ? 'token OK' : JSON.stringify(login));
if (!login.token) process.exit(1);

// Un producto REAL de la carta (tiene categoria y nombre en el PRESENTACION)
const catalogo = await (await fetch(BASE + '/api/productos')).json();
const real = catalogo.find((p) => p.categoria && p.nombre === 'La suprema') ?? catalogo.find((p) => p.categoria);
console.log('\n2) Producto de prueba:', real?.nombre, '| id:', real?.id, '| categoria:', real?.categoria);

// Marcar como agotado
r = await fetch(BASE + '/api/admin/toggle-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
  body: JSON.stringify({ id: real.id, is_available: false }),
});
console.log('3) Marcar agotado:', r.status, JSON.stringify(await r.json()));

// La carta publica: sigue apareciendo pero con disponible = false
const despues = await (await fetch(BASE + '/api/productos')).json();
const enCarta = despues.find((p) => Number(p.id) === Number(real.id));
console.log('\n4) EN LA CARTA PUBLICA:');
console.log('   sigue en la lista:', Boolean(enCarta));
console.log('   disponible:', enCarta?.disponible, '(false = sale con la etiqueta AGOTADO)');
console.log('   categoria:', enCarta?.categoria);
console.log('   detalle_texto disponible:', Boolean(enCarta?.detalle_texto ?? true));

// El checkout lo rechaza
r = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ id: String(real.id), name: real.nombre, price: String(real.precio), quantity: 1 }],
    customerEmail: 'prueba@lasmesas.com',
    customerName: 'Prueba agotado',
    telefono: '600000000',
    tipoEntrega: 'recogida',
    total: String(real.precio),
    direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
  }),
});
const rechazo = await r.json();
console.log('\n5) CHECKOUT con el producto agotado:');
console.log('   HTTP', r.status, '|', JSON.stringify(rechazo));

// Restaurar
r = await fetch(BASE + '/api/admin/toggle-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
  body: JSON.stringify({ id: real.id, is_available: true }),
});
console.log('\n6) Restaurado:', r.status);

// El checkout vuelve a funcionar
r = await fetch(BASE + '/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ id: String(real.id), name: real.nombre, price: String(real.precio), quantity: 1 }],
    customerEmail: 'prueba@lasmesas.com',
    customerName: 'Prueba agotado',
    telefono: '600000000',
    tipoEntrega: 'recogida',
    total: String(real.precio),
    direccion: { calle: '', numero: '', piso: '', codigoPostal: '', ciudad: '' },
  }),
});
console.log('7) Checkout restaurado: HTTP', r.status, r.status === 200 ? 'ok' : '(revisar)');

// Limpiar el pedido de prueba si se creo
const idPedido = (await r.json().catch(() => ({}))).pedido_id;
if (idPedido) {
  await fetch(SU + '/rest/v1/pedidos?id=eq.' + idPedido, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
  console.log('   pedido de prueba borrado');
}

// Borrar el usuario de prueba
await fetch(SU + '/auth/v1/admin/users/' + usuario.id, { method: 'DELETE', headers: cab });
console.log('8) Usuario de prueba borrado');
