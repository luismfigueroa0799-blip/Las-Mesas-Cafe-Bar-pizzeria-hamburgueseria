'use client';

import { useState } from 'react';
import { LogIn, UtensilsCrossed } from 'lucide-react';

/**
 * Pantalla de acceso rapido al panel de inventario (/admin/inventario).
 *
 * Correo y contraseña se validan en el servidor; la API decide si esa cuenta
 * puede abrir Administración, Barra o Cocina.
 */

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
    // Solo guardamos un marcador de interfaz; la credencial real vive en una
    // cookie HttpOnly que JavaScript no puede leer.
    if (token) localStorage.setItem('lm_admin_session', '1');
    sessionStorage.removeItem('lm_admin_token');
    localStorage.removeItem('lm_admin_token');
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
}

export function leerToken(): string {
  try {
    localStorage.removeItem('lm_admin_token');
    sessionStorage.removeItem('lm_admin_token');
    return localStorage.getItem('lm_admin_session') === '1' ? 'cookie-session' : '';
  } catch {
    return '';
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem('lm_admin_token');
    sessionStorage.removeItem('lm_admin_token');
    localStorage.removeItem('lm_admin_session');
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
  void fetch('/api/admin-login', { method: 'DELETE', keepalive: true }).catch(() => undefined);
}

const Login: React.FC<{ destino?: string; aviso?: string }> = ({ destino = '/admin/inventario', aviso = '' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [mfa, setMfa] = useState<{ pending_token: string; factor_id: string; challenge_id?: string; qr_code?: string; secret?: string; setup: boolean } | null>(null);
  const [codigoMfa, setCodigoMfa] = useState('');

  const sinApi = sitioSinApi();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (entrando) return;
    setEntrando(true);
    setError('');
    setDetalle('');

    try {
      const panel = destino === '/admin/cocina' ? 'cocina' : destino === '/admin/barra' ? 'barra' : 'admin';
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mfa
          ? { action: 'verify_mfa', pending_token: mfa.pending_token, factor_id: mfa.factor_id, challenge_id: mfa.challenge_id, code: codigoMfa }
          : { email, password, panel }),
      });

      const texto = await r.text();
      let datos: any = null;
      try {
        datos = JSON.parse(texto);
      } catch {
        datos = null;
      }

      if (!datos) {
        setError('La respuesta del servidor no es válida');
        setDetalle(
          `HTTP ${r.status}. Si estas en lasmesasbarcafet.com (el sitio estatico, ` +
            `sin API), abre el panel en https://${URLS_CON_API[0]}/admin/inventario`,
        );
        return;
      }
      if (!r.ok) {
        setError(datos?.error ?? 'No se pudo iniciar sesión');
        return;
      }

      if (datos?.mfa_required || datos?.mfa_setup) {
        setMfa({
          pending_token: String(datos.pending_token),
          factor_id: String(datos.factor_id),
          challenge_id: datos.challenge_id ? String(datos.challenge_id) : undefined,
          qr_code: datos.qr_code ? String(datos.qr_code) : undefined,
          secret: datos.secret ? String(datos.secret) : undefined,
          setup: Boolean(datos.mfa_setup),
        });
        setPassword('');
        return;
      }

      guardarToken('cookie-session');
      window.location.assign(destino);
    } catch (error) {
      setError('No se pudo iniciar sesión');
      setDetalle(
        error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      );
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="admin-login">
      {sinApi && (
        <p className="admin-error admin-error-fuerte">
          Has abierto el panel en un sitio que no tiene la API (el dominio propio
          apunta al proyecto estatico).{' '}
          <a
            href={'https://' + URLS_CON_API[0] + '/admin/inventario'}
            target="_blank"
            rel="noreferrer"
          >
            Abrelo aqui
          </a>
          .
        </p>
      )}

      <form className="admin-card admin-card-corta" onSubmit={entrar}>
        <span className="admin-eyebrow">
          <UtensilsCrossed size={16} /> Las Mesas
        </span>
        <h1>Acceso staff</h1>
        <p className="admin-sub">Acceso seguro para Administración, Barra y Cocina.</p>

        {mfa ? (
          <div className="admin-mfa" aria-live="polite">
            {mfa.setup ? (
              <>
                <h2>Protege Administración</h2>
                <p>Escanea este código QR con Google Authenticator, Microsoft Authenticator o una app compatible.</p>
                {mfa.qr_code && <img className="admin-mfa-qr" src={mfa.qr_code} alt="Código QR para configurar la autenticación" />}
                <p className="admin-mfa-secret">Si no puedes escanearlo, introduce esta clave en la app: <strong>{mfa.secret}</strong></p>
              </>
            ) : (
              <>
                <h2>Confirma tu identidad</h2>
                <p>Escribe el código de 6 dígitos que aparece en tu app autenticadora.</p>
              </>
            )}
            <label className="admin-field">
              <span>Código de autenticación</span>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" maxLength={8} value={codigoMfa} onChange={(e) => setCodigoMfa(e.target.value.replace(/[^0-9 ]/g, ''))} required />
            </label>
            <button type="button" className="admin-nota" onClick={() => { setMfa(null); setCodigoMfa(''); setError(''); }}>Volver al inicio de sesión</button>
          </div>
        ) : (
          <>

        {aviso && <p className="admin-error" role="status">{aviso}</p>}

        <label className="admin-field">
          <span>Correo</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@lasmesas.com"
            autoComplete="username"
            autoFocus
            required
            data-testid="input-admin-email"
          />
        </label>
        <label className="admin-field">
          <span>Contraseña</span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            data-testid="input-admin-password"
          />
        </label>
          </>
        )}

        {error && (
          <p className="admin-error" data-testid="admin-login-error">
            <strong>{error}</strong>
            {detalle && <span className="admin-error-detalle"> · {detalle}</span>}
          </p>
        )}

        <button
          type="submit"
          className="admin-boton"
          disabled={entrando}
          data-testid="button-admin-login"
        >
          <LogIn size={16} /> {entrando ? 'Comprobando…' : mfa ? 'Verificar código' : 'Entrar'}
        </button>

        <p className="admin-nota">
          <a href="/">← Volver a la web</a>
        </p>
      </form>
    </div>
  );
};

export default Login;
