import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import Login, { borrarToken, leerToken } from '@/admin/Login';

type Panel = 'admin' | 'barra' | 'cocina';

const TITULOS: Record<Panel, string> = {
  admin: 'Administración',
  barra: 'Barra',
  cocina: 'Cocina',
};

export default function PanelAcceso({ panel, children }: { panel: Panel; children: ReactNode }) {
  const [estado, setEstado] = useState<'cargando' | 'sin-sesion' | 'permitido' | 'denegado'>('cargando');
  const [aviso, setAviso] = useState('');
  const destino = typeof window === 'undefined' ? '/admin/inventario' : window.location.pathname;

  useEffect(() => {
    let vigente = true;
    const token = leerToken();
    if (!token) {
      setEstado('sin-sesion');
      return () => { vigente = false; };
    }

    fetch('/api/admin-login', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!vigente) return;
        if (!response.ok || !data.role) {
          borrarToken();
          setAviso('La sesión ha caducado. Inicia sesión para continuar.');
          setEstado('sin-sesion');
          return;
        }
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
  if (estado === 'sin-sesion' || estado === 'denegado') return <Login destino={destino} aviso={aviso} />;

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
