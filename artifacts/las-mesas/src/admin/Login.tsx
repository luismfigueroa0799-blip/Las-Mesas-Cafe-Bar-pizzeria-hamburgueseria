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
    // La sesión del staff debe sobrevivir a cambios de ruta, pestaña y al
    // cierre/reapertura del navegador. Solo se elimina al pulsar "Salir".
    localStorage.setItem('lm_admin_token', token);
    sessionStorage.removeItem('lm_admin_token');
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
}

export function leerToken(): string {
  try {
    const token = localStorage.getItem('lm_admin_token') ?? sessionStorage.getItem('lm_admin_token') ?? '';
    if (token && !localStorage.getItem('lm_admin_token')) {
      localStorage.setItem('lm_admin_token', token);
      sessionStorage.removeItem('lm_admin_token');
    }
    return token;
  } catch {
    return '';
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem('lm_admin_token');
    sessionStorage.removeItem('lm_admin_token');
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
}

const Login: React.FC<{ destino?: string; aviso?: string }> = ({ destino = '/admin/inventario', aviso = '' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState('');
  const [entrando, setEntrando] = useState(false);

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
        body: JSON.stringify({ email, password, panel }),
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

      guardarToken(String(datos.token ?? ''));
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
          <LogIn size={16} /> {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="admin-nota">
          <a href="/">← Volver a la web</a>
        </p>
      </form>
    </div>
  );
};

export default Login;
