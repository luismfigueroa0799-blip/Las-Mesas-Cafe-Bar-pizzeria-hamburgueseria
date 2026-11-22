import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Save, Trash2 } from 'lucide-react';
import { CLAVES_DIAS, HORARIO_PREDETERMINADO, normalizarHorario, textoTramos, type ConfiguracionHorario, type HorarioFestivo, type TramoHorario } from '@/horarios';

const tramoNuevo = (): TramoHorario => ({ inicio: '18:00', fin: '23:00' });
const clonar = (horario: ConfiguracionHorario) => JSON.parse(JSON.stringify(horario)) as ConfiguracionHorario;

export default function HorarioAdmin({ token }: { token: string }) {
  const [horario, setHorario] = useState(() => clonar(HORARIO_PREDETERMINADO));
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [fechaNueva, setFechaNueva] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [nuevoCerrado, setNuevoCerrado] = useState(true);

  useEffect(() => {
    let vigente = true;
    fetch('/api/admin-opciones?vista=horario', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (r) => { const datos = await r.json().catch(() => ({})); if (!r.ok) throw new Error(datos?.error || 'No se pudo cargar el horario.'); if (vigente) setHorario(normalizarHorario(datos.horario)); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el horario.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token]);

  function actualizarDia(indice: number, tramos: TramoHorario[]) {
    setHorario((actual) => ({ ...actual, semanal: actual.semanal.map((dia, i) => i === indice ? tramos : dia) })); setAviso('');
  }
  function actualizarFestivo(indice: number, cambios: Partial<HorarioFestivo>) {
    setHorario((actual) => ({ ...actual, festivos: actual.festivos.map((item, i) => i === indice ? { ...item, ...cambios } : item) })); setAviso('');
  }
  function agregarFestivo() {
    if (!fechaNueva || !nombreNuevo.trim()) { setError('Indica la fecha y el nombre del festivo.'); return; }
    if (horario.festivos.some((item) => item.fecha === fechaNueva)) { setError('Ya existe una excepción para esa fecha.'); return; }
    setHorario((actual) => ({ ...actual, festivos: [...actual.festivos, { fecha: fechaNueva, nombre: nombreNuevo.trim(), cerrado: nuevoCerrado, tramos: nuevoCerrado ? [] : [tramoNuevo()] }].sort((a, b) => a.fecha.localeCompare(b.fecha)) }));
    setFechaNueva(''); setNombreNuevo(''); setNuevoCerrado(true); setError(''); setAviso('');
  }
  async function guardar() {
    setGuardando(true); setError(''); setAviso('');
    try {
      const r = await fetch('/api/admin-opciones', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ accion: 'guardar_horario', horario }) });
      const datos = await r.json().catch(() => ({})); if (!r.ok) throw new Error(datos?.error || 'No se pudo guardar el horario.');
      setHorario(normalizarHorario(datos.horario)); setAviso('Horario guardado. La web ya muestra los nuevos horarios.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el horario.'); }
    finally { setGuardando(false); }
  }

  return <section className="admin-horario" aria-labelledby="admin-horario-titulo">
    <header className="admin-horario-cabecera"><div><span className="admin-eyebrow"><CalendarClock size={15} /> Horario del local</span><h2 id="admin-horario-titulo">Apertura y días festivos</h2><p>Edita el horario semanal y crea excepciones para festivos y cierres puntuales.</p></div><button type="button" className="admin-boton admin-horario-guardar" onClick={() => void guardar()} disabled={cargando || guardando}><Save size={16} />{guardando ? 'Guardando…' : 'Guardar horario'}</button></header>
    {error && <p className="admin-error" role="alert">{error}</p>}{aviso && <p className="admin-ok" role="status">{aviso}</p>}
    {cargando ? <p className="admin-horario-cargando">Cargando horario…</p> : <>
      <section className="admin-horario-semanal"><h3>Horario habitual</h3><p>Se mostrará con la hora local de Canarias.</p>
        {CLAVES_DIAS.map((clave, diaIndex) => { const tramos = horario.semanal[diaIndex] ?? []; const dia = clave.replace('contacto.dia.', '').replace(/^./, (letra) => letra.toUpperCase()); return <div className="admin-horario-dia" key={clave}>
          <strong>{dia}</strong><label className="admin-horario-cerrado"><input type="checkbox" checked={!tramos.length} onChange={(e) => actualizarDia(diaIndex, e.target.checked ? [] : [tramoNuevo()])} /> Cerrado</label>
          <div className="admin-horario-tramos">{tramos.map((tramo, i) => <div className="admin-horario-tramo" key={i}><label>Desde<input type="time" value={tramo.inicio} onChange={(e) => actualizarDia(diaIndex, tramos.map((v, n) => n === i ? { ...v, inicio: e.target.value } : v))} /></label><label>Hasta<input type="time" value={tramo.fin} onChange={(e) => actualizarDia(diaIndex, tramos.map((v, n) => n === i ? { ...v, fin: e.target.value } : v))} /></label>{tramos.length > 1 && <button type="button" className="admin-horario-icono" aria-label={`Eliminar tramo de ${dia}`} onClick={() => actualizarDia(diaIndex, tramos.filter((_, n) => n !== i))}><Trash2 size={15} /></button>}</div>)}{tramos.length > 0 && tramos.length < 4 && <button type="button" className="admin-horario-anadir-tramo" onClick={() => actualizarDia(diaIndex, [...tramos, tramoNuevo()])}><Plus size={14} /> Añadir otro tramo</button>}</div>
          <span className="admin-horario-resumen">{textoTramos(tramos)}</span>
        </div>; })}
      </section>
      <section className="admin-horario-festivos"><h3>Festivos y excepciones</h3><p>La fecha especial reemplaza el horario semanal solo ese día.</p>
        <div className="admin-horario-nuevo-festivo"><label>Fecha<input type="date" value={fechaNueva} onChange={(e) => setFechaNueva(e.target.value)} /></label><label>Nombre o motivo<input type="text" maxLength={80} value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Navidad, fiesta local…" /></label><label className="admin-horario-cerrado"><input type="checkbox" checked={nuevoCerrado} onChange={(e) => setNuevoCerrado(e.target.checked)} /> Cerrado todo el día</label><button type="button" className="admin-boton" onClick={agregarFestivo}><Plus size={16} /> Añadir fecha</button></div>
        {!horario.festivos.length ? <div className="admin-horario-vacio">Todavía no hay festivos ni cierres especiales.</div> : <div className="admin-horario-festivos-lista">{horario.festivos.map((festivo, indice) => <article className="admin-horario-festivo" key={festivo.fecha}>
          <div className="admin-horario-festivo-head"><label>Fecha<input type="date" value={festivo.fecha} onChange={(e) => { const fecha = e.target.value; if (fecha && horario.festivos.some((otro, i) => i !== indice && otro.fecha === fecha)) { setError('Ya existe una excepción para esa fecha.'); return; } actualizarFestivo(indice, { fecha }); }} /></label><label>Motivo<input type="text" maxLength={80} value={festivo.nombre} onChange={(e) => actualizarFestivo(indice, { nombre: e.target.value })} /></label><button type="button" className="admin-horario-icono admin-horario-borrar" aria-label={`Eliminar ${festivo.nombre}`} onClick={() => setHorario((actual) => ({ ...actual, festivos: actual.festivos.filter((_, i) => i !== indice) }))}><Trash2 size={17} /></button></div>
          <label className="admin-horario-cerrado"><input type="checkbox" checked={festivo.cerrado} onChange={(e) => actualizarFestivo(indice, { cerrado: e.target.checked, tramos: e.target.checked ? [] : festivo.tramos.length ? festivo.tramos : [tramoNuevo()] })} /> Cerrado todo el día</label>
          {!festivo.cerrado && <div className="admin-horario-tramos admin-horario-tramos-festivo">{festivo.tramos.map((tramo, i) => <div className="admin-horario-tramo" key={i}><label>Desde<input type="time" value={tramo.inicio} onChange={(e) => actualizarFestivo(indice, { tramos: festivo.tramos.map((v, n) => n === i ? { ...v, inicio: e.target.value } : v) })} /></label><label>Hasta<input type="time" value={tramo.fin} onChange={(e) => actualizarFestivo(indice, { tramos: festivo.tramos.map((v, n) => n === i ? { ...v, fin: e.target.value } : v) })} /></label><button type="button" className="admin-horario-icono" aria-label="Eliminar tramo festivo" onClick={() => actualizarFestivo(indice, { tramos: festivo.tramos.filter((_, n) => n !== i) })}><Trash2 size={15} /></button></div>)}{festivo.tramos.length < 4 && <button type="button" className="admin-horario-anadir-tramo" onClick={() => actualizarFestivo(indice, { tramos: [...festivo.tramos, tramoNuevo()] })}><Plus size={14} /> Añadir otro tramo</button>}</div>}
        </article>)}</div>}
      </section>
    </>}
  </section>;
}
