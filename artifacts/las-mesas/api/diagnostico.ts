// Diagnostico: comprueba desde el servidor de Vercel que se puede:
//   1. Resolver y conectar con el webhook de n8n.
//   2. Leer y escribir en Supabase.
//
// Uso:  GET /api/diagnostico
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null };
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

// ── Configuracion comun (inline: Vercel no empaqueta imports fuera de api/) ──

/** Webhook de n8n que crea el pedido y devuelve la url de la pasarela de Stripe. */
const N8N_WEBHOOK_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';
/** Version de pruebas (solo responde una llamada tras "Execute workflow"). */
const N8N_WEBHOOK_TEST_POR_DEFECTO =
  'https://barcafeteria.app.n8n.cloud/webhook-test/crear-pedido-domicilio';
/** Proyecto de Supabase (misma base de datos que usa el flujo de n8n). */
const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

/** Una URL es valida si es http(s) y no contiene un placeholder sin cambiar. */
function esUrlValida(valor: string | undefined): boolean {
  const texto = String(valor ?? '').trim();
  if (!texto) return false;
  if (texto.includes('<') || texto.includes('>')) return false;
  if (texto.includes('cambiar') || texto.includes('PEGAR_AQUI')) return false;
  return /^https?:\/\/[^\s]+$/.test(texto);
}

/** URL del webhook de n8n (la del entorno si es valida, si no la de por defecto). */
function urlWebhookN8n(produccion = true): string {
  const env = entorno();
  const configurada = (produccion ? env.N8N_WEBHOOK_URL : env.N8N_WEBHOOK_URL_TEST) ?? '';
  if (esUrlValida(configurada)) return configurada.trim().replace(/\/+$/, '');
  return (produccion ? N8N_WEBHOOK_POR_DEFECTO : N8N_WEBHOOK_TEST_POR_DEFECTO).replace(
    /\/+$/,
    '',
  );
}

/** URL de Supabase (la del entorno si es valida, si no la de por defecto). */
function urlSupabase(): string {
  const configurada = entorno().SUPABASE_URL ?? '';
  if (esUrlValida(configurada)) return configurada.trim().replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO.replace(/\/+$/, '');
}

