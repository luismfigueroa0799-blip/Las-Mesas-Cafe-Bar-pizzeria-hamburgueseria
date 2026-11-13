// API del panel de inventario (/admin/inventario).
//
//   GET   -> lista de productos con su disponibilidad
//   PATCH  -> { id, is_available } cambia la disponibilidad de un producto
//
// Solo puede entrar el usuario "staff" (STAFF_EMAILS en el entorno o con
// user_metadata.role = 'staff'). El token lo manda el navegador en la cabecera
// Authorization: Bearer <token> y se valida contra Supabase Auth.
//
// Los productos viven en NEON, en la tabla `products`
// (id, name, description, price, image_url, is_available, category_id).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null };
  body?: unknown;
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

// ── Supabase Auth ──

const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

function urlSupabase(): string {
  const configurada = String(entorno().SUPABASE_URL ?? '').trim();
  if (/^https?:\/\/[^\s]+$/.test(configurada)) return configurada.replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO;
}

function claveSupabase(): string {
  const env = entorno();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

function correosStaff(): string[] {
  return String(entorno().STAFF_EMAILS ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function esStaff(usuario: any): boolean {
  const email = String(usuario?.email ?? '').trim().toLowerCase();
  if (!email) return false;
  const lista = correosStaff();
  if (lista.length) return lista.includes(email);
  return String(usuario?.user_metadata?.role ?? '').toLowerCase() === 'staff';
}

async function usuarioDelToken(token: string): Promise<any | null> {
  const key = claveSupabase();
  if (!key || !token) return null;
  try {
    const r = await g.fetch(urlSupabase() + '/auth/v1/user', {
      headers: { apikey: key, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function tokenDeCabecera(req: Req): string {
  const cruda = String(req?.headers?.get?.('authorization') ?? '');
  const partes = cruda.split(' ');
  return partes.length > 1 && partes[0].toLowerCase() === 'bearer' ? partes[1] : '';
}

function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

function leerCuerpo(req: Req): Record<string, any> {
  const body = req?.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return (body ?? {}) as Record<string, any>;
}

// ── Neon ──

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
    g.console?.error?.('[admin] no se pudo cargar pg:', error);
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
    g.console?.error?.('[admin] error en Neon:', error);
    return [];
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  // 1) Solo el staff
  const token = tokenDeCabecera(req);
  if (!token) {
    responder(res, { error: 'Necesitas iniciar sesión' }, 401);
    return;
  }
  const usuario = await usuarioDelToken(token);
  if (!usuario) {
    responder(res, { error: 'La sesión ha caducado: vuelve a entrar' }, 401);
    return;
  }
  if (!esStaff(usuario)) {
    responder(res, { error: 'Esta cuenta no tiene acceso al inventario' }, 403);
    return;
  }

  // 2) Listar
  if (!req?.method || req.method === 'GET') {
    const filas = await consultarNeon(
      'select id, name, description, price, image_url, is_available, category_id from products order by name',
    );
    responder(
      res,
      filas.map((f) => ({
        id: f.id,
        nombre: String(f.name ?? ''),
        descripcion: f.description ?? '',
        precio: Number(f.price ?? 0),
        imagen: f.image_url ?? null,
        categoria_id: f.category_id ?? null,
        disponible: f.is_available !== false,
      })),
    );
    return;
  }

  // 3) Importar la carta desde Supabase a la tabla `products` de Neon.
  //
  // Los ids se copian tal cual para que coincidan con los que usa el flujo
  // de n8n. Si el producto ya existe en Neon se actualiza (nombre, precio y
  // disponibilidad), sin tocar la foto ni la descripcion que se hayan puesto
  // a mano.
  if (req.method === 'POST') {
    const body = leerCuerpo(req);
    if (String(body.accion ?? '').toLowerCase() !== 'importar') {
      responder(res, { error: 'Acción no válida' }, 400);
      return;
    }

    const key = claveSupabase();
    if (!key) {
      responder(res, { error: 'Supabase no está configurado' }, 503);
      return;
    }

    let origen: any[] = [];
    try {
      const r = await g.fetch(
        urlSupabase() +
          '/rest/v1/productos?select=id,nombre,precio,categoria,disponible&order=id',
        { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } },
      );
      if (!r.ok) throw new Error('Supabase respondió ' + r.status);
      origen = await r.json();
    } catch (error) {
      g.console?.error?.('[admin] no se pudo leer la carta de Supabase:', error);
      responder(res, { error: 'No se pudo leer la carta de origen' }, 502);
      return;
    }

    if (!Array.isArray(origen) || !origen.length) {
      responder(res, { error: 'La carta de origen está vacía' }, 400);
      return;
    }

    const pool = await poolDeNeon();
    if (!pool) {
      responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
      return;
    }

    let insertados = 0;
    let actualizados = 0;
    try {
      for (const p of origen) {
        const id = Number(p.id);
        if (!Number.isFinite(id)) continue;
        const nombre = String(p.nombre ?? '');
        const precio = Number(p.precio ?? 0);
        const disponible = p.disponible !== false;
        const r = await pool.query(
          `insert into products (id, name, description, price, image_url, is_available, category_id)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update
             set name = excluded.name,
                 price = excluded.price,
                 is_available = excluded.is_available
           returning id, (xmax = 0) as insertado`,
          [
            id,
            nombre,
            p.descripcion ?? null,
            precio,
            p.image_url ?? null,
            disponible,
            p.categoria_id ?? null,
          ],
        );
        const fueInsertado = r?.rows?.[0]?.insertado === true;
        if (fueInsertado) insertados += 1;
        else actualizados += 1;
      }
    } catch (error) {
      g.console?.error?.('[admin] error importando la carta:', error);
      responder(res, { error: 'No se pudo escribir la carta en Neon' }, 502);
      return;
    }

    const total = await consultarNeon('select count(*)::int as total from products');
    responder(res, {
      ok: true,
      insertados,
      actualizados,
      total: total?.[0]?.total ?? 0,
    });
    return;
  }

  // 4) Cambiar la disponibilidad
  if (req.method === 'PATCH') {
    const body = leerCuerpo(req);
    const id = Number(body.id);
    const disponible = body.is_available === true || body.is_available === 'true';

    if (!Number.isFinite(id)) {
      responder(res, { error: 'Falta el id del producto' }, 400);
      return;
    }

    const filas = await consultarNeon(
      'update products set is_available = $2 where id = $1 returning id, name, is_available',
      [id, disponible],
    );
    if (!filas.length) {
      responder(res, { error: 'No se encontró ese producto' }, 404);
      return;
    }
    responder(res, {
      ok: true,
      id: filas[0].id,
      nombre: filas[0].name,
      disponible: filas[0].is_available !== false,
    });
    return;
  }

  responder(res, { error: 'Método no permitido' }, 405);
}
