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
  if (!response.ok) {
    const error = new Error(String(data?.msg ?? data?.message ?? data?.error_description ?? data?.error_code ?? data?.error ?? 'No se pudo completar la verificación.')) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = String(data?.code ?? data?.error_code ?? '');
    throw error;
  }
  return data;
}

function cabecera(req: Req, nombre: string): string {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(nombre) ?? '');
  const mapa = headers as Record<string, string | string[] | undefined>;
  const raw = mapa[nombre] ?? mapa[nombre.toLowerCase()];
  return String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '');
}
function nombreCookiePendiente(): string {
  return env().VERCEL === '1' || env().NODE_ENV === 'production' ? '__Host-lm_admin_pending' : 'lm_admin_pending';
}
function tokenPendiente(req: Req): string {
  const name = nombreCookiePendiente();
  for (const part of cabecera(req, 'cookie').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0 || part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return ''; }
  }
  return '';
}
function cookiePendiente(token: string, segundos: number): string {
  const secure = env().VERCEL === '1' || env().NODE_ENV === 'production' ? '; Secure' : '';
  return `${nombreCookiePendiente()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${segundos}${secure}`;
}
function errorDeEnvio(error: unknown): string {
  const detalle = error as Error & { status?: number; code?: string };
  if (detalle?.status === 429 || /over_email_send_rate_limit|rate limit/i.test(`${detalle?.code ?? ''} ${detalle?.message ?? ''}`)) {
    return 'Se han solicitado demasiados códigos. Espera un minuto y vuelve a intentarlo.';
  }
  if (/email_address_not_authorized/i.test(`${detalle?.code ?? ''} ${detalle?.message ?? ''}`)) {
    return 'Supabase no autoriza ese destinatario con el SMTP actual. Revisa el proveedor y la dirección remitente.';
  }
  if (/smtp|email.*send|sending.*email/i.test(`${detalle?.code ?? ''} ${detalle?.message ?? ''}`)) {
    return 'Supabase no pudo enviar el correo. Revisa el host, el usuario y la contraseña de aplicación SMTP.';
  }
  return 'No se pudo enviar el código. Comprueba la configuración SMTP e inténtalo de nuevo.';
}
async function usuarioDeToken(token: string): Promise<any | null> {
  const { key, url } = apiAuth();
  const response = await g.fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
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

  if (action === 'begin_admin_email_code') {
    const password = String(body.password ?? '');
    if (!email || !email.includes('@') || !password) { responder(res, { error: 'Escribe el correo y la contraseña de Administración.' }, 400); return; }
    // Solo el correo autorizado de Administración puede solicitar el acceso.
    if (!esCorreoAdministracion(email)) { responder(res, { error: 'Usa el correo autorizado de Administración.' }, 403); return; }
    try {
      const passwordResponse = await g.fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const authenticated = await passwordResponse.json().catch(() => ({}));
      if (!passwordResponse.ok || rolDeUsuario(authenticated?.user) !== 'admin') {
        responder(res, { error: 'El correo o la contraseña no son correctos.' }, 401); return;
      }
      const data = await authCall('otp', 'POST', { email, create_user: false });
      res.setHeader('Set-Cookie', cookiePendiente(String(authenticated.access_token), 300));
      responder(res, { code_sent: true, ...(data?.message_id ? { message_id: data.message_id } : {}) });
    } catch (error) {
      const detalle = error as Error & { status?: number; code?: string };
      g.console?.error?.('[admin-login] error al enviar código:', { status: detalle?.status, code: detalle?.code, message: detalle?.message });
      res.setHeader('Set-Cookie', cookiePendiente('', 0));
      responder(res, { error: errorDeEnvio(error) }, 502);
    }
    return;
  }

  if (action === 'resend_admin_email_code') {
    if (!email || !esCorreoAdministracion(email)) { responder(res, { error: 'Usa el correo autorizado de Administración.' }, 403); return; }
    const pendingToken = tokenPendiente(req);
    if (!pendingToken) { responder(res, { error: 'La verificación ha caducado. Inicia sesión otra vez.' }, 401); return; }
    try {
      const pendingUser = await usuarioDeToken(pendingToken);
      if (!pendingUser || String(pendingUser.email ?? '').toLowerCase() !== email || rolDeUsuario(pendingUser) !== 'admin') {
        res.setHeader('Set-Cookie', cookiePendiente('', 0));
        responder(res, { error: 'La verificación ha caducado. Inicia sesión otra vez.' }, 401); return;
      }
      await authCall('otp', 'POST', { email, create_user: false });
      responder(res, { code_sent: true });
    } catch (error) {
      const detalle = error as Error & { status?: number; code?: string };
      g.console?.error?.('[admin-login] error al reenviar código:', { status: detalle?.status, code: detalle?.code, message: detalle?.message });
      responder(res, { error: errorDeEnvio(error) }, 502);
    }
    return;
  }

  if (action === 'verify_admin_email_code') {
    const code = String(body.code ?? '').replace(/\s/g, '');
    if (!email || !esCorreoAdministracion(email) || !/^\d{6,8}$/.test(code)) {
      responder(res, { error: 'Escribe el código de 6 u 8 cifras enviado al correo autorizado.' }, 400); return;
    }
    const pendingToken = tokenPendiente(req);
    if (!pendingToken) { responder(res, { error: 'La verificación ha caducado. Vuelve a escribir tu contraseña para recibir otro código.' }, 401); return; }
    try {
      const pendingUser = await usuarioDeToken(pendingToken);
      if (!pendingUser || String(pendingUser.email ?? '').toLowerCase() !== email || rolDeUsuario(pendingUser) !== 'admin') {
        res.setHeader('Set-Cookie', cookiePendiente('', 0));
        responder(res, { error: 'La verificación ha caducado. Vuelve a iniciar sesión.' }, 401); return;
      }
      const session = await authCall('verify', 'POST', { type: 'email', email, token: code });
      const user = session?.user;
      const role = rolDeUsuario(user);
      if (!session?.access_token || !session?.refresh_token || role !== 'admin' || user?.id !== pendingUser.id) {
        responder(res, { error: 'El código no es válido o ha caducado. Solicita uno nuevo.' }, 401); return;
      }
      guardarSesion(res, session, [cookiePendiente('', 0)]);
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

    if (role === 'admin') { responder(res, { error: 'Para Administración, vuelve al inicio y solicita el código de verificación.' }, 400); return; }
    guardarSesion(res, data);
    responder(res, { email: user.email, role, expira_en: Number(data?.expires_in ?? 3600) });
  } catch (error) {
    g.console?.error?.('[admin-login] error:', error);
    responder(res, { error: (error as Error)?.message ?? 'No se pudo iniciar sesión.' }, 502);
  }
}
