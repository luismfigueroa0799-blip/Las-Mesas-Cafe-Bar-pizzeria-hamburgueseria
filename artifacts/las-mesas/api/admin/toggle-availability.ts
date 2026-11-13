// API para cambiar la disponibilidad de un producto.
//
//   POST /api/admin/toggle-availability
//   { "id": 4, "is_available": false }
//
// Actualiza la columna is_available de la tabla products de NEON.
//
// Solo puede entrar el usuario staff: se valida el token contra Supabase Auth
// y se comprueba que tenga el rol 'staff' (en raw_app_meta_data, en
// app_metadata o en user_metadata) o que su correo este en STAFF_EMAILS.
//
// Las urls de retorno no aplican aqui (esto es Vite, no Next.js): la pagina
// publica de la carta no cachea el catalogo, asi que en cuanto se cambia algo
// la siguiente carga ya ve el producto como agotado. Ademas el panel avisa a
// las pestanas abiertas para que la carta se refresque sola.
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

/** Correos con acceso al panel (STAFF_EMAILS). */
function correosStaff(): string[] {
  return String(entorno().STAFF_EMAILS ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * El rol 'staff' puede estar en:
 *   - raw_app_meta_data.role  (donde lo ha puesto el usuario)
 *   - app_metadata.role       (alias)
 *   - user_metadata.role      (metadatos del usuario)
 */
function esStaff(usuario: any): boolean {
  const email = String(usuario?.email ?? '').trim().toLowerCase();
  if (!email) return false;

  const lista = correosStaff();
  if (lista.length && lista.includes(email)) return true;

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
    g.console?.error?.('[toggle] no se pudo cargar pg:', error);
    return null;
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (!req?.method || req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

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
    responder(res, { error: 'Acceso denegado: esta cuenta no es staff' }, 403);
    return;
  }

  // 2) Neon'se
  const pool = await poolDeNeon();
  if (!pool) {
    responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
    return;
  }

  const body = leerCuerpo(req);
  const id = Number(body.id);
  const isAvailable = body.is_available === true || body.is_available === 'true';

  if (!Number.isFinite(id)) {
    responder(res, { error: 'Falta el id del producto' }, 400);
    return;
  }

  try {
    const r = await pool.query(
      'update products set is_available = $2 where id = $1 returning id, name, is_available',
      [id, isAvailable],
    );
    if (!r?.rows?.length) {
      responder(res, { error: 'No se encontró ese producto' }, 404);
      return;
    }
    responder(res, {
      ok: true,
      id: r.rows[0].id,
      nombre: r.rows[0].name,
      is_available: r.rows[0].is_available !== false,
      // La carta publica se refresca sola con este aviso.
      menu: 'actualizado',
    });
  } catch (error) {
    g.console?.error?.('[toggle] error al actualizar:', error);
    responder(res, { error: 'No se pudo actualizar el producto' }, 502);
  }
}
