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
    const accionRuleta = req.body?.action;
    if (accionRuleta !== 'ruleta' && accionRuleta !== 'preparar-ruleta') {
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
        redeemed_at timestamptz,
        is_winner boolean not null default true
      )`);
      // Adaptación automática para instalaciones que ya tenían la tabla de
      // premios de la primera versión de la ruleta.
      await pool.query('alter table public.ruleta_premios add column if not exists is_winner boolean not null default true');
      await pool.query('alter table public.ruleta_premios alter column token_hash drop not null');
      await pool.query('alter table public.ruleta_premios alter column product_id drop not null');
      await pool.query(`create table if not exists public.ruleta_vales (
        token_hash text primary key,
        client_hash text not null,
        product_id bigint not null,
        created_at timestamptz not null default now(),
        redeemed_at timestamptz
      )`);
      // Conserva premios creados por versiones anteriores en la nueva tabla
      // de vales, que permite tener más de un premio pendiente por dispositivo.
      await pool.query(
        `insert into public.ruleta_vales (token_hash, client_hash, product_id, created_at, redeemed_at)
         select token_hash, client_hash, product_id, created_at, redeemed_at
         from public.ruleta_premios where token_hash is not null and product_id is not null
         on conflict (token_hash) do nothing`,
      );
      await pool.query(`create table if not exists public.ruleta_sesiones (
        session_id text primary key,
        client_hash text not null,
        sectors jsonb not null,
        prize_product_id bigint not null,
        prize_index integer not null,
        created_at timestamptz not null default now(),
        consumed_at timestamptz
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
      const aleatorioMenorQue = (limite: number): number => {
        const maximo = Math.floor(0x100000000 / limite) * limite;
        let valor = 0;
        do {
          const muestra = new Uint32Array(1);
          crypto.getRandomValues(muestra);
          valor = muestra[0];
        } while (valor >= maximo);
        return valor % limite;
      };
      // En cada apertura se prepara una rueda nueva: un producto aleatorio y
      // nueve espacios vacíos conservan la probabilidad visual del 10 %.
      const productoPreparado = elegibles[aleatorioMenorQue(elegibles.length)];
      const indicePreparado = aleatorioMenorQue(10);
      const sectores = Array.from({ length: 10 }, (_, indice) =>
        indice === indicePreparado
          ? { id: productoPreparado.id, name: productoPreparado.name, image: productoPreparado.image, weight: 0.1, premiable: true }
          : { id: `vacio-${indice}`, name: '', image: null, weight: 0.1, premiable: false },
      );
      if (accionRuleta === 'preparar-ruleta') {
        const sessionBytes = new Uint8Array(24);
        crypto.getRandomValues(sessionBytes);
        const sessionId = Array.from(sessionBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
        await pool.query('delete from public.ruleta_sesiones where created_at < now() - interval \'1 day\'');
        await pool.query(
          `insert into public.ruleta_sesiones (session_id, client_hash, sectors, prize_product_id, prize_index)
           values ($1, $2, $3::jsonb, $4, $5)`,
          [sessionId, clientHash, JSON.stringify(sectores), Number(productoPreparado.id), indicePreparado],
        );
        responder(res, { sessionId, sectores });
        return;
      }

      const sessionId = String(req.body?.sessionId ?? '').trim();
      if (!/^[a-f0-9]{48}$/.test(sessionId)) {
        responder(res, { error: 'La ruleta ha caducado. Recarga la página para intentarlo de nuevo.' }, 400);
        return;
      }
      const sesionResult = await pool.query(
        `update public.ruleta_sesiones set consumed_at = now()
         where session_id = $1 and client_hash = $2 and consumed_at is null
           and created_at > now() - interval '30 minutes'
         returning sectors, prize_product_id, prize_index`,
        [sessionId, clientHash],
      );
      const sesion = sesionResult.rows?.[0];
      if (!sesion) {
        responder(res, { error: 'La ruleta ha caducado. Recarga la página para intentarlo de nuevo.' }, 409);
        return;
      }
      const sectoresSesion = Array.isArray(sesion.sectors) ? sesion.sectors : JSON.parse(String(sesion.sectors));
      const indiceProducto = Number(sesion.prize_index);
      const productoVisible = elegibles.find((p: any) => Number(p.id) === Number(sesion.prize_product_id));
      if (!productoVisible || !Array.isArray(sectoresSesion) || sectoresSesion.length !== 10 || !Number.isInteger(indiceProducto)) {
        responder(res, { error: 'No se pudo preparar esta ruleta. Recarga la página.' }, 409);
        return;
      }
      const anterior = await pool.query(
        `select product_id, token_hash, redeemed_at, is_winner,
                created_at > now() - interval '7 days' as cooldown_activo
         from public.ruleta_premios where client_hash = $1`,
        [clientHash],
      );
      const filaAnterior = anterior.rows?.[0];

      // La ruleta vuelve a mostrarse durante el periodo de espera, pero esos
      // giros son siempre sin premio. El resultado original y su token siguen
      // intactos, por si el premio anterior aún está en el carrito.
      if (filaAnterior?.cooldown_activo) {
        let indiceResultado = aleatorioMenorQue(9);
        if (indiceResultado >= indiceProducto) indiceResultado += 1;
        responder(res, {
          ganador: false,
          motivo: filaAnterior.is_winner === true ? 'ya-premiado' : 'periodo-espera',
          indiceResultado,
          premio: null,
          token: null,
          nuevoSorteo: false,
          sectores: sectoresSesion,
        });
        return;
      }

      const indiceResultado = aleatorioMenorQue(10);
      const ganador = indiceResultado === indiceProducto;
      let premio: any = null;
      let token: string | null = null;
      let tokenHash: string | null = null;
      let productId: number | null = null;
      if (ganador) {
        premio = productoVisible;
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
        tokenHash = await digest(token);
        productId = Number(premio.id);
        await pool.query(
          `insert into public.ruleta_vales (token_hash, client_hash, product_id)
           values ($1, $2, $3) on conflict (token_hash) do nothing`,
          [tokenHash, clientHash, productId],
        );
      }
      await pool.query(
        `insert into public.ruleta_premios (client_hash, token_hash, product_id, created_at, redeemed_at, is_winner)
         values ($1, $2, $3, now(), null, $4)
         on conflict (client_hash) do update set token_hash = excluded.token_hash,
           product_id = excluded.product_id, created_at = now(), redeemed_at = null,
           is_winner = excluded.is_winner`,
        [clientHash, tokenHash, productId, ganador],
      );
      responder(res, { ganador, premio, token, indiceResultado, nuevoSorteo: true, sectores: sectoresSesion });
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
