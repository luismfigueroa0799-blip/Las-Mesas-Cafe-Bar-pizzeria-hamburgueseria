import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, RefreshCw, Users } from 'lucide-react';
import { Link } from 'wouter';

type EstadoReserva = 'pendiente' | 'confirmada' | 'rechazada';
interface Reserva {
  id: number;
  codigo: string;
  nombre: string;
  contacto: string;
  fecha: string;
  hora: string;
  numero_personas: number;
  comentarios: string | null;
  estado: EstadoReserva;
  fecha_creacion: string | null;
  actualizada_en: string | null;
}

const ESTADOS: { value: EstadoReserva; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'rechazada', label: 'No disponible' },
];

function fechaLegible(valor: string | null) {
  if (!valor) return 'Fecha no disponible';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Atlantic/Canary',
  }).format(fecha);
}

export default function ReservasAdmin() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todas' | EstadoReserva>('todas');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const response = await fetch('/api/admin-productos?vista=reservas', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'No se pudieron cargar las reservas.');
      setReservas(Array.isArray(data.reservas) ? data.reservas : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las reservas.');
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
    ? reservas
    : reservas.filter((item) => item.estado === filtro), [filtro, reservas]);

  async function cambiarEstado(reserva: Reserva, estado: EstadoReserva) {
    if (estado === reserva.estado) return;
    setGuardando(reserva.id);
    setError('');
    try {
      const response = await fetch('/api/admin-productos', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'actualizar_reserva', id: reserva.id, estado }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'No se pudo guardar el estado.');
      setReservas((actuales) => actuales.map((item) => item.id === reserva.id
        ? { ...item, estado: data.solicitud?.estado ?? estado, actualizada_en: data.solicitud?.actualizada_en ?? new Date().toISOString() }
        : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el estado.');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <main className="admin admin-celebraciones admin-reservas">
      <header className="admin-head">
        <div className="admin-logo">
          <span className="admin-eyebrow">Solicitudes de mesa</span>
          <h1>Reservas</h1>
          <p className="admin-sub">Confirma cada mesa después de revisar la disponibilidad.</p>
        </div>
        <div className="admin-acciones">
          <Link className="admin-boton admin-boton-claro" href="/admin/inventario"><ArrowLeft size={16} /> Administración</Link>
          <button type="button" className="admin-boton admin-boton-claro" onClick={() => void cargar()} disabled={cargando}>
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </header>

      <div className="admin-filtros" aria-label="Filtrar reservas">
        <button type="button" className={filtro === 'todas' ? 'admin-ficha admin-ficha-activa' : 'admin-ficha'} onClick={() => setFiltro('todas')}>Todas ({reservas.length})</button>
        {ESTADOS.map((estado) => <button key={estado.value} type="button" className={filtro === estado.value ? 'admin-ficha admin-ficha-activa' : 'admin-ficha'} onClick={() => setFiltro(estado.value)}>{estado.label} ({reservas.filter((item) => item.estado === estado.value).length})</button>)}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {cargando && reservas.length === 0 ? <p className="admin-celebraciones-vacio">Cargando reservas…</p>
        : visibles.length === 0 ? <p className="admin-celebraciones-vacio">No hay reservas en este estado.</p>
          : <div className="admin-celebraciones-lista">{visibles.map((reserva) => (
            <article className="admin-celebracion" key={reserva.id}>
              <header className="admin-celebracion-cabecera">
                <div><span className="admin-eyebrow">{reserva.codigo || `Solicitud #${reserva.id}`}</span><h2>{reserva.nombre}</h2></div>
                <label className="admin-celebracion-estado"><span>Estado</span><select value={reserva.estado || 'pendiente'} disabled={guardando === reserva.id} onChange={(event) => void cambiarEstado(reserva, event.target.value as EstadoReserva)}>{ESTADOS.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}</select></label>
              </header>
              <div className="admin-celebracion-meta"><span><CalendarDays size={15} /> {reserva.fecha}</span><span><Clock3 size={15} /> {String(reserva.hora).slice(0, 5)}</span><span><Users size={15} /> {reserva.numero_personas} personas</span><a href={reserva.contacto.includes('@') ? `mailto:${reserva.contacto}` : `tel:${reserva.contacto.replace(/[^+\d]/g, '')}`}>{reserva.contacto}</a><small>Recibida: {fechaLegible(reserva.fecha_creacion)}</small></div>
              {reserva.comentarios && <p className="admin-celebracion-detalles">{reserva.comentarios}</p>}
            </article>
          ))}</div>}
      <p className="admin-celebraciones-pie">Las solicitudes se actualizan cada 30 segundos. Solo cambia a «Confirmada» después de comprobar que hay mesa disponible y avisar al cliente.</p>
    </main>
  );
}
