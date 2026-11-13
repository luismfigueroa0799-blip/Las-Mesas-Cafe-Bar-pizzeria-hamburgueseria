// Importa la carta de Supabase a la tabla `products` de Neon.
//
// Se ejecuta en local con la variable DATABASE_URL de Neon:
//
//   $env:DATABASE_URL = "postgresql://usuario:clave@ep-xxx-pooler.region.neon.tech/neondb?sslmode=require"
//   node scripts/importar-catalogo-neon.mjs
//
// Los ids se copian tal cual para que coincidan con los que usan el flujo de
// n8n y la web. Si el producto ya existe en Neon se actualizan el nombre, el
// precio y la disponibilidad (no se tocan la foto ni la descripcion).
import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DATABASE_URL = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? '';

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL (la URL de Neon).');
  process.exit(1);
}
if (!SUPABASE_KEY) {
  console.error('Falta SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const { default: pg } = await import('pg');
const Pool = pg?.Pool ?? pg?.default?.Pool;

// 1) Leer la carta de Supabase
const r = await fetch(
  SUPABASE_URL + '/rest/v1/productos?select=id,nombre,precio,categoria,disponible&order=id',
  { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } },
);
if (!r.ok) {
  console.error('No se pudo leer la carta de Supabase:', r.status, await r.text());
  process.exit(1);
}
const origen = await r.json();
console.log('Productos en Supabase:', origen.length);

// 2) Escribirlos en Neon
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 1,
  ssl: DATABASE_URL.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
});

let insertados = 0;
let actualizados = 0;

try {
  for (const p of origen) {
    const id = Number(p.id);
    if (!Number.isFinite(id)) continue;
    const nombre = String(p.nombre ?? '');
    const precio = Number(p.precio ?? 0);
    const disponible = p.disponible !== false;

    const existe = await pool.query('select id from products where id = $1', [id]);
    if (existe.rowCount) {
      await pool.query(
        'update products set name = $2, price = $3, is_available = $4 where id = $1',
        [id, nombre, precio, disponible],
      );
      actualizados += 1;
    } else {
      await pool.query(
        'insert into products (id, name, description, price, image_url, is_available, category_id) values ($1, $2, $3, $4, $5, $6, $7)',
        [id, nombre, p.descripcion ?? null, precio, p.image_url ?? null, disponible, p.categoria_id ?? null],
      );
      insertados += 1;
    }
  }

  const total = await pool.query('select count(*)::int as total from products');
  console.log(`Insertados: ${insertados} | Actualizados: ${actualizados}`);
  console.log('Total en Neon:', total.rows[0].total);
} finally {
  await pool.end();
}
