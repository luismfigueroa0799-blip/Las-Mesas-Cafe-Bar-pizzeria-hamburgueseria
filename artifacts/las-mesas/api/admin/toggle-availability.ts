// API para cambiar la disponibilidad de un producto.
//
//   POST /api/admin/toggle-availability
//   { "id": 4, "is_available": false }
//
// Actualiza la columna is_available de la tabla products de NEON.
//
// Solo Administración puede modificar el catálogo.
//
// Las urls de retorno no aplican aqui (esto es Vite, no Next.js): la pagina
// publica de la carta no cachea el catalogo, asi que en cuanto se cambia algo
// la siguiente carga ya ve el producto como agotado. Ademas el panel avisa a
// las pestanas abiertas para que la carta se refresque sola.
import { origenDelMismoSitio, rolDeUsuario, usuarioDeSolicitud } from '../_admin-auth.js';

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
  if (!origenDelMismoSitio(req)) {
    responder(res, { error: 'Origen no autorizado.' }, 403);
    return;
  }

  // 1) Solo el staff
  const usuario = await usuarioDeSolicitud(req, res);
  if (!usuario) {
    responder(res, { error: 'La sesión ha caducado: vuelve a entrar' }, 401);
    return;
  }
  if (rolDeUsuario(usuario) !== 'admin') {
    responder(res, { error: 'Solo Administración puede cambiar la disponibilidad de productos' }, 403);
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
