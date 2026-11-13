// API de la carta: devuelve los productos.
//
// Los productos viven en NEON (la misma base de datos que los pedidos), en la
// tabla `products`:
//
//   id, name, description, price, image_url, is_available, category_id
//
// `is_available` es lo que usa el panel de inventario (/admin/inventario) para
// marcar un producto como AGOTADO. Aqui se devuelven TODOS los productos
// (tambien los agotados) para que la carta pueda pintar la etiqueta.
//
// Si no hay conexion con Neon se usa la tabla `productos` de Supabase como
// respaldo (id, nombre, precio, categoria, disponible).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null };
  query?: Record<string, string | string[] | undefined>;
}

interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
  send(cuerpo: unknown): void;
}

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

// ── Conexion con Neon (Postgres gestionado) ──

let poolNeon: any = null;

async function poolDeNeon(): Promise<any | null> {
  const url = String(entorno().DATABASE_URL ?? entorno().NEON_DATABASE_URL ?? '').trim();
  if (!url) return null;
  if (poolNeon) return poolNeon;
  try {
    const pg: any = await import('pg');
    const Pool = pg?.default?.Pool ?? pg?.Pool;
    if (!Pool) return null;
    poolNeon = new Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: url.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
    });
    return poolNeon;
  } catch (error) {
    g.console?.error?.('[productos] no se pudo cargar pg:', error);
    return null;
  }
}

async function consultarNeon(sql: string, valores: unknown[] = []): Promise<any[]> {
  const pool = await poolDeNeon();
  if (!pool) return [];
  try {
    const r = await pool.query(sql, valores);
    return r?.rows ?? [];
  } catch (error) {
    g.console?.error?.('[productos] error en Neon:', error);
    return [];
  }
}

// ── Supabase (respaldo) ──

/** Proyecto de Supabase (la tabla de productos de respaldo y la autenticacion). */
const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

/** URL de Supabase (la del entorno si es valida, si no la de por defecto). */
function urlSupabase(): string {
  const configurada = entorno().SUPABASE_URL ?? '';
  if (/^https?:\/\/[^\s]+$/.test(configurada)) return configurada.replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO.replace(/\/+$/, '');
}

/** Clave de servicio de Supabase. */
function claveSupabase(): string {
  const env = entorno();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

/** Envía la respuesta y cierra la petición. */
function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

/** Normaliza la foto: si no es una URL ni una ruta nuestra, se descarta. */
function fotoUtil(foto: unknown): string | null {
  const texto = String(foto ?? '').trim();
  if (!texto) return null;
  if (texto.startsWith('http://') || texto.startsWith('https://')) return texto;
  if (texto.startsWith('/')) return texto;
  return null;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req?.method && req.method !== 'GET') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  // 1) Neon (la fuente de verdad de los productos)
  const filas = await consultarNeon(
    'select id, name, description, price, image_url, is_available, category_id from products order by id',
  );

  if (filas.length) {
    responder(
      res,
      filas.map((f) => ({
        id: f.id,
        nombre: String(f.name ?? ''),
        precio: Number(f.price ?? 0),
        descripcion: f.description ?? null,
        imagen: fotoUtil(f.image_url),
        categoria_id: f.category_id ?? null,
        // false = agotado (el panel lo cambia)
        disponible: f.is_available !== false,
      })),
    );
    return;
  }

  // 2) Supabase (respaldo)
  const key = claveSupabase();
  if (!key) {
    responder(res, { error: 'No hay catálogo configurado' }, 503);
    return;
  }

  try {
    const respuesta = await g.fetch(
      urlSupabase() + '/rest/v1/productos?select=id,nombre,precio,categoria,disponible&order=id',
      {
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          Accept: 'application/json',
        },
      },
    );

    if (!respuesta.ok) {
      const texto = await respuesta.text();
      g.console?.error?.('[productos] Supabase respondió', respuesta.status, texto.slice(0, 200));
      responder(res, { error: 'No se pudo leer el catálogo' }, 502);
      return;
    }

    const datos: any[] = await respuesta.json();
    responder(
      res,
      datos.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        precio: Number(f.precio),
        categoria: f.categoria,
        disponible: f.disponible !== false,
      })),
    );
  } catch (error) {
    g.console?.error?.('[productos] error:', error);
    responder(res, { error: 'No se pudo leer el catálogo' }, 502);
  }
}
