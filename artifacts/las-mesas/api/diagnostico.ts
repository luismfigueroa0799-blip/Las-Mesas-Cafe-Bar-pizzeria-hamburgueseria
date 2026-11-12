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

export default async function handler(req: Req, res: Res): Promise<void> {
  const env = entorno();
  const urlN8n = (env.N8N_WEBHOOK_URL ?? '').trim();
  const urlSupabase = (env.SUPABASE_URL ?? '').trim();
  const keySupabase =
    env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const resultado: Record<string, unknown> = {
    variables: {
      N8N_WEBHOOK_URL: urlN8n ? 'configurada' : 'FALTA',
      SUPABASE_URL: urlSupabase ? 'configurada' : 'FALTA',
      SUPABASE_SECRET_KEY: keySupabase ? 'configurada' : 'FALTA',
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
  if (urlSupabase && keySupabase) {
    try {
      const r = await g.fetch(urlSupabase + '/rest/v1/productos?select=id&limit=1', {
        headers: { apikey: keySupabase, Authorization: 'Bearer ' + keySupabase },
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
