type RolPanel = 'admin' | 'barra' | 'cocina';
type Global = Record<string, any>;
const g = globalThis as unknown as Global;

function env(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

function listaCorreos(nombre: string): string[] {
  return String(env()[nombre] ?? '').split(',').map((correo) => correo.trim().toLowerCase()).filter(Boolean);
}

/** El rol solo se toma de listas privadas del servidor o de app_metadata, nunca de user_metadata. */
export function rolDeUsuario(usuario: any): RolPanel | null {
  const email = String(usuario?.email ?? '').trim().toLowerCase();
  if (!email) return null;

  if (listaCorreos('ADMIN_EMAILS').includes(email)) return 'admin';
  if (listaCorreos('BARRA_EMAILS').includes(email)) return 'barra';
  if (listaCorreos('COCINA_EMAILS').includes(email)) return 'cocina';

  const rolSeguro = String(usuario?.app_metadata?.role ?? usuario?.raw_app_meta_data?.role ?? '').trim().toLowerCase();
  if (rolSeguro === 'admin') return 'admin';
  if (rolSeguro === 'barra' || rolSeguro === 'cocina') return rolSeguro;
  return null;
}

export function puedeEntrar(rol: RolPanel | null, panel: RolPanel): boolean {
  return rol === 'admin' || rol === panel;
}

export function tokenDeCabecera(req: any): string {
  const headers = req?.headers;
  const raw = typeof headers?.get === 'function' ? headers.get('authorization') : headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? '').replace(/^Bearer\s+/i, '').trim();
}

export async function usuarioDelToken(token: string): Promise<any | null> {
  const key = env().SUPABASE_SECRET_KEY ?? env().SUPABASE_SERVICE_ROLE_KEY ?? '';
  const url = String(env().SUPABASE_URL ?? 'https://fohxajfpnriusuybdteu.supabase.co').replace(/\/+$/, '');
  if (!key || !token) return null;
  try {
    const response = await g.fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