/** Clave de servicio de Supabase (necesaria para escribir en la tabla pedidos). */
function claveSupabase(): string {
  const env = entorno();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

/** Configuracion de Supabase para la API REST, o null si no hay clave. */
function configSupabase(): { url: string; key: string } | null {
  const key = claveSupabase();
  if (!key) return null;
  return { url: urlSupabase(), key };
}


export default async function handler(req: Req, res: Res): Promise<void> {
  const env = entorno();
  // Se muestra la URL que se usaria de verdad (con el valor por defecto si
  // la variable del entorno es un placeholder).
  const urlN8n = urlWebhookN8n(true);
  const urlSupabaseReal = urlSupabase();
  const keySupabase =
    env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const resultado: Record<string, unknown> = {
    variables: {
      N8N_WEBHOOK_URL: urlN8n,
      SUPABASE_URL: urlSupabaseReal,
      SUPABASE_SECRET_KEY: claveSupabase() ? 'configurada' : 'FALTA',
      N8N_WEBHOOK_URL_TEST: env.N8N_WEBHOOK_URL_TEST ? 'configurada' : 'no',
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY ? 'configurada' : 'FALTA',
      DATABASE_URL: env.DATABASE_URL ? 'configurada' : 'FALTA (los pedidos van a Supabase)',
      N8N_WEBHOOK_NOTIFICAR: env.N8N_WEBHOOK_NOTIFICAR ? 'configurada' : 'no',
    },
  };

  // 1) DNS + conexion con n8n
  if (urlN8n) {
    const inicio = Date.now();
    try {
      const r = await g.fetch(urlN8n, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: 4, qty: 1 }] }),
        signal: AbortSignal.timeout(20000),
      });
      const texto = await r.text();
      resultado.n8n = {
        ok: r.ok,
        estado: r.status,
        ms: Date.now() - inicio,
        respuesta: texto.slice(0, 300),
      };
    } catch (error) {
      resultado.n8n = {
        ok: false,
        ms: Date.now() - inicio,
        error: error instanceof Error ? error.message : String(error),
        causa: error instanceof Error ? String(error.cause ?? '') : '',
      };
    }
  }

  // 2) Supabase: lectura de la tabla productos
  if (urlSupabaseReal && claveSupabase()) {
    try {
      const r = await g.fetch(urlSupabaseReal + '/rest/v1/productos?select=id&limit=1', {
        headers: { apikey: claveSupabase(), Authorization: 'Bearer ' + claveSupabase() },
        signal: AbortSignal.timeout(15000),
      });
      const texto = await r.text();
      resultado.supabase = {
        ok: r.ok,
        estado: r.status,
        respuesta: texto.slice(0, 200),
      };
    } catch (error) {
      resultado.supabase = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 3) Neon (base de datos de los pedidos): conexion y estado de la tabla
  const urlNeon = String(env.DATABASE_URL ?? env.NEON_DATABASE_URL ?? '').trim();
  if (!urlNeon) {
    resultado.neon = {
      ok: false,
      error: 'Falta DATABASE_URL: los pedidos se guardan en Supabase en vez de en Neon.',
    };
  } else {
    try {
      const pg: any = await import('pg');
      const Pool = pg?.default?.Pool ?? pg?.Pool;
      const pool = new Pool({
        connectionString: urlNeon,
        max: 1,
        connectionTimeoutMillis: 10000,
        ssl: urlNeon.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
      });
      const inicio = Date.now();
      try {
        const r = await pool.query(
          "select count(*)::int as total from information_schema.tables where table_schema = 'public' and table_name = 'pedidos'",
        );
        const existe = Number(r?.rows?.[0]?.total ?? 0) > 0;
        let columnas = '';
        if (existe) {
          const c = await pool.query(
            "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' order by ordinal_position",
          );
          columnas = (c?.rows ?? []).map((x: any) => x.column_name).join(', ');
        }
        const pedidos = existe
          ? await pool.query('select count(*)::int as total from public.pedidos')
          : null;
        // Claves primarias: hacen falta para saber si se puede usar
        // "on conflict" al importar productos.
        const pk = await pool.query(
          "select tc.table_name, kcu.column_name from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'",
        );
        // La tabla de productos (la carta) y su numero de filas.
        const tablas = await pool.query(
          "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
        );
        const existeProductos = (tablas?.rows ?? []).some(
          (t: any) => t.table_name === 'products',
        );
        let productos = null;
        let columnasProductos = '';
        if (existeProductos) {
          const cp = await pool.query(
            "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'products' order by ordinal_position",
          );
          columnasProductos = (cp?.rows ?? []).map((x: any) => x.column_name).join(', ');
          const np = await pool.query('select count(*)::int as total from public.products');
          productos = np?.rows?.[0]?.total ?? 0;
        }
        // Prueba real de escritura: se inserta un producto de prueba y se
        // borra. Si esto funciona, la importacion del panel tambien.
        let pruebaProductos = 'no se pudo comprobar';
        if (existeProductos) {
          try {
            const r = await pool.query(
              "insert into products (id, name, description, price, image_url, is_available, category_id) values (-999, 'prueba', null, 0, null, true, null) returning id",
            );
            const idInsertado = r?.rows?.[0]?.id;
            await pool.query('delete from products where id = $1', [idInsertado ?? -999]);
            pruebaProductos = 'ok (se puede escribir y borrar en products)';
          } catch (error) {
            pruebaProductos =
              'FALLO: ' + (error instanceof Error ? error.message : String(error)).slice(0, 300);
          }
        }

        resultado.neon = {
          ok: true,
          ms: Date.now() - inicio,
          pruebaProductos,
          tablas: (tablas?.rows ?? []).map((t: any) => t.table_name),
          clavesPrimarias: (pk?.rows ?? []).map(
            (x: any) => x.table_name + '.' + x.column_name,
          ),
          tablaPedidos: existe,
          columnas,
          pedidos: pedidos?.rows?.[0]?.total ?? null,
          tablaProductos: existeProductos,
          columnasProductos,
          productos,
        };
      } finally {
        await pool.end().catch(() => {});
      }
    } catch (error) {
      resultado.neon = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        causa: error instanceof Error ? String(error.cause ?? '') : '',
      };
    }
  }

  res.status(200);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(resultado);
}
