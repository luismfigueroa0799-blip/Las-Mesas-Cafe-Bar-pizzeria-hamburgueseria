type RolPanel = 'admin' | 'barra' | 'cocina';
type Global = Record<string, any>;
const g = globalThis as unknown as Global;

function env(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

function listaCorreos(nombre: string): string[] {
  if (nombre === 'ADMIN_EMAILS') return ['lasmesascafeteriabar@gmail.com'];
  const configurados = String(env()[nombre] ?? '').split(',').map((correo) => correo.trim().toLowerCase()).filter(Boolean);
  return configurados;
}

/** Los roles se asignan solo desde listas privadas del servidor o app_metadata confiable. */
export function rolDeUsuario(usuario: any): RolPanel | null {
  const email = String(usuario?.email ?? '').trim().toLowerCase();
  if (!email) return null;
  if (listaCorreos('ADMIN_EMAILS').includes(email)) return 'admin';
  if (listaCorreos('BARRA_EMAILS').includes(email)) return 'barra';
  if (listaCorreos('COCINA_EMAILS').includes(email)) return 'cocina';
  const role = String(usuario?.app_metadata?.role ?? usuario?.raw_app_meta_data?.role ?? '').trim().toLowerCase();
  if ((role === 'admin' && listaCorreos('ADMIN_EMAILS').includes(email)) || role === 'barra' || role === 'cocina') return role;
  return null;
}

export function puedeEntrar(rol: RolPanel | null, panel: RolPanel): boolean {
  return rol === 'admin' || rol === panel;
}

function header(req: any, name: string): string {
  const headers = req?.headers;
  const raw = typeof headers?.get === 'function' ? headers.get(name) : headers?.[name] ?? headers?.[name.toLowerCase()];
  return String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '');
}

/** Rejects state-changing browser calls unless the Origin matches this host. */
export function origenDelMismoSitio(req: any): boolean {
  const origin = header(req, 'origin');
  const host = header(req, 'x-forwarded-host').split(',')[0].trim() || header(req, 'host');
  if (!origin || !host) return false;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { return false; }
}

function tieneAal2(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded?.aal === 'aal2';
  } catch { return false; }
}

function esSeguro(): boolean { return env().VERCEL === '1' || env().NODE_ENV === 'production'; }
function nombreCookie(tipo: 'access' | 'refresh'): string {
  return `${esSeguro() ? '__Host-' : ''}lm_${tipo}`;
}

function cookies(req: any): Record<string, string> {
  const raw = header(req, 'cookie');
  const result: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const pos = part.indexOf('=');
    if (pos <= 0) continue;
    try { result[part.slice(0, pos).trim()] = decodeURIComponent(part.slice(pos + 1).trim()); } catch { /* ignora cookies mal formadas */ }
  }
  return result;
}

function escribirCookies(res: any, access: string, refresh: string, expiresIn = 3600): void {
  const secure = esSeguro() ? '; Secure' : '';
  const accessAge = Math.max(60, Math.min(Number(expiresIn) || 3600, 3600));
  const refreshAge = 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', [
    `${nombreCookie('access')}=${encodeURIComponent(access)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${accessAge}${secure}`,
    `${nombreCookie('refresh')}=${encodeURIComponent(refresh)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${refreshAge}${secure}`,
  ]);
}

export function borrarCookies(res: any): void {
  const secure = esSeguro() ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `${nombreCookie('access')}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    `${nombreCookie('refresh')}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  ]);
}

async function usuarioDelToken(token: string): Promise<any | null> {
  const key = env().SUPABASE_SECRET_KEY ?? env().SUPABASE_SERVICE_ROLE_KEY ?? '';
  const url = String(env().SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co').replace(/\/+$/, '');
  if (!key || !token) return null;
  try {
    const response = await g.fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

/** Validates the HttpOnly session and rotates it using Supabase refresh tokens. */
export async function usuarioDeSolicitud(req: any, res: any): Promise<any | null> {
  const jar = cookies(req);
  const access = jar[nombreCookie('access')] ?? '';
  const user = await usuarioDelToken(access);
  if (user) return rolDeUsuario(user) === 'admin' && !tieneAal2(access) ? null : user;
  const refresh = jar[nombreCookie('refresh')] ?? '';
  const key = env().SUPABASE_SECRET_KEY ?? env().SUPABASE_SERVICE_ROLE_KEY ?? '';
  const url = String(env().SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co').replace(/\/+$/, '');
  if (!key || !refresh) return null;
  try {
    const response = await g.fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!response.ok) { borrarCookies(res); return null; }
    const session = await response.json();
    if (!session?.access_token || !session?.refresh_token) { borrarCookies(res); return null; }
    escribirCookies(res, String(session.access_token), String(session.refresh_token), Number(session.expires_in));
    const refreshedUser = session.user ?? await usuarioDelToken(String(session.access_token));
    if (rolDeUsuario(refreshedUser) === 'admin' && !tieneAal2(String(session.access_token))) { borrarCookies(res); return null; }
    return refreshedUser;
  } catch { return null; }
}

export function guardarSesion(res: any, session: any): void {
  escribirCookies(res, String(session?.access_token ?? ''), String(session?.refresh_token ?? ''), Number(session?.expires_in));
}

export function tokenAal2(token: string): boolean { return tieneAal2(token); }

export async function cerrarSesion(req: any, res: any): Promise<void> {
  const jar = cookies(req);
  const access = jar[nombreCookie('access')] ?? '';
  const refresh = jar[nombreCookie('refresh')] ?? '';
  const token = access || refresh;
  const key = env().SUPABASE_SECRET_KEY ?? env().SUPABASE_SERVICE_ROLE_KEY ?? '';
  const url = String(env().SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co').replace(/\/+$/, '');
  if (key && token) {
    try { await g.fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${access || token}` } }); } catch { /* la cookie se invalida aunque Supabase no responda */ }
  }
  borrarCookies(res);
}
