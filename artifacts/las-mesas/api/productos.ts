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
  body?: any;
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

/**
 * Rellena la tabla products de Neon con la carta de Supabase, si esta vacia.
 *
 * Se hace una sola vez por instancia (asi la web nunca se queda sin carta
 * aunque alguien vacie la tabla). Los ids se copian tal cual para que
 * coincidan con los que usa el flujo de n8n.
 */
let importacionIntentada = false;

async function rellenarSiEstaVacia(): Promise<void> {
  if (importacionIntentada) return;
  importacionIntentada = true;
  try {
    const pool = await poolDeNeon();
    if (!pool) return;
    const total = await pool.query('select count(*)::int as total from products');
    if (Number(total?.rows?.[0]?.total ?? 0) > 0) return;

    const key = claveSupabase();
    if (!key) return;
    const r = await g.fetch(
      urlSupabase() + '/rest/v1/productos?select=id,nombre,precio,categoria,disponible&order=id',
      { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } },
    );
    if (!r.ok) return;
    const origen: any[] = await r.json();
    for (const p of origen) {
      const id = Number(p.id);
      if (!Number.isFinite(id)) continue;
      const existe = await pool.query('select id from products where id = $1', [id]);
      if (existe?.rowCount) {
        await pool.query(
          'update products set name = $2, price = $3, is_available = $4 where id = $1',
          [id, String(p.nombre ?? ''), Number(p.precio ?? 0), p.disponible !== false],
        );
      } else {
        await pool.query(
          'insert into products (id, name, description, price, image_url, is_available, category_id) values ($1, $2, $3, $4, $5, $6, $7)',
          [
            id,
            String(p.nombre ?? ''),
            p.descripcion ?? null,
            Number(p.precio ?? 0),
            p.image_url ?? null,
            p.disponible !== false,
            p.categoria_id ?? null,
          ],
        );
      }
    }
    g.console?.log?.('[productos] Carta importada en Neon:', origen.length);
  } catch (error) {
    g.console?.error?.('[productos] no se pudo rellenar la carta:', error);
  }
}

/**
 * Devuelve el nombre de la categoria de cada producto, buscandolo por su
 * nombre en la carta de Supabase (la tabla products de Neon solo tiene el
 * category_id y no hay tabla de categorias).
 */
async function categoriasPorNombre(nombres: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const key = claveSupabase();
  if (!key || !nombres.length) return mapa;

  const unicos = [...new Set(nombres.filter(Boolean))];
  try {
    const r = await g.fetch(
      urlSupabase() + '/rest/v1/productos?select=nombre,categoria&order=id',
      { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } },
    );
    if (!r.ok) return mapa;
    const filas: any[] = await r.json();
    const porNombre = new Map<string, string>();
    for (const fila of filas) {
      if (fila?.nombre && fila?.categoria) porNombre.set(String(fila.nombre), String(fila.categoria));
    }
    for (const nombre of unicos) {
      const categoria = porNombre.get(nombre);
      if (categoria) mapa.set(nombre, categoria);
    }
  } catch (error) {
    g.console?.error?.('[productos] no se pudieron resolver las categorias:', error);
  }
  return mapa;
}

