'use client';

import { useEffect, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';

/**
 * Acceso de Administración y vinculación temporal de dispositivos de Cocina/Barra.
 * Los paneles de staff solo muestran su contenido después de validar la cookie
 * de dispositivo en el servidor.
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
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoCorreo, setCodigoCorreo] = useState('');
  const [esperaReenvio, setEsperaReenvio] = useState(0);
  const [codigoDispositivo, setCodigoDispositivo] = useState('');

  const sinApi = sitioSinApi();
  const accesoAdmin = destino !== '/admin/cocina' && destino !== '/admin/barra';

  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const temporizador = window.setTimeout(() => setEsperaReenvio((restante) => Math.max(0, restante - 1)), 1000);
    return () => window.clearTimeout(temporizador);
  }, [esperaReenvio]);

  async function reenviarCodigo() {
    if (entrando || esperaReenvio > 0) return;
    setEntrando(true);
    setError('');
    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend_admin_email_code', email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data?.error ?? 'No se pudo reenviar el código.'); return; }
      setCodigoCorreo('');
      setEsperaReenvio(120);
      setError('');
    } catch {
      setError('No se pudo reenviar el código. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setEntrando(false);
    }
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (entrando) return;
    setEntrando(true);
    setError('');
    setDetalle('');

    try {
      const panel = destino === '/admin/cocina' ? 'cocina' : destino === '/admin/barra' ? 'barra' : 'admin';
      const action = accesoAdmin
        ? codigoEnviado ? 'verify_admin_email_code' : 'begin_admin_email_code'
        : 'vincular_dispositivo';
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accesoAdmin
          ? { action, email, ...(codigoEnviado ? { code: codigoCorreo } : { password }) }
          : { action, panel, device_code: codigoDispositivo }),
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

      if (datos?.code_sent) {
        setCodigoEnviado(true);
        setEsperaReenvio(120);
        setPassword('');
        setError('');
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
        <span className="admin-eyebrow">{accesoAdmin ? 'Panel interno' : 'Dispositivo autorizado'}</span>
        <h1>{accesoAdmin ? 'Iniciar sesión' : 'Autorizar dispositivo'}</h1>
        <p className="admin-sub">{accesoAdmin
          ? 'Escribe tu correo y contraseña. Después te enviaremos un código para confirmar el acceso.'
          : `Este panel solo se abre en dispositivos autorizados. Pide a Administración el código temporal de ${destino === '/admin/barra' ? 'Barra' : 'Cocina'} para vincular este dispositivo.`}</p>

        {aviso && <p className="admin-error" role="status">{aviso}</p>}

        {accesoAdmin && <label className="admin-field">
          <span><Mail size={15} aria-hidden="true" /> Correo electrónico</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={accesoAdmin && codigoEnviado}
            placeholder="tu@correo.com"
            autoComplete="username"
            autoFocus={!codigoEnviado}
            required
            data-testid="input-admin-email"
          />
        </label>}
        {accesoAdmin && !codigoEnviado && <label className="admin-field">
          <span><LockKeyhole size={15} aria-hidden="true" /> Contraseña</span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
            data-testid="input-admin-password"
          />
        </label>}
        {accesoAdmin && codigoEnviado && (
          <>
            <p className="admin-ok" role="status">Te hemos enviado un código a tu correo. Revisa también la carpeta de spam.</p>
            <label className="admin-field">
              <span>Código de verificación</span>
              <input
                type="text"
                name="one-time-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                value={codigoCorreo}
                onChange={(e) => setCodigoCorreo(e.target.value.replace(/\D/g, '').slice(0, 8))}
                autoFocus
                required
                data-testid="input-admin-email-code"
              />
            </label>
            <button type="button" className="admin-nota" onClick={reenviarCodigo} disabled={entrando || esperaReenvio > 0}>
              {esperaReenvio > 0
                ? `Podrás reenviar el código en ${Math.floor(esperaReenvio / 60)}:${String(esperaReenvio % 60).padStart(2, '0')}`
                : 'Reenviar código'}
            </button>
            <button type="button" className="admin-nota" onClick={() => { setCodigoEnviado(false); setCodigoCorreo(''); setEsperaReenvio(0); setError(''); }}>
              Cambiar correo o volver al inicio
            </button>
          </>
        )}
        {!accesoAdmin && <>
          <label className="admin-field">
            <span>Código de vinculación</span>
            <input
              type="text"
              name="device-code"
              value={codigoDispositivo}
              onChange={(e) => setCodigoDispositivo(e.target.value.replace(/[^a-f\d]/gi, '').toUpperCase().slice(0, 10))}
              placeholder="10 caracteres"
              autoComplete="one-time-code"
              maxLength={10}
              required
              autoFocus
            />
          </label>
        </>}

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
          {entrando ? 'Comprobando…' : accesoAdmin ? codigoEnviado ? 'Verificar código' : 'Validar y enviar código' : 'Autorizar dispositivo'}
        </button>

        <p className="admin-nota">
          <a href="/">← Volver a la web</a>
        </p>
      </form>
    </div>
  );
};

export default Login;
