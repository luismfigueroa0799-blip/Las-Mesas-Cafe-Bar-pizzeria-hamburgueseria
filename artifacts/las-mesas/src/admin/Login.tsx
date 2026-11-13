import { useState } from 'react';
import { LogIn, UtensilsCrossed } from 'lucide-react';

/**
 * Pagina de acceso al panel de inventario (/login).
 *
 * El login se hace contra Supabase Auth, pero la clave NO sale del
 * navegador: se envia usuario y contrasena a /api/admin-login, que hace el
 * login en el servidor y devuelve el token del usuario.
 *
 * Solo pueden entrar los usuarios con el rol 'staff'.
 */

const CLAVE_TOKEN = 'lm_admin_token';

/**
 * URLs donde vive esta web con la API (el proyecto de Vercel).
 *
 * El dominio propio apunta al proyecto estatico, que no tiene ni la API ni
 * esta pagina: si se abre el panel ahi, el login no puede funcionar y hay
 * que decirlo en vez de fallar en silencio.
 */
export const URLS_CON_API = [
  'las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app',
  'las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app',
];

/** True si la pagina se ha abierto en un sitio que no tiene la API. */
export function sitioSinApi(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.host.toLowerCase();
  if (host.includes('localhost') || host.includes('127.0.0.1')) return false;
  return !URLS_CON_API.some((u) => host.includes(u));
}

export function guardarToken(token: string) {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    /* sin sessionStorage */
  }
}

export function leerToken(): string {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN) ?? '';
  } catch {
    return '';
  }
}

export function borrarToken() {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* sin sessionStorage */
  }
}

const Login: React.FC<{ destino?: string }> = ({ destino = '/admin/inventario' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setError('');
    try {
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Si la respuesta no es JSON es que no estamos en el sitio con la API
      // (por ejemplo, el dominio propio, que apunta al proyecto estatico).
      const texto = await r.text();
      let datos: any = null;
      try {
        datos = JSON.parse(texto);
      } catch {
        datos = null;
      }

      if (!datos) {
        setError(
          'La respuesta del servidor no es valida. Es probable que estes en ' +
            'lasmesasbarcafet.com (el sitio estatico, sin la API). Abre el panel en: ' +
            'https://' + URLS_CON_API[0] + '/admin/inventario',
        );
        return;
      }
      if (!r.ok) {
        setError(datos?.error ?? 'No se pudo iniciar sesión');
        return;
      }
      guardarToken(String(datos.token ?? ''));
      // Al entrar, se va al panel.
      window.location.assign(destino);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-card" onSubmit={entrar}>
        <span className="admin-eyebrow">
          <UtensilsCrossed size={16} /> Las Mesas
        </span>
        <h1>Acceso staff</h1>
        <p className="admin-sub">
          Entra con tu usuario de staff para gestionar el inventario de la carta.
        </p>

        <label className="admin-field">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@lasmesas.com"
            autoComplete="username"
            required
            data-testid="input-admin-email"
          />
        </label>

        <label className="admin-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            data-testid="input-admin-password"
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="admin-boton" disabled={entrando} data-testid="button-admin-login">
          <LogIn size={16} /> {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="admin-nota">
          <a href="/">← Volver a la web</a>
          {' · '}
          <a href={'https://' + URLS_CON_API[0] + '/admin/inventario'}>Ir al inventario</a>
        </p>
      </form>
    </div>
  );
};

export default Login;
