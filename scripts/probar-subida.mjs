// Prueba de la subida de imagenes a Vercel Blob.
//   1) Sin token de Blob -> la API debe explicar que falta configurarlo.
//   2) Con un token falso -> se ve el error real del almacen.
//   3) Con un token bueno -> sube la imagen y devuelve la url.
import { readFileSync } from 'node:fs';

const SU = 'https://fohxajfpnriusuybdteu.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';
const EMAIL = `prueba-blob-${Date.now()}@lasmesas.com`;
const PASSWORD = 'Prueba-2026!clave';

const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// Usuario de prueba staff
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

// Un JPEG minimo (1x1) en base64
const JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCABkAGQBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z';

const llamar = async (cuerpo, etiqueta) => {
  const r = await fetch(BASE + '/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(cuerpo),
  });
  const t = await r.text();
  console.log(`   ${etiqueta}: HTTP ${r.status}  ${t.slice(0, 220)}`);
  return { r, t };
};

// 2) Sin imagen
await llamar({ nombre: 'x.jpg', contenido: '' }, 'sin imagen');

// 3) Con algo que no es una imagen
await llamar({ nombre: 'x.txt', contenido: Buffer.from('hola').toString('base64') }, 'no es imagen');

// 4) Con una imagen (el almacen dira si falta el token o si falla)
await llamar({ nombre: 'prueba.jpg', contenido: JPEG_BASE64 }, 'imagen valida');

// Limpiar
const usuarios = await (await fetch(SU + '/auth/v1/admin/users?per_page=100', { headers: cab })).json();
for (const u of usuarios.users ?? []) {
  if (String(u.email).startsWith('prueba-blob-')) {
    await fetch(SU + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: cab });
  }
}
console.log('\nUsuario de prueba borrado');
