import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import Login, { borrarToken, guardarToken, leerToken } from '@/admin/Login';

type Panel = 'admin' | 'barra' | 'cocina';

const TITULOS: Record<Panel, string> = {
  admin: 'Administración',
  barra: 'Barra',
  cocina: 'Cocina',
};

export default function PanelAcceso({ panel, children }: { panel: Panel; children: ReactNode }) {
  const [estado, setEstado] = useState<'cargando' | 'sin-sesion' | 'permitido' | 'denegado' | 'dispositivo'>('cargando');
  const [aviso, setAviso] = useState('');
  const destino = typeof window === 'undefined' ? '/admin/inventario' : window.location.pathname;

  useEffect(() => {
    let vigente = true;
    fetch(`/api/admin-login?panel=${encodeURIComponent(panel)}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!vigente) return;
        if (response.status === 403 && data.device_required && data.role === panel) {
          setAviso(data.error ?? 'Este dispositivo necesita autorización de Administración.');
          setEstado('dispositivo');
          return;
        }
        if (!response.ok || !data.role) {
          const sesionAnterior = leerToken() === 'cookie-session';
          borrarToken();
          setAviso(sesionAnterior ? 'La sesión ha caducado. Inicia sesión para continuar.' : '');
          setEstado('sin-sesion');
          return;
        }
        guardarToken('cookie-session');
        const permitido = data.role === 'admin' || data.role === panel;
        if (!permitido) {
          borrarToken();
          setAviso(`Esta cuenta no puede entrar en ${TITULOS[panel]}. Inicia sesión con la cuenta autorizada para ese panel.`);
          setEstado('denegado');
          return;
        }
        setEstado('permitido');
      })
      .catch(() => {
        if (!vigente) return;
        setAviso('No se pudo comprobar la sesión. Comprueba la conexión e inténtalo de nuevo.');
        setEstado('sin-sesion');
      });

    return () => { vigente = false; };
  }, [panel]);

  if (estado === 'permitido') return <>{children}</>;
  if (panel !== 'admin' && estado !== 'cargando') {
    return (
      <div className="admin-login" role="status" aria-live="polite">
        <div className="admin-card admin-card-corta">
          <ShieldAlert size={24} aria-hidden="true" />
          <span className="admin-eyebrow">Acceso restringido</span>
          <h1>Dispositivo no autorizado</h1>
          <p>Este dispositivo no está vinculado a {TITULOS[panel]}. No se pueden mostrar los pedidos desde este enlace.</p>
        </div>
      </div>
    );
  }
  if (estado === 'sin-sesion' || estado === 'denegado' || estado === 'dispositivo') return <Login destino={destino} aviso={aviso} />;

  return (
    <div className="admin-login" role="status" aria-live="polite">
      <div className="admin-card admin-card-corta">
        <LoaderCircle className="animate-spin" size={24} aria-hidden="true" />
        <p>Comprobando acceso al panel…</p>
        <ShieldAlert size={16} aria-hidden="true" />
      </div>
    </div>
  );
}
