import { cerrarSesion, esCorreoAdministracion, guardarSesion, origenDelMismoSitio, puedeEntrar, rolDeUsuario, usuarioDeSolicitud } from './_admin-auth.js';

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
  setHeader(clave: string, valor: string | string[]): void;
}

function env(): Record<string, string | undefined> { return (g.process?.env ?? {}) as Record<string, string | undefined>; }
function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}
function leerCuerpo(req: Req): Record<string, any> {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return (req.body ?? {}) as Record<string, any>;
}
function apiAuth(): { key: string; url: string } {
  return {
    key: String(env().SUPABASE_SECRET_KEY ?? env().SUPABASE_SERVICE_ROLE_KEY ?? ''),
    url: String(env().SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co').replace(/\/+$/, ''),
  };
}
async function authCall(path: string, method: string, body: unknown): Promise<any> {
  const { key, url } = apiAuth();
  const response = await g.fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* no JSON */ }
  if (!response.ok) throw new Error(String(data?.msg ?? data?.message ?? data?.error_description ?? data?.error_code ?? data?.error ?? 'No se pudo completar la verificación.'));
  return data;
}
export default async function handler(req: Req, res: Res): Promise<void> {
  const method = String(req.method ?? 'GET').toUpperCase();
  if (method === 'DELETE') {
    if (!origenDelMismoSitio(req)) { responder(res, { error: 'Origen no autorizado.' }, 403); return; }
    await cerrarSesion(req, res); responder(res, { ok: true }); return;
  }

  if (method === 'GET') {
    const user = await usuarioDeSolicitud(req, res);
    const role = rolDeUsuario(user);
    if (!user || !role) { responder(res, { error: 'La sesión no es válida o esta cuenta no tiene acceso a los paneles.' }, user ? 403 : 401); return; }
    responder(res, { email: user.email, role });
    return;
  }
  if (method !== 'POST') { responder(res, { error: 'Método no permitido' }, 405); return; }
  if (!origenDelMismoSitio(req)) { responder(res, { error: 'Origen no autorizado.' }, 403); return; }
  const body = leerCuerpo(req);
  const action = String(body.action ?? 'login');

  const email = String(body.email ?? '').trim().toLowerCase();
  const { key, url } = apiAuth();
  if (!key) { responder(res, { error: 'Supabase no está configurado.' }, 503); return; }

  if (action === 'send_admin_email_code') {
    if (!email || !email.includes('@')) { responder(res, { error: 'Escribe el correo de Administración.' }, 400); return; }
    // Solo el correo autorizado de Administración puede solicitar el acceso.
    if (!esCorreoAdministracion(email)) { responder(res, { error: 'Usa el correo autorizado de Administración.' }, 403); return; }
    try {
      const data = await authCall('otp', 'POST', { email, create_user: false });
      responder(res, { code_sent: true, ...(data?.message_id ? { message_id: data.message_id } : {}) });
    } catch (error) {
      g.console?.error?.('[admin-login] no se pudo solicitar el código de correo');
      responder(res, { error: 'No se pudo enviar el código. Espera un momento e inténtalo otra vez.' }, 502);
    }
    return;
  }

  if (action === 'verify_admin_email_code') {
    const code = String(body.code ?? '').replace(/\s/g, '');
    if (!email || !esCorreoAdministracion(email) || !/^\d{6}$/.test(code)) {
      responder(res, { error: 'Escribe el código de seis cifras enviado al correo autorizado.' }, 400); return;
    }
    try {
      const session = await authCall('verify', 'POST', { type: 'email', email, token: code });
      const user = session?.user;
      const role = rolDeUsuario(user);
      if (!session?.access_token || !session?.refresh_token || role !== 'admin') {
        responder(res, { error: 'El código no es válido o ha caducado. Solicita uno nuevo.' }, 401); return;
      }
      guardarSesion(res, session);
      responder(res, { email: user.email, role, expira_en: Number(session.expires_in ?? 3600) });
    } catch {
      responder(res, { error: 'El código no es válido o ha caducado. Solicita uno nuevo.' }, 401);
    }
    return;
  }

  if (action !== 'login') { responder(res, { error: 'Acción no válida.' }, 400); return; }
  const password = String(body.password ?? '');
  const panelSolicitado = String(body.panel ?? 'admin').toLowerCase();
  const panel = panelSolicitado === 'barra' || panelSolicitado === 'cocina' ? panelSolicitado : 'admin';
  if (!email || !password) { responder(res, { error: 'Escribe tu correo y tu contraseña.' }, 400); return; }
  try {
    const auth = await g.fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    const data = await auth.json().catch(() => ({}));
    if (!auth.ok) { responder(res, { error: String(data?.error_description ?? data?.msg ?? 'No hemos podido iniciar sesión.') }, 401); return; }
    const user = data?.user;
    const role = rolDeUsuario(user);
    if (!user || !role) { responder(res, { error: 'Esta cuenta no está autorizada para acceder a los paneles.' }, 403); return; }
    if (!puedeEntrar(role, panel)) {
      const nombre = panel === 'admin' ? 'Administración' : panel === 'barra' ? 'Barra' : 'Cocina';
      responder(res, { error: `Esta cuenta no tiene permiso para entrar en ${nombre}.` }, 403); return;
    }

    if (role === 'admin') {
      responder(res, { error: 'Administración ahora inicia sesión con un código enviado al correo.' }, 400); return;
    }
    guardarSesion(res, data);
    responder(res, { email: user.email, role, expira_en: Number(data?.expires_in ?? 3600) });
  } catch (error) {
    g.console?.error?.('[admin-login] error:', error);
    responder(res, { error: (error as Error)?.message ?? 'No se pudo iniciar sesión.' }, 502);
  }
}