// Grupos de opciones con sus opciones (tabla product_options).
async function gruposConOpciones(): Promise<any[]> {
  const grupos = await consultarNeon('select id, name, type, required, min_choices, max_choices from public.option_groups order by name, id');
  if (!grupos.length) return [];
  const ops = await consultarNeon('select id, group_id, name, extra_price, available from public.product_options order by group_id, name, id');
  return grupos.map((grp) => ({
    id: String(grp.id),
    name: String(grp.name),
    type: String(grp.type || 'extra'),
    required: grp.required === true,
    min: Number(grp.min_choices ?? 0),
    max: Number(grp.max_choices ?? 1),
    options: ops.filter((o) => Number(o.group_id) === Number(grp.id)).map((o) => ({
      id: String(o.id),
      name: String(o.name),
      extraPrice: Number(o.extra_price ?? 0),
      available: o.available !== false,
    })),
  }));
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req?.method === 'POST') {
    if (req.body?.action !== 'ruleta') {
      responder(res, { error: 'Acción no válida' }, 400);
      return;
    }
    const clientId = String(req.body?.clientId ?? '').trim();
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(clientId)) {
      responder(res, { error: 'Identificador de cliente no válido' }, 400);
      return;
    }
    const pool = await poolDeNeon();
    if (!pool) {
      responder(res, { error: 'La ruleta no está disponible ahora. Inténtalo más tarde.' }, 503);
      return;
    }
    try {
      await rellenarSiEstaVacia();
      const crypto = g.crypto;
      if (!crypto?.subtle || !crypto?.getRandomValues) throw new Error('Generador seguro no disponible');
      const digest = async (value: string) => {
        const bytes = new TextEncoder().encode(value);
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
      };
      const clientHash = await digest(clientId);
      await pool.query(`create table if not exists public.ruleta_premios (
        client_hash text primary key,
        token_hash text not null,
        product_id bigint not null,
        created_at timestamptz not null default now(),
        redeemed_at timestamptz
      )`);
      const candidatos = await pool.query(
        `select id, name, price, image_url from public.products
         where is_available = true and price >= 0 and price <= 2
         order by id`,
      );
      const elegibles = (candidatos.rows ?? []).map((p: any) => ({
        id: String(p.id), name: String(p.name ?? ''), price: Number(p.price ?? 0), image: fotoUtil(p.image_url),
      })).filter((p: any) => p.name && Number.isFinite(p.price));
      if (!elegibles.length) {
        responder(res, { error: 'No hay productos disponibles para la ruleta en este momento.' }, 409);
        return;
      }
      const anterior = await pool.query(
        'select product_id, redeemed_at from public.ruleta_premios where client_hash = $1',
        [clientHash],
      );
      if (anterior.rows?.[0]?.redeemed_at) {
        responder(res, { error: 'Este cliente ya utilizó su premio de la ruleta.' }, 409);
        return;
      }
      const disponibles = anterior.rows?.[0]
        ? elegibles.filter((p: any) => p.id === String(anterior.rows[0].product_id))
        : elegibles;
      if (!disponibles.length) {
        responder(res, { error: 'El producto del premio ya no está disponible.' }, 409);
        return;
      }
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      let indicePremio = 0;
      if (!anterior.rows?.[0]) {
        const limite = Math.floor(0x100000000 / disponibles.length) * disponibles.length;
        let aleatorio = 0;
        do {
          const muestra = new Uint32Array(1);
          crypto.getRandomValues(muestra);
          aleatorio = muestra[0];
        } while (aleatorio >= limite);
        indicePremio = aleatorio % disponibles.length;
      }
      const premio = anterior.rows?.[0]
        ? disponibles[0]
        : disponibles[indicePremio];
      const tokenHash = await digest(token);
      await pool.query(
        `insert into public.ruleta_premios (client_hash, token_hash, product_id)
         values ($1, $2, $3)
         on conflict (client_hash) do update set token_hash = excluded.token_hash,
           product_id = excluded.product_id where public.ruleta_premios.redeemed_at is null`,
        [clientHash, tokenHash, Number(premio.id)],
      );
      responder(res, { premio, token, sectores: elegibles.map(({ id, name, image }: any) => ({ id, name, image })) });
      return;
    } catch (error) {
      g.console?.error?.('[productos] no se pudo procesar la ruleta:', error);
      responder(res, { error: 'No se pudo iniciar la ruleta. Inténtalo de nuevo.' }, 503);
      return;
    }
  }

  if (req?.method && req.method !== 'GET') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  // Si la tabla de Neon esta vacia, se rellena sola desde Supabase.
  await rellenarSiEstaVacia();

  // 1) Neon (la fuente de verdad de los productos)
  const filas = await consultarNeon(
    'select id, name, description, price, image_url, is_available, category_id, option_group_ids from products order by id',
  );

  if (filas.length) {
    // La tabla products de Neon guarda category_id, pero no hay tabla de
    // categorias: la categoria se resuelve por el nombre del producto en la
    // carta de Supabase. Sin esto, los productos que no estan en la carta se
    // quedan sin categoria y desaparecen de las pestanas.
    const categorias = await categoriasPorNombre(
      filas.map((f) => String(f.name ?? '')),
    );

    const todosLosGrupos = await gruposConOpciones();
    responder(
      res,
      filas.map((f) => {
        const idsGrupo = Array.isArray(f.option_group_ids)
          ? f.option_group_ids.map(String)
          : [];
        return {
          id: f.id,
          nombre: String(f.name ?? ''),
          precio: Number(f.price ?? 0),
          descripcion: f.description ?? null,
          imagen: fotoUtil(f.image_url),
          categoria_id: f.category_id ?? null,
          // El nombre de la categoria (la web lo usa para las pestanas).
          categoria: categorias.get(String(f.name ?? '')) ?? null,
          // false = agotado (el panel lo cambia)
          disponible: f.is_available !== false,
          optionGroupIds: idsGrupo,
          optionGroups: todosLosGrupos.filter((gr: any) => idsGrupo.includes(String(gr.id))),
        };
      }),
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
