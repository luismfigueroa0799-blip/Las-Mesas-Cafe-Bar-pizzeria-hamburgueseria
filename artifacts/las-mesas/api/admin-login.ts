import { puedeEntrar, rolDeUsuario, tokenDeCabecera, usuarioDelToken } from '../server/admin-auth.js';

type Global = Record<string, any>;
const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null } | Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
}

function env(): Record<string, string | undefined> { return (g.process?.env ?? {}) as Record<string, string | undefined>; }
function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}
function leerCuerpo(req: Req): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  return (req.body ?? {}) as Record<string, unknown>;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const method = String(req.method ?? 'GET').toUpperCase();

  // El panel valida la sesión y recibe su rol al abrir cualquier ruta privada.
  if (method === 'GET') {
    const user = await usuarioDelToken(tokenDeCabecera(req));
    const role = rolDeUsuario(user);
    if (!user || !role) {
      responder(res, { error: 'La sesión no es válida o esta cuenta no tiene acceso a los paneles.' }, user ? 403 : 401);
      return;
    }
    responder(res, { email: user.email, role });
    return;
  }
  if (method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  const body = leerCuerpo(req);
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  const panelSolicitado = String(body.panel ?? 'admin').toLowerCase();
  const panel = panelSolicitado === 'barra' || panelSolicitado === 'cocina' ? panelSolicitado : 'admin';
  if (!email || !password) {
    responder(res, { error: 'Escribe tu correo y tu contraseña' }, 400);
    return;
  }
  const key = env().SUPABASE_SECRET_KEY ?? env().SUPABASE_SERVICE_ROLE_KEY ?? '';
  const url = String(env().SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co').replace(/\/+$/, '');
  if (!key) {
    responder(res, { error: 'Supabase no está configurado' }, 503);
    return;
  }

  try {
    const auth = await g.fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const raw = await auth.text();
    if (!auth.ok) {
      let message = 'No hemos podido iniciar sesión';
      try {
        const error = JSON.parse(raw);
        message = String(error?.error_description ?? error?.msg ?? error?.message ?? message);
      } catch { /* respuesta no JSON */ }
      responder(res, { error: message }, 401);
      return;
    }

    const data = JSON.parse(raw);
    const token = String(data?.access_token ?? '');
    const user = await usuarioDelToken(token);
    const role = rolDeUsuario(user);
    if (!user || !role) {
      responder(res, { error: 'Esta cuenta no está autorizada para acceder a los paneles.' }, 403);
      return;
    }
    if (!puedeEntrar(role, panel)) {
      const nombrePanel = panel === 'admin' ? 'Administración' : panel === 'barra' ? 'Barra' : 'Cocina';
      responder(res, { error: `Esta cuenta no tiene permiso para entrar en ${nombrePanel}.` }, 403);
      return;
    }

    responder(res, { token, email: user.email, role, expira_en: Number(data?.expires_in ?? 3600) });
  } catch (error) {
    g.console?.error?.('[admin-login] error:', error);
    responder(res, { error: 'No se pudo iniciar sesión' }, 502);
  }
}
