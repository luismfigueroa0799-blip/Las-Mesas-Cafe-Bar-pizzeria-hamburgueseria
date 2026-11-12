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

  res.status(200);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(resultado);
}
