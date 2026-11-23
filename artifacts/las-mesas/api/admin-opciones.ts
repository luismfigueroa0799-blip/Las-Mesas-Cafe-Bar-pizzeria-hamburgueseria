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
// Solo Administración (token de Supabase Auth).
import { origenDelMismoSitio, rolDeUsuario, usuarioDeSolicitud } from './_admin-auth.js';

type Global = Record<string, any>;
const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null } | Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string | string[]): void;
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

const HORARIO_INICIAL = {
  semanal: [
    [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }],
    [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }],
    [{ inicio: '18:00', fin: '23:00' }],
    [{ inicio: '12:00', fin: '15:00' }, { inicio: '18:00', fin: '23:00' }],
    [{ inicio: '12:00', fin: '17:00' }],
  ], festivos: [],
};

async function prepararTablaHorario(pool: any) {
  await pool.query(`create table if not exists public.business_hours (
    id text primary key, config jsonb not null, updated_at timestamptz not null default now()
  )`);
  await pool.query('insert into public.business_hours (id, config) values ($1, $2::jsonb) on conflict (id) do nothing', ['local', JSON.stringify(HORARIO_INICIAL)]);
}

function validarTramos(valor: unknown, permitirVacio = true): Array<{ inicio: string; fin: string }> {
  if (!Array.isArray(valor) || valor.length > 4 || (!permitirVacio && !valor.length)) throw new Error('Añade al menos un tramo horario válido.');
  const tramos = valor.map((tramo: any) => {
    const inicio = String(tramo?.inicio ?? ''); const fin = String(tramo?.fin ?? '');
    const minutos = (hora: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) : -1;
    if (minutos(inicio) < 0 || minutos(fin) <= minutos(inicio)) throw new Error('Revisa las horas: cada cierre debe ser posterior a su apertura.');
    return { inicio, fin };
  }).sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < tramos.length; i += 1) if (tramos[i].inicio < tramos[i - 1].fin) throw new Error('Los tramos de un día no pueden solaparse.');
  return tramos;
}

function validarHorario(valor: any) {
  if (!Array.isArray(valor?.semanal) || valor.semanal.length !== 7) throw new Error('Falta el horario de algún día de la semana.');
  const semanal = valor.semanal.map((tramos: unknown) => validarTramos(tramos));
  const dias = new Set<string>();
  const festivos = (Array.isArray(valor.festivos) ? valor.festivos : []).slice(0, 100).map((item: any) => {
    const fecha = String(item?.fecha ?? ''); const nombre = String(item?.nombre ?? '').trim().slice(0, 80);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T12:00:00Z`) : null;
    const fechaValida = Boolean(date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha);
    if (!fechaValida || !nombre || dias.has(fecha)) throw new Error('Revisa las fechas y nombres de los festivos; no puede repetirse una fecha.');
    dias.add(fecha);
    const cerrado = item?.cerrado === true;
    const tramos = cerrado ? [] : validarTramos(item?.tramos, false);
    return { fecha, nombre, cerrado, tramos };
  });
  return { semanal, festivos };
}

async function leerHorario(pool: any) {
  await prepararTablaHorario(pool);
  const filas = await consultar('select config from public.business_hours where id=$1', ['local']);
  return filas[0]?.config ?? HORARIO_INICIAL;
}

async function listarGrupos(): Promise<any[]> {
  const grupos = await consultar('select * from public.option_groups order by name, id');
  const ops = await consultar('select * from public.product_options order by group_id, name, id');
  return grupos.map((grp) => ({
    id: String(grp.id),
    name: String(grp.name ?? ''),
    type: ['quitar', 'extra', 'elegir'].includes(String(grp.type)) ? String(grp.type) : 'extra',
    required: grp.required === true,
    min: Number(grp.min_choices ?? 0),
    max: Number(grp.max_choices ?? 1),
    options: ops.filter((o) => Number(o.group_id) === Number(grp.id)).map((op) => ({
      id: String(op.id),
      name: String(op.name ?? ''),
      extraPrice: Number(op.extra_price ?? 0),
      available: op.available !== false,
    })),
  }));
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (String(req?.method ?? 'GET').toUpperCase() !== 'GET' && !origenDelMismoSitio(req)) {
    responder(res, { error: 'Origen no autorizado.' }, 403);
    return;
  }
  const user = await usuarioDeSolicitud(req, res);
  if (!user) {
    responder(res, { error: 'La sesión ha caducado: vuelve a entrar' }, 401);
    return;
  }
  if (rolDeUsuario(user) !== 'admin') {
    responder(res, { error: 'Solo Administración puede gestionar estas opciones' }, 403);
    return;
  }

  const metodo = String(req.method ?? 'GET').toUpperCase();
  if (metodo === 'GET') {
    if (String(req.query?.vista ?? '') === 'horario') {
      try {
        const pool = await poolDeNeon();
        if (!pool) throw new Error('No hay conexión con la base de datos.');
        responder(res, { horario: await leerHorario(pool) });
      } catch (error) {
        g.console?.error?.('[admin-opciones] horario:', error);
        responder(res, { error: (error as Error)?.message ?? 'No se pudo cargar el horario.' }, 503);
      }
      return;
    }
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
    if (accion === 'guardar_horario') {
      const horario = validarHorario(body.horario);
      const pool = await poolDeNeon();
      if (!pool) throw new Error('No hay conexión con la base de datos.');
      await prepararTablaHorario(pool);
      await pool.query(
        'insert into public.business_hours (id, config, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set config=excluded.config, updated_at=now()',
        ['local', JSON.stringify(horario)],
      );
      responder(res, { ok: true, horario });
      return;
    }

    if (accion === 'crear_grupo') {
      const name = String(body.name ?? '').trim();
      const type = ['quitar','extra','elegir'].includes(String(body.type)) ? String(body.type) : 'extra';
      const required = body.required === true || body.required === 'true';
      const min = Math.max(0, Number(body.min_choices ?? 0) || 0);
      const max = Math.max(1, Number(body.max_choices ?? 1) || 1);
      if (!name) { responder(res, { error: 'Falta el nombre del grupo' }, 400); return; }
      const categoryIds = Array.isArray(body.category_ids)
        ? [...new Set(body.category_ids.map(Number).filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 14))]
        : [];
      const pool = await poolDeNeon();
      if (!pool) throw new Error('No hay conexión con la base de datos.');
      const client = await pool.connect();
      let productosActualizados = 0;
      let groupId: string;
      try {
        await client.query('begin');
        const creada = await client.query(
          'insert into public.option_groups (name, type, required, min_choices, max_choices) values ($1,$2,$3,$4,$5) returning id',
          [name, type, required, min, max],
        );
        groupId = String(creada.rows?.[0]?.id ?? '');
        if (!groupId) throw new Error('No se pudo crear el grupo.');
        if (categoryIds.length) {
          const asociacion = await client.query(
            `update public.products
             set option_group_ids = array_append(coalesce(option_group_ids, ARRAY[]::text[]), $1)
             where category_id = any($2::int[])
               and not ($1 = any(coalesce(option_group_ids, ARRAY[]::text[])))`,
            [groupId, categoryIds],
          );
          productosActualizados = Number(asociacion.rowCount ?? 0);
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
      responder(res, { ok: true, id: groupId, productosActualizados, grupos: await listarGrupos() });
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
