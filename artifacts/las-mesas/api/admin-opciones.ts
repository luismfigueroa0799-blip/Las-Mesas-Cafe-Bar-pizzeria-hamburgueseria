// CRUD de grupos de opciones y sus opciones (panel de administración).
// La tabla de opciones se llama product_options (options es reservada en PG).
//
//  GET    -> lista todos los grupos con sus opciones
//  POST   -> { accion: 'crear_grupo', name, type, required, min_choices, max_choices }
//  POST   -> { accion: 'editar_grupo', id, ... }
//  POST   -> { accion: 'borrar_grupo', id }
//  POST   -> { accion: 'crear_opcion', group_id, name, extra_price }
//  POST   -> { accion: 'editar_opcion', id, name, extra_price, available }
//  POST   -> { accion: 'borrar_opcion', id }
//
// Solo staff (token de Supabase Auth).
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
}

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}
function responder(res: Res, cuerpo: unknown, codigo = 200): void {
  res.status(codigo).json(cuerpo);
}

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
    g.console?.error?.('[admin-opciones] pg:', error);
    return null;
  }
}

async function consultar(sql: string, valores: unknown[] = []): Promise<any[]> {
  const pool = await poolDeNeon();
  if (!pool) return [];
  const r = await pool.query(sql, valores);
  return r?.rows ?? [];
}

/** Validar token de staff con Supabase Auth. */
const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';
async function usuarioDelToken(token: string): Promise<any | null> {
  try {
    const url = String(entorno().SUPABASE_URL ?? SUPABASE_URL_POR_DEFECTO).replace(/\/$/, '');
    const key = String(entorno().SUPABASE_ANON_KEY ?? entorno().SUPABASE_SECRET_KEY ?? '');
    const r = await g.fetch(url + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: key },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
function esStaff(user: any): boolean {
  const permitidos = String(entorno().STAFF_EMAILS ?? 'lasmesascafeteriabar@gmail.com')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const correo = String(user?.email ?? '').toLowerCase();
  return permitidos.includes(correo) || user?.app_metadata?.role === 'staff';
}

async function listarGrupos(): Promise<any[]> {
  const grupos = await consultar('select * from public.option_groups order by name, id');
  const ops = await consultar('select * from public.product_options order by group_id, name, id');
  return grupos.map((grp) => ({
    ...grp,
    options: ops.filter((o) => Number(o.group_id) === Number(grp.id)),
  }));
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const token = String(req.headers?.get?.('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const user = await usuarioDelToken(token);
  if (!user || !esStaff(user)) {
    responder(res, { error: 'No autorizado' }, 401);
    return;
  }

  const metodo = String(req.method ?? 'GET').toUpperCase();
  if (metodo === 'GET') {
    responder(res, { grupos: await listarGrupos() });
    return;
  }
  if (metodo !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const body = (req.body ?? {}) as Record<string, any>;
  const accion = String(body.accion ?? '').toLowerCase();

  try {
    if (accion === 'crear_grupo') {
      const name = String(body.name ?? '').trim();
      const type = ['quitar','extra','elegir'].includes(String(body.type)) ? String(body.type) : 'extra';
      const required = body.required === true || body.required === 'true';
      const min = Math.max(0, Number(body.min_choices ?? 0) || 0);
      const max = Math.max(1, Number(body.max_choices ?? 1) || 1);
      if (!name) { responder(res, { error: 'Falta el nombre del grupo' }, 400); return; }
      const filas = await consultar(
        'insert into public.option_groups (name, type, required, min_choices, max_choices) values ($1,$2,$3,$4,$5) returning id',
        [name, type, required, min, max],
      );
      responder(res, { ok: true, id: filas[0]?.id, grupos: await listarGrupos() });
      return;
    }

    if (accion === 'editar_grupo') {
      const id = Number(body.id ?? 0);
      const name = String(body.name ?? '').trim();
      const type = ['quitar','extra','elegir'].includes(String(body.type)) ? String(body.type) : 'extra';
      const required = body.required === true || body.required === 'true';
      const min = Math.max(0, Number(body.min_choices ?? 0) || 0);
      const max = Math.max(1, Number(body.max_choices ?? 1) || 1);
      if (!id || !name) { responder(res, { error: 'Faltan datos' }, 400); return; }
      await consultar(
        'update public.option_groups set name=$2, type=$3, required=$4, min_choices=$5, max_choices=$6 where id=$1',
        [id, name, type, required, min, max],
      );
      responder(res, { ok: true, grupos: await listarGrupos() });
      return;
    }

    if (accion === 'borrar_grupo') {
      const id = Number(body.id ?? 0);
      if (!id) { responder(res, { error: 'Falta el id' }, 400); return; }
      // QUITAR el grupo de todos los productos que lo referencian
      await consultar(
        "update public.products set option_group_ids = array_remove(option_group_ids, $1) where $1 = any(option_group_ids)",
        [String(id)],
      );
      await consultar('delete from public.option_groups where id=$1', [id]); // CASCADE borra opciones
      responder(res, { ok: true, grupos: await listarGrupos() });
      return;
    }

    if (accion === 'crear_opcion') {
      const groupId = Number(body.group_id ?? 0);
      const name = String(body.name ?? '').trim();
      const extra = Math.max(0, Number(body.extra_price ?? 0) || 0);
      if (!groupId || !name) { responder(res, { error: 'Faltan datos' }, 400); return; }
      const filas = await consultar(
        'insert into public.product_options (group_id, name, extra_price) values ($1,$2,$3) returning id',
        [groupId, name, extra],
      );
      responder(res, { ok: true, id: filas[0]?.id, grupos: await listarGrupos() });
      return;
    }

    if (accion === 'editar_opcion') {
      const id = Number(body.id ?? 0);
      const name = String(body.name ?? '').trim();
      const extra = Math.max(0, Number(body.extra_price ?? 0) || 0);
      const available = body.available === undefined ? true : (body.available === true || body.available === 'true');
      if (!id || !name) { responder(res, { error: 'Faltan datos' }, 400); return; }
      await consultar(
        'update public.product_options set name=$2, extra_price=$3, available=$4 where id=$1',
        [id, name, extra, available],
      );
      responder(res, { ok: true, grupos: await listarGrupos() });
      return;
    }

    if (accion === 'borrar_opcion') {
      const id = Number(body.id ?? 0);
      if (!id) { responder(res, { error: 'Falta el id' }, 400); return; }
      await consultar('delete from public.product_options where id=$1', [id]);
      responder(res, { ok: true, grupos: await listarGrupos() });
      return;
    }

    responder(res, { error: 'Acción no reconocida' }, 400);
  } catch (error) {
    g.console?.error?.('[admin-opciones] error:', error);
    responder(res, { error: (error as Error)?.message ?? 'Error' }, 500);
  }
}
