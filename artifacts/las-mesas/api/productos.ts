// API de la carta: devuelve los productos de la tabla `productos` de Supabase
// (id, nombre, precio, categoria), que es la MISMA fuente de verdad que usa el
// flujo de n8n para recalcular los importes de cada pedido.
//
// Si los ids o los precios no coinciden con los de Supabase, n8n rechaza el
// pedido por "Precio manipulado", asi que la web debe leer siempre de aqui.
//
// Las fotos, descripciones y alergenos los añade el frontend (ver
// src/products.ts), porque aqui no hay acceso a los ficheros de /assets.

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


/** Envía la respuesta y cierra la petición. */
function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req?.method && req.method !== 'GET') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const key = claveSupabase();
  const url = urlSupabase();

  if (!key) {
    responder(res, { error: 'Supabase no está configurado' }, 503);
    return;
  }

  try {
    const respuesta = await g.fetch(
      url + '/rest/v1/productos?select=id,nombre,precio,categoria&disponible=eq.true&order=id',
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

    const filas: any[] = await respuesta.json();

    responder(
      res,
      filas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        precio: Number(f.precio),
        categoria: f.categoria,
      })),
    );
  } catch (error) {
    g.console?.error?.('[productos] error:', error);
    responder(res, { error: 'No se pudo leer el catálogo' }, 502);
  }
}
