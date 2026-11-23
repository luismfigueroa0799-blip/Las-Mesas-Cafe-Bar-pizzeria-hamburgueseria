import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, RefreshCw, Users } from 'lucide-react';
import { Link } from 'wouter';

type EstadoCelebracion = 'nueva' | 'contactada' | 'propuesta_enviada' | 'confirmada' | 'no_concretada';
interface Solicitud {
  id: number;
  codigo: string;
  nombre: string;
  contacto: string;
  tipo_evento: string;
  fecha_aproximada: string;
  numero_personas: number;
  detalles: string;
  estado: EstadoCelebracion;
  fecha_creacion: string | null;
  actualizada_en: string | null;
}

const ESTADOS: { value: EstadoCelebracion; label: string }[] = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'contactada', label: 'Contactada' },
  { value: 'propuesta_enviada', label: 'Propuesta enviada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'no_concretada', label: 'No concretada' },
];

function fechaLegible(valor: string | null) {
  if (!valor) return 'Fecha no disponible';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Atlantic/Canary',
  }).format(fecha);
}

export default function CelebracionesAdmin() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todas' | EstadoCelebracion>('todas');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const response = await fetch('/api/admin-productos?vista=celebraciones', {
        credentials: 'same-origin', cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'No se pudieron cargar las solicitudes.');
      setSolicitudes(Array.isArray(data.solicitudes) ? data.solicitudes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    const timer = window.setInterval(() => void cargar(), 30_000);
    return () => window.clearInterval(timer);
  }, [cargar]);

  const visibles = useMemo(() => filtro === 'todas'
    ? solicitudes
    : solicitudes.filter((item) => item.estado === filtro), [filtro, solicitudes]);

  async function cambiarEstado(solicitud: Solicitud, estado: EstadoCelebracion) {
    if (estado === solicitud.estado) return;
    setGuardando(solicitud.id);
    setError('');
    try {
      const response = await fetch('/api/admin-productos', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'actualizar_celebracion', id: solicitud.id, estado }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'No se pudo guardar el estado.');
      setSolicitudes((actuales) => actuales.map((item) => item.id === solicitud.id
        ? { ...item, estado: data.solicitud?.estado ?? estado, actualizada_en: data.solicitud?.actualizada_en ?? new Date().toISOString() }
        : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el estado.');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <main className="admin admin-celebraciones">
      <header className="admin-head">
        <div className="admin-logo">
          <span className="admin-eyebrow">Seguimiento de solicitudes</span>
          <h1>Celebraciones</h1>
          <p className="admin-sub">Cada solicitud queda registrada aquí para que el equipo pueda darle seguimiento.</p>
        </div>
        <div className="admin-acciones">
          <Link className="admin-boton admin-boton-claro" href="/admin/inventario"><ArrowLeft size={16} /> Administración</Link>
          <button type="button" className="admin-boton admin-boton-claro" onClick={() => void cargar()} disabled={cargando}>
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </header>

      <div className="admin-filtros" aria-label="Filtrar solicitudes">
        <button type="button" className={filtro === 'todas' ? 'admin-ficha admin-ficha-activa' : 'admin-ficha'} onClick={() => setFiltro('todas')}>Todas ({solicitudes.length})</button>
        {ESTADOS.map((estado) => <button key={estado.value} type="button" className={filtro === estado.value ? 'admin-ficha admin-ficha-activa' : 'admin-ficha'} onClick={() => setFiltro(estado.value)}>{estado.label} ({solicitudes.filter((item) => item.estado === estado.value).length})</button>)}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {cargando && solicitudes.length === 0 ? <p className="admin-celebraciones-vacio">Cargando solicitudes…</p>
        : visibles.length === 0 ? <p className="admin-celebraciones-vacio">No hay solicitudes en este estado.</p>
          : <div className="admin-celebraciones-lista">{visibles.map((item) => (
            <article className="admin-celebracion" key={item.id}>
              <header className="admin-celebracion-cabecera">
                <div><span className="admin-eyebrow">{item.codigo || `Solicitud #${item.id}`}</span><h2>{item.nombre}</h2><p>{item.tipo_evento || 'Celebración'}</p></div>
                <label className="admin-celebracion-estado"><span>Estado</span><select value={item.estado || 'nueva'} disabled={guardando === item.id} onChange={(event) => void cambiarEstado(item, event.target.value as EstadoCelebracion)}>{ESTADOS.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}</select></label>
              </header>
              <div className="admin-celebracion-meta"><span><CalendarDays size={15} /> Fecha solicitada: {item.fecha_aproximada || 'A concretar'}</span><span><Users size={15} /> {item.numero_personas} personas</span><a href={item.contacto.includes('@') ? `mailto:${item.contacto}` : `tel:${item.contacto.replace(/[^+\d]/g, '')}`}>{item.contacto}</a><small>Recibida: {fechaLegible(item.fecha_creacion)}</small></div>
              {item.detalles && <p className="admin-celebracion-detalles">{item.detalles}</p>}
            </article>
          ))}</div>}
      <p className="admin-celebraciones-pie">La lista se actualiza automáticamente cada 30 segundos. La confirmación de una celebración siempre debe acordarse con el cliente.</p>
    </main>
  );
}
