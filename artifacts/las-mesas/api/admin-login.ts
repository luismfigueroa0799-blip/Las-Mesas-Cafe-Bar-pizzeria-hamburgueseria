import { cerrarSesion, guardarSesion, origenDelMismoSitio, puedeEntrar, rolDeUsuario, tokenAal2, usuarioDeSolicitud } from './_admin-auth.js';

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
async function authCall(path: string, token: string, method = 'GET', body?: unknown): Promise<any> {
  const { key, url } = apiAuth();
  const response = await g.fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* no JSON */ }
  if (!response.ok) throw new Error(String(data?.msg ?? data?.message ?? data?.error_description ?? 'No se pudo completar la verificación.'));
  return data;
}
async function obtenerFactores(token: string): Promise<any[]> {
  const data = await authCall('factors', token);
  return Array.isArray(data) ? data : Array.isArray(data?.all) ? data.all : Array.isArray(data?.factors) ? data.factors : [];
}
async function crearDesafio(token: string, factorId: string): Promise<string> {
  const data = await authCall(`factors/${encodeURIComponent(factorId)}/challenge`, token, 'POST', {});
  return String(data?.id ?? data?.challenge_id ?? '');
}
async function verificarCodigo(token: string, factorId: string, challengeId: string, code: string): Promise<any> {
  return authCall(`factors/${encodeURIComponent(factorId)}/verify`, token, 'POST', { challenge_id: challengeId, code });
}
function sesionValida(session: any): boolean {
  return Boolean(session?.access_token && session?.refresh_token && tokenAal2(String(session.access_token)));
}
function terminarMfa(res: Res, session: any, email: string, role: string): void {
  if (!sesionValida(session)) { responder(res, { error: 'Supabase no confirmó el segundo factor. Inténtalo de nuevo.' }, 401); return; }
  guardarSesion(res, session);
  responder(res, { email, role, expira_en: Number(session.expires_in ?? 3600) });
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

  if (action === 'verify_mfa') {
    const token = String(body.pending_token ?? '');
    const factorId = String(body.factor_id ?? '');
    let challengeId = String(body.challenge_id ?? '');
    const code = String(body.code ?? '').replace(/\s/g, '');
    if (!token || !factorId || !challengeId || !/^\d{6,8}$/.test(code)) { responder(res, { error: 'Escribe el código de tu app autenticadora.' }, 400); return; }
    const user = await (async () => {
      const { key, url } = apiAuth();
      const r = await g.fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : null;
    })();
    const role = rolDeUsuario(user);
    if (!user || role !== 'admin') { responder(res, { error: 'La sesión de verificación ha caducado. Inicia sesión otra vez.' }, 401); return; }
    try {
      if (!challengeId) challengeId = await crearDesafio(token, factorId);
      if (!challengeId) throw new Error('No se pudo iniciar la verificación.');
      const session = await verificarCodigo(token, factorId, challengeId, code);
      terminarMfa(res, session, String(user.email), role);
    } catch (error) { responder(res, { error: (error as Error)?.message ?? 'Código no válido.' }, 401); }
    return;
  }

  if (action !== 'login') { responder(res, { error: 'Acción no válida.' }, 400); return; }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const panelSolicitado = String(body.panel ?? 'admin').toLowerCase();
  const panel = panelSolicitado === 'barra' || panelSolicitado === 'cocina' ? panelSolicitado : 'admin';
  if (!email || !password) { responder(res, { error: 'Escribe tu correo y tu contraseña.' }, 400); return; }
  const { key, url } = apiAuth();
  if (!key) { responder(res, { error: 'Supabase no está configurado.' }, 503); return; }

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

    if (role !== 'admin') {
      guardarSesion(res, data);
      responder(res, { email: user.email, role, expira_en: Number(data?.expires_in ?? 3600) });
      return;
    }

    const factors = await obtenerFactores(String(data.access_token));
    const verified = factors.find((factor) => factor?.factor_type === 'totp' && factor?.status === 'verified');
    if (verified) {
      const challengeId = await crearDesafio(String(data.access_token), String(verified.id));
      if (!challengeId) throw new Error('Supabase no devolvió el reto de autenticación.');
      responder(res, { mfa_required: true, pending_token: data.access_token, factor_id: verified.id, challenge_id: challengeId });
      return;
    }
    if (factors.some((factor) => factor?.factor_type === 'totp' && factor?.status !== 'verified')) {
      responder(res, { error: 'Hay una configuración de autenticación incompleta. Elimina el factor TOTP pendiente en Supabase Auth y vuelve a entrar.' }, 409);
      return;
    }
    const enrolled = await authCall('factors', String(data.access_token), 'POST', { factor_type: 'totp', friendly_name: 'Las Mesas Administración' });
    const factorId = String(enrolled?.id ?? '');
    const qrCode = String(enrolled?.totp?.qr_code ?? '');
    if (!factorId || !qrCode) throw new Error('Supabase no devolvió el código QR de configuración.');
    responder(res, { mfa_setup: true, pending_token: data.access_token, factor_id: factorId, qr_code: qrCode, secret: String(enrolled?.totp?.secret ?? '') });
  } catch (error) {
    g.console?.error?.('[admin-login] error:', error);
    responder(res, { error: (error as Error)?.message ?? 'No se pudo iniciar sesión.' }, 502);
  }
}
