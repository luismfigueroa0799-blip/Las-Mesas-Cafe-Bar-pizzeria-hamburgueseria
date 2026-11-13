// Login del panel de inventario.
//
// El navegador NO manda la clave de Supabase: envia usuario y contrasena a
// esta funcion, que hace el login contra Supabase Auth con la clave de
// servicio (que se queda en el servidor) y devuelve el token del usuario.
//
// Variables de entorno:
//   SUPABASE_URL / SUPABASE_SECRET_KEY   proyecto de Supabase Auth
//   STAFF_EMAILS                         correos con acceso al panel (separados
//                                        por comas). Si no se define, vale
//                                        cualquier usuario con
//                                        user_metadata.role = 'staff'.
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

/**
 * Lee una cabecera de la peticion.
 *
 * En las serverless functions de Vercel (runtime Node) req.headers es un
 * objeto plano, no un Headers: headers.get() no existe y el token de
 * Authorization nunca llegaba (el panel devolvia 401 siempre).
 */
function valorCabecera(req: Req, nombre: string): string {
  const cabeceras: any = req?.headers;
  if (!cabeceras) return '';
  if (typeof cabeceras.get === 'function') return String(cabeceras.get(nombre) ?? '');
  const valor = cabeceras[nombre];
  return Array.isArray(valor) ? String(valor[0] ?? '') : String(valor ?? '');
}


const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

function urlSupabase(): string {
  const configurada = String(entorno().SUPABASE_URL ?? '').trim();
  if (/^https?:\/\/[^\s]+$/.test(configurada)) return configurada.replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO;
}

function claveSupabase(): string {
  const env = entorno();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

function leerCuerpo(req: Req): Record<string, unknown> {
  const body = req?.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (body ?? {}) as Record<string, unknown>;
}

/** Correos con acceso al panel. */
function correosStaff(): string[] {
  return String(entorno().STAFF_EMAILS ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Comprueba si un usuario puede entrar en el panel: tiene que estar en la
 * lista STAFF_EMAILS o tener el rol 'staff' en sus metadatos.
 */
export function esStaff(usuario: any): boolean {
  const email = String(usuario?.email ?? '').trim().toLowerCase();
  if (!email) return false;

  const lista = correosStaff();
  if (lista.length && lista.includes(email)) return true;

  // El rol 'staff' puede estar en raw_app_meta_data (donde lo ha puesto el
  // usuario), en app_metadata o en user_metadata.
  const roles = [
    usuario?.raw_app_meta_data?.role,
    usuario?.app_metadata?.role,
    usuario?.user_metadata?.role,
  ];
  return roles.some((r) => String(r ?? '').toLowerCase() === 'staff');
}

/**
 * Valida el token de Supabase Auth y devuelve el usuario, o null.
 */
export async function usuarioDelToken(token: string): Promise<any | null> {
  const key = claveSupabase();
  if (!key || !token) return null;
  try {
    const r = await g.fetch(urlSupabase() + '/auth/v1/user', {
      headers: { apikey: key, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Token de la cabecera Authorization: "Bearer ...". */
export function tokenDeCabecera(req: Req): string {
  const cruda = valorCabecera(req, 'authorization');
  const partes = cruda.split(' ').filter(Boolean);
  return partes.length > 1 && partes[0].toLowerCase() === 'bearer' ? partes.slice(1).join(' ') : '';
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req?.method && req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const body = leerCuerpo(req);
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');

  if (!email || !password) {
    responder(res, { error: 'Escribe tu correo y tu contraseña' }, 400);
    return;
  }

  const key = claveSupabase();
  if (!key) {
    responder(res, { error: 'Supabase no está configurado' }, 503);
    return;
  }

  try {
    const r = await g.fetch(urlSupabase() + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const texto = await r.text();
    if (!r.ok) {
      let mensaje = 'No hemos podido iniciar sesión';
      try {
        const err = JSON.parse(texto);
        mensaje =
          String(err?.error_description ?? err?.msg ?? err?.message ?? mensaje) ||
          'Credenciales incorrectas';
      } catch {
        /* respuesta no json */
      }
      responder(res, { error: mensaje }, 401);
      return;
    }

    const datos = JSON.parse(texto);
    const token = String(datos?.access_token ?? '');
    const usuario = await usuarioDelToken(token);

    if (!usuario) {
      responder(res, { error: 'Sesión no válida' }, 401);
      return;
    }
    if (!esStaff(usuario)) {
      responder(res, { error: 'Esta cuenta no tiene acceso al inventario' }, 403);
      return;
    }

    responder(res, {
      token,
      email: usuario.email,
      expira_en: Number(datos?.expires_in ?? 3600),
    });
  } catch (error) {
    g.console?.error?.('[admin-login] error:', error);
    responder(res, { error: 'No se pudo iniciar sesión' }, 502);
  }
}
