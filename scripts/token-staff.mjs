// Token de staff con la Admin API de Supabase.
// generate_link devuelve dos tokens:
//   - properties.email_otp : el que va en el email (es el que acepta /verify)
//   - hashed_token         : el hash guardado en la base de datos
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const EMAIL = process.argv[2] ?? 'admin@lasmesas.com';

const cab = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const link = await (
  await fetch(SUPABASE_URL + '/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: cab,
    body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
  })
).json();

if (link?.error) {
  console.error('generate_link:', JSON.stringify(link).slice(0, 300));
  process.exit(1);
}
console.log('claves del enlace:', Object.keys(link?.properties ?? {}).join(', '));

const candidatos = [
  link?.properties?.email_otp,
  link?.properties?.hashed_token,
  link?.hashed_token,
].filter(Boolean);

for (const token of candidatos) {
  for (const cuerpo of [
    { type: 'email', token, email: EMAIL },
    { type: 'magiclink', token, email: EMAIL },
  ]) {
    const r = await fetch(SUPABASE_URL + '/auth/v1/verify', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const t = await r.text();
    let access = '';
    try {
      const d = JSON.parse(t);
      access = d?.access_token ?? d?.session?.access_token ?? '';
    } catch {
      /* no json */
    }
    if (access) {
      console.log('\nOK -> token de', access.length, 'chars');
      writeFileSync(process.env.TEMP + '/staff-token.txt', access, 'utf8');
      console.log(access);
      process.exit(0);
    }
    console.log('  fallo', JSON.stringify(cuerpo).slice(0, 60), '->', t.slice(0, 90));
  }
}

console.error('\nNo se ha podido obtener el token.');
process.exit(1);
