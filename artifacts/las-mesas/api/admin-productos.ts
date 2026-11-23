// API del panel de inventario (/admin/inventario).
//
//   GET   -> lista de productos con su disponibilidad
//   PATCH  -> { id, is_available } cambia la disponibilidad de un producto
//
// Administración gestiona productos; Barra y Cocina solo acceden a sus vistas
// operativas. El token se valida contra Supabase Auth.
// Authorization: Bearer <token> y se valida contra Supabase Auth.
//
// Los productos viven en NEON, en la tabla `products`
// (id, name, description, price, image_url, is_available, category_id).
import { origenDelMismoSitio, puedeEntrar, rolDeUsuario, usuarioDeSolicitud } from './_admin-auth.js';
import { autorizarDispositivo, idDispositivoAutorizado } from './_staff-devices.js';

type Global = Record<string, any>;

const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?:
    | { get?: (nombre: string) => string | null }
    | Record<string, string | string[] | undefined>;
  body?: unknown;
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

const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';
function urlSupabase(): string {
  const configurada = String(entorno().SUPABASE_URL ?? '').trim();
  if (/^https?:\/\/[^\s]+$/.test(configurada)) return configurada.replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO;
}
function claveSupabase(): string {
  const variables = entorno();
  return variables.SUPABASE_SECRET_KEY ?? variables.SUPABASE_SERVICE_ROLE_KEY ?? '';
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
  if (String(req?.method ?? 'GET').toUpperCase() !== 'GET' && !origenDelMismoSitio(req)) {
    responder(res, { error: 'Origen no autorizado.' }, 403);
    return;
  }
  const usuario = await usuarioDeSolicitud(req, res);
  if (!usuario) {
    responder(res, { error: 'La sesión ha caducado: vuelve a entrar' }, 401);
    return;
  }
  const rol = rolDeUsuario(usuario);
  if (!rol) {
    responder(res, { error: 'Esta cuenta no está autorizada para usar los paneles' }, 403);
    return;
  }

  // Vista de cocina dentro de la misma función para no superar el límite de
  // funciones serverless del proyecto.
  const vistaPedidos = Array.isArray(req.query?.vista) ? req.query?.vista[0] : req.query?.vista;
  if ((!req?.method || req.method === 'GET') && (vistaPedidos === 'cocina' || vistaPedidos === 'barra')) {
    if (!puedeEntrar(rol, vistaPedidos)) {
      responder(res, { error: 'Esta cuenta no tiene acceso a este panel' }, 403);
      return;
    }
    if (rol !== 'admin' && !await autorizarDispositivo(req, vistaPedidos)) {
      responder(res, { error: 'Este dispositivo no está autorizado para recibir pedidos de este panel.' }, 403);
      return;
    }
    const esVistaBarra = vistaPedidos === 'barra';
    const pool = await poolDeNeon();
    if (!pool) {
      responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
      return;
    }
    try {
      await pool.query(`alter table public.pedidos
        add column if not exists estado_cocina text not null default 'pendiente'`);
      const resultado = await pool.query(
        `select p.id, p.id_pedido, p.cliente_nombre, p.cliente_telefono, p.direccion,
                p.productos, p.total, p.tipo_entrega, p.estado, p.estado_cocina, p.fecha,
                coalesce(to_jsonb(p)->>'mesa', to_jsonb(p)->>'mesa_id', '') as mesa
         from public.pedidos p
         where coalesce(p.fecha, now()) >= now() - interval '${esVistaBarra ? '30 days' : '3 days'}'
           and lower(btrim(coalesce(p.estado, ''))) in ('pagado', 'paid')
         order by p.fecha desc nulls last, p.id desc
         limit ${esVistaBarra ? 500 : 150}`,
      );
      const pedidos = resultado.rows.map((fila: any) => {
        let productos = fila.productos;
        if (typeof productos === 'string') {
          try { productos = JSON.parse(productos); } catch { productos = []; }
        }
        if (!Array.isArray(productos)) productos = Array.isArray(productos?.items) ? productos.items : [];
        return {
          id: Number(fila.id),
          codigo: String(fila.id_pedido ?? fila.id ?? ''),
          cliente: String(fila.cliente_nombre ?? ''),
          telefono: String(fila.cliente_telefono ?? ''),
          direccion: String(fila.direccion ?? ''),
          mesa: String(fila.mesa ?? ''),
          productos,
          total: Number(fila.total ?? 0),
          tipoEntrega: String(fila.tipo_entrega ?? '').toLowerCase(),
          estadoPago: String(fila.estado ?? '').toLowerCase(),
          estadoCocina: String(fila.estado_cocina ?? 'pendiente').toLowerCase(),
          fecha: fila.fecha ? new Date(fila.fecha).toISOString() : null,
        };
      });
      responder(res, esVistaBarra
        ? { pedidos, pushPublicKey: String(entorno().VAPID_PUBLIC_KEY ?? '').trim() || null }
        : { pedidos, pushPublicKey: String(entorno().VAPID_PUBLIC_KEY ?? '').trim() || null });
    } catch (error) {
      g.console?.error?.('[admin] no se pudieron cargar los pedidos de cocina:', error);
      responder(res, { error: 'No se pudieron cargar los pedidos de cocina' }, 502);
    }
    return;
  }

  // Avanza únicamente el estado operativo de cocina; el estado de pago se
  // conserva aparte en `pedidos.estado`.
  if (req?.method === 'POST') {
    const body = leerCuerpo(req);
    const accion = String(body.accion ?? '').toLowerCase();
    if (accion === 'registrar_push' || accion === 'eliminar_push') {
      const panelPush = String(body.panel ?? '').toLowerCase();
      if ((panelPush !== 'barra' && panelPush !== 'cocina') || !puedeEntrar(rol, panelPush)) {
        responder(res, { error: 'Esta cuenta no puede gestionar los avisos de ese panel' }, 403);
        return;
      }
      const deviceId = rol === 'admin' ? null : await idDispositivoAutorizado(req, panelPush);
      if (rol !== 'admin' && !deviceId) { responder(res, { error: 'Este dispositivo no está autorizado para los avisos de ese panel.' }, 403); return; }
      const subscription = body.subscription && typeof body.subscription === 'object' ? body.subscription : null;
      const endpoint = String(subscription?.endpoint ?? '').trim();
      if (!endpoint || !/^https:\/\//i.test(endpoint)) {
        responder(res, { error: 'La suscripción de notificaciones no es válida' }, 400);
        return;
      }
      const pool = await poolDeNeon();
      if (!pool) {
        responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
        return;
      }
      try {
        await pool.query(`create table if not exists public.cocina_push_subscriptions (
          endpoint text primary key,
          subscription jsonb not null,
          paneles text[] not null default array['cocina']::text[],
          created_at timestamptz not null default now(),
          last_seen timestamptz not null default now(),
          device_id text
        )`);
        await pool.query(`alter table public.cocina_push_subscriptions
          add column if not exists paneles text[] not null default array['cocina']::text[]`);
        await pool.query(`alter table public.cocina_push_subscriptions add column if not exists device_id text`);
        if (accion === 'registrar_push') {
          await pool.query(
            `insert into public.cocina_push_subscriptions as push_actual (endpoint, subscription, paneles, device_id)
             values ($1, $2::jsonb, array[$3]::text[], $4)
             on conflict (endpoint) do update set
               subscription = excluded.subscription,
               paneles = case when $3 = any(push_actual.paneles)
                 then push_actual.paneles
                 else array_append(push_actual.paneles, $3) end,
               device_id = excluded.device_id,
               last_seen = now()`,
            [endpoint, JSON.stringify(subscription), panelPush, deviceId],
          );
          responder(res, { ok: true, activo: true });
        } else {
          await pool.query(
            `update public.cocina_push_subscriptions
             set paneles = array_remove(paneles, $2), last_seen = now()
             where endpoint = $1 and $2 = any(paneles) and ($3::text is null or device_id = $3)`,
            [endpoint, panelPush, deviceId],
          );
          await pool.query(
            'delete from public.cocina_push_subscriptions where endpoint = $1 and cardinality(paneles) = 0',
            [endpoint],
          );
          responder(res, { ok: true, activo: false });
        }
      } catch (error) {
        g.console?.error?.('[admin] no se pudo guardar la suscripción push de cocina:', error);
        responder(res, { error: 'No se pudo guardar la configuración de avisos' }, 502);
      }
      return;
    }
    if (String(body.accion ?? '').toLowerCase() === 'actualizar_cocina') {
      if (!puedeEntrar(rol, 'cocina')) {
        responder(res, { error: 'Solo Cocina o Administración puede cambiar el estado de preparación' }, 403);
        return;
      }
      if (rol !== 'admin' && !await autorizarDispositivo(req, 'cocina')) {
        responder(res, { error: 'Este dispositivo no está autorizado para Cocina.' }, 403);
        return;
      }
      const id = Number(body.id);
      const siguiente = String(body.estado_cocina ?? '').toLowerCase();
      const estadosValidos = new Set(['confirmado', 'preparando', 'listo', 'servido', 'en_reparto', 'entregado']);
      if (!Number.isInteger(id) || id <= 0 || !estadosValidos.has(siguiente)) {
        responder(res, { error: 'Datos de pedido no válidos' }, 400);
        return;
      }
      const pool = await poolDeNeon();
      if (!pool) {
        responder(res, { error: 'Neon no está configurado (falta DATABASE_URL)' }, 503);
        return;
      }
      try {
        await pool.query(`alter table public.pedidos
          add column if not exists estado_cocina text not null default 'pendiente'`);
        const actual = await pool.query('select estado_cocina, tipo_entrega from public.pedidos where id = $1', [id]);
        const pedido = actual.rows?.[0];
        if (!pedido) {
          responder(res, { error: 'No se encontró el pedido' }, 404);
          return;
        }
        const estadoActual = String(pedido.estado_cocina ?? 'pendiente').toLowerCase();
        const tipoEntrega = String(pedido.tipo_entrega ?? '').toLowerCase();
        const transiciones: Record<string, string[]> = {
          pendiente: ['confirmado'],
          confirmado: ['preparando'],
          preparando: ['listo'],
          listo: tipoEntrega === 'mesa' ? ['servido'] : ['en_reparto'],
          en_reparto: ['entregado'],
        };
        if (!transiciones[estadoActual]?.includes(siguiente)) {
          responder(res, { error: 'Ese cambio de estado no está permitido' }, 409);
          return;
        }
        const actualizado = await pool.query(
          `update public.pedidos set estado_cocina = $2
           where id = $1 and estado_cocina = $3 returning id, estado_cocina`,
          [id, siguiente, estadoActual],
        );
        if (!actualizado.rows?.length) {
          responder(res, { error: 'El pedido cambió mientras lo actualizabas. Actualiza la lista.' }, 409);
          return;
        }
        responder(res, { ok: true, id, estadoCocina: siguiente });
      } catch (error) {
        g.console?.error?.('[admin] no se pudo actualizar el estado de cocina:', error);
        responder(res, { error: 'No se pudo actualizar el pedido' }, 502);
      }
      return;
    }
  }

  if (rol !== 'admin') {
    responder(res, { error: 'Solo Administración puede gestionar productos y opciones' }, 403);
    return;
  }

  // 2) Listar
  if (!req?.method || req.method === 'GET') {
    const filas = await consultarNeon(
      'select id, name, description, price, image_url, is_available, category_id, option_group_ids from products order by name',
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
        option_group_ids: f.option_group_ids ?? [],
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
      // Grupos de opciones asociados (solo ids existentes, como TEXT[])
      const idsGrupos: string[] = Array.isArray(body.option_group_ids)
        ? body.option_group_ids.map((x: any) => String(x))
        : [];
      const id =
        body.id === undefined || body.id === null || body.id === '' ? null : Number(body.id);

      try {
        if (id !== null && Number.isFinite(id)) {
          const r = await pool.query(
            'update products set name = $2, description = $3, price = $4, image_url = $5, category_id = $6, is_available = $7, option_group_ids = $8 where id = $1 returning id, name, description, price, image_url, category_id, is_available, option_group_ids',
            [id, nombre, descripcion, precio, imagen, categoriaId, disponible, idsGrupos],
          );
          if (!r?.rows?.length) {
            responder(res, { error: 'No se encontró ese producto' }, 404);
            return;
          }
          responder(res, { ok: true, creado: false, producto: r.rows[0] });
          return;
        }

        // Producto nuevo: el id se calcula aqui (max + 1) para no depender
        // de que la columna tenga un default.
        const siguiente = await pool.query(
          'select coalesce(max(id), 0) + 1 as id from public.products',
        );
        const idNuevo = Number(siguiente?.rows?.[0]?.id ?? 1);
        const r = await pool.query(
          'insert into products (id, name, description, price, image_url, category_id, is_available, option_group_ids) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, name, description, price, image_url, category_id, is_available, option_group_ids',
          [idNuevo, nombre, descripcion, precio, imagen, categoriaId, disponible, idsGrupos],
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
