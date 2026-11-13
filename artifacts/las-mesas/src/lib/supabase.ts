import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para el navegador.
 *
 * Se usa para el login del panel de inventario (/admin/inventario) con
 * supabase.auth.signInWithPassword.
 *
 * La clave publica ("publishable key" o "anon key") se puede poner en el
 * entorno como NEXT_PUBLIC_SUPABASE_ANON_KEY. Si no esta puesta, el panel
 * sigue funcionando: el login se hace contra nuestra propia API
 * (/api/admin-login), que hace el mismo trabajo en el servidor.
 */
const url = (import.meta.env?.VITE_SUPABASE_URL ?? import.meta.env?.NEXT_PUBLIC_SUPABASE_URL ?? '') as string;
const clave = (import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '') as string;

/** true si hay clave publica para poder usar Supabase en el navegador. */
export const hayClavePublica = Boolean(url && clave);

let cliente: SupabaseClient | null = null;

/** Cliente de Supabase en el navegador, o null si falta la clave publica. */
export function supabaseNavegador(): SupabaseClient | null {
  if (!hayClavePublica) return null;
  if (!cliente) {
    cliente = createClient(url, clave, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return cliente;
}

/** URL del proyecto de Supabase (la que devuelve nuestra API si hace falta). */
export function urlSupabasePublica(): string {
  return url;
}
