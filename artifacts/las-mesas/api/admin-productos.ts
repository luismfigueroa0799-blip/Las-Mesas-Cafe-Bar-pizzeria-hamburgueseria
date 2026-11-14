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
  headers?:
    | { get?: (nombre: string) => string | null }
    | Record<string, string | string[] | undefined>;
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

/**
 * Lee una cabecera de la peticion.
 *
 * En las serverless functions de Vercel (runtime Node) req.headers es un
 * objeto plano, no un Headers: headers.get() no existe y el token de
 * Authorization nunca llegaba (el panel devolvia 401 siempre).
 */
function valorCabecera(req: Req, nombre: string): string {
  const cabeceras: any = req?.headers;
  if (!cabeceras) return '';
  if (typeof cabeceras.get === 'function') return String(cabeceras.get(nombre) ?? '');
  const valor = cabeceras[nombre];
  return Array.isArray(valor) ? String(valor[0] ?? '') : String(valor ?? '');
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
  if (lista.length && lista.includes(email)) return true;

  // El rol 'staff' puede estar en raw_app_meta_data (donde lo ha puesto el
  // usuario), en app_metadata o en user_metadata.
  const roles = [
    usuario?.raw_app_meta_data?.role,
    usuario?.app_metadata?.role,
    usuario?.user_metadata?.role,
  ];
  return roles.some((r) => String(r ?? '').toLowerCase() === 'staff');
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
  const cruda = valorCabecera(req, 'authorization');
  const partes = cruda.split(' ').filter(Boolean);
  return partes.length > 1 && partes[0].toLowerCase() === 'bearer' ? partes.slice(1).join(' ') : '';
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

  // 3) Guardar un producto (crear o actualizar) o borrarlo.
  //
  //   { accion: 'guardar', id?, name, description, price, image_url,
  //     category_id, is_available? }
  //   { accion: 'borrar', id }
  if (req.method === 'POST' || req.method === 'DELETE') {
    const body = leerCuerpo(req);
    const accion = String(body.accion ?? '').toLowerCase();

    // ---- Borrar ----
    if (accion === 'borrar') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        responder(res, { error: 'Falta el id del producto' }, 400);
        return;
      }
      const pool = await poolDeNeon();
      if (!pool) {
        responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
        return;
      }
      try {
        const r = await pool.query('delete from products where id = $1 returning id', [id]);
        if (!r?.rows?.length) {
          responder(res, { error: 'No se encontró ese producto' }, 404);
          return;
        }
        responder(res, { ok: true, borrado: id });
      } catch (error) {
        g.console?.error?.('[admin] no se pudo borrar el producto:', error);
        responder(res, { error: 'No se pudo borrar el producto de Neon' }, 502);
      }
      return;
    }

    // ---- Guardar ----
    if (accion === 'guardar') {
      const pool = await poolDeNeon();
      if (!pool) {
        responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
        return;
      }

      const nombre = String(body.name ?? '').trim();
      const precio = Number(body.price ?? 0);
      if (!nombre) {
        responder(res, { error: 'El nombre del producto no puede estar vacío' }, 400);
        return;
      }
      if (!Number.isFinite(precio) || precio < 0) {
        responder(res, { error: 'El precio no es válido' }, 400);
        return;
      }

      const descripcion = body.description ? String(body.description) : null;
      const imagen = body.image_url ? String(body.image_url) : null;
      const categoriaId =
        body.category_id === null || body.category_id === undefined || body.category_id === ''
          ? null
          : Number(body.category_id);
      const disponible = body.is_available === undefined ? true : body.is_available !== false;
      const id =
        body.id === undefined || body.id === null || body.id === '' ? null : Number(body.id);

      try {
        if (id !== null && Number.isFinite(id)) {
          const r = await pool.query(
            'update products set name = $2, description = $3, price = $4, image_url = $5, category_id = $6, is_available = $7 where id = $1 returning id, name, description, price, image_url, category_id, is_available',
            [id, nombre, descripcion, precio, imagen, categoriaId, disponible],
          );
          if (!r?.rows?.length) {
            responder(res, { error: 'No se encontró ese producto' }, 404);
            return;
          }
          responder(res, { ok: true, creado: false, producto: r.rows[0] });
          return;
        }

        // Producto nuevo: el id lo pone la base de datos.
        const r = await pool.query(
          'insert into products (name, description, price, image_url, category_id, is_available) values ($1, $2, $3, $4, $5, $6) returning id, name, description, price, image_url, category_id, is_available',
          [nombre, descripcion, precio, imagen, categoriaId, disponible],
        );
        responder(res, { ok: true, creado: true, producto: r?.rows?.[0] ?? null });
      } catch (error) {
        g.console?.error?.('[admin] no se pudo guardar el producto:', error);
        responder(res, { error: 'No se pudo guardar el producto en Neon' }, 502);
      }
      return;
    }
  }

  // 4) Importar la carta desde Supabase a la tabla `products` de Neon.
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
        // Primero se busca si ya existe (para no depender de que
        // `id` sea clave primaria) y se actualiza o se inserta.
        const existe = await pool.query('select id from products where id = $1', [id]);
        if (existe?.rowCount) {
          await pool.query(
            'update products set name = $2, price = $3, is_available = $4 where id = $1',
            [id, nombre, precio, disponible],
          );
          actualizados += 1;
        } else {
          await pool.query(
            'insert into products (id, name, description, price, image_url, is_available, category_id) values ($1, $2, $3, $4, $5, $6, $7)',
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
          insertados += 1;
        }
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
