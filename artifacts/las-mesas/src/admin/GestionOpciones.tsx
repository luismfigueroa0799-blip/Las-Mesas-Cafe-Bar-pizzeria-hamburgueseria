import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { Link } from 'wouter';

interface OptionItem {
  id: string;
  name: string;
  extraPrice: number;
  available: boolean;
}
interface Group {
  id: string;
  name: string;
  type: 'quitar' | 'extra' | 'elegir';
  required: boolean;
  min: number;
  max: number;
  options: OptionItem[];
}

/** Gestión de grupos de opciones y sus opciones. */
export default function GestionOpciones() {
  const [token, setToken] = useState('');
  const [grupos, setGrupos] = useState<Group[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  // Formulario de nuevo grupo
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'quitar' | 'extra' | 'elegir'>('extra');
  const [obligatorio, setObligatorio] = useState(false);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);
  // Formulario de nueva opción por grupo
  const [opcionNombre, setOpcionNombre] = useState<Record<string, string>>({});
  const [opcionPrecio, setOpcionPrecio] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? window.localStorage.getItem('lm_admin_token') ?? '';
    setToken(t);
  }, []);

  async function cargar(t: string) {
    setCargando(true);
    try {
      const r = await fetch('/api/admin-opciones', { headers: { Authorization: 'Bearer ' + t } });
      const j = await r.json();
      if (r.ok) setGrupos(j.grupos ?? []);
      else setError(j.error ?? 'Error al cargar');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { if (token) void cargar(token); }, [token]);

  async function enviar(body: Record<string, unknown>) {
    setError('');
    try {
      const r = await fetch('/api/admin-opciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) { setGrupos(j.grupos ?? []); return true; }
      setError(j.error ?? 'Error');
      return false;
    } catch (e) { setError((e as Error).message); return false; }
  }

  async function crearGrupo(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (await enviar({ accion: 'crear_grupo', name: nombre, type: tipo, required: obligatorio, min_choices: min, max_choices: max })) {
      setNombre('');
    }
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <span className="admin-eyebrow"><Pencil size={16} /> Las Mesas</span>
          <h1>Opciones de productos</h1>
          <p className="admin-sub">Grupos reutilizables y sus opciones</p>
        </div>
        <div className="admin-acciones">
          <Link className="admin-boton admin-boton-claro" href="/admin/inventario"><ArrowLeft size={16} /> Volver</Link>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <form className="admin-card admin-nuevo-grupo" onSubmit={crearGrupo}>
        <h2>Crear grupo</h2>
        <div className="admin-form-grid">
          <label>Nombre <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Extras de hamburguesa" /></label>
          <label>Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="extra">Añadir extra</option>
              <option value="quitar">Quitar ingrediente</option>
              <option value="elegir">Elegir una opción</option>
            </select>
          </label>
          <label>Mínimo <input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value))} /></label>
          <label>Máximo <input type="number" min={1} value={max} onChange={(e) => setMax(Number(e.target.value))} /></label>
          <label className="admin-check"><input type="checkbox" checked={obligatorio} onChange={(e) => setObligatorio(e.target.checked)} /> Obligatorio</label>
        </div>
        <button className="admin-boton" type="submit"><Plus size={16} /> Crear grupo</button>
      </form>

      {cargando ? <p className="admin-vacio">Cargando…</p> : (
        <div className="admin-grupos-lista">
          {grupos.map((g) => (
            <section className="admin-card admin-grupo" key={g.id}>
              <header>
                <div>
                  <h3>{g.name}</h3>
                  <p>{g.type} · mín. {g.min} · máx. {g.max} {g.required ? '· obligatorio' : ''}</p>
                </div>
                <button className="admin-boton admin-boton-claro" onClick={() => void enviar({ accion: 'borrar_grupo', id: g.id })} aria-label={'Borrar ' + g.name}>
                  <Trash2 size={16} />
                </button>
              </header>
              <ul className="admin-op-lista">
                {g.options.map((op) => (
                  <li key={op.id}>
                    <button
                      className={op.available ? 'admin-op-dot is-on' : 'admin-op-dot'}
                      onClick={() => void enviar({ accion: 'editar_opcion', id: op.id, name: op.name, extra_price: op.extraPrice, available: !op.available })}
                      aria-label={op.available ? 'Marcar agotada' : 'Marcar disponible'}
                      title={op.available ? 'Disponible' : 'Agotada'}
                    />
                    <span>{op.name}</span>
                    <strong>+{op.extraPrice.toFixed(2)} €</strong>
                    <button className="admin-boton admin-boton-claro" onClick={() => {
                      const nuevo = window.prompt('Nuevo nombre', op.name);
                      if (nuevo) void enviar({ accion: 'editar_opcion', id: op.id, name: nuevo, extra_price: op.extraPrice, available: op.available });
                    }} aria-label="Editar"><Pencil size={14} /></button>
                    <button className="admin-boton admin-boton-claro" onClick={() => void enviar({ accion: 'borrar_opcion', id: op.id })} aria-label="Borrar"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
              <form className="admin-nueva-op" onSubmit={(e) => {
                e.preventDefault();
                const name = (opcionNombre[g.id] ?? '').trim();
                if (!name) return;
                void enviar({ accion: 'crear_opcion', group_id: g.id, name, extra_price: Number(opcionPrecio[g.id] ?? 0) || 0 }).then((ok) => {
                  if (ok) { setOpcionNombre((p) => ({ ...p, [g.id]: '' })); setOpcionPrecio((p) => ({ ...p, [g.id]: '' })); }
                });
              }}>
                <input value={opcionNombre[g.id] ?? ''} onChange={(e) => setOpcionNombre((p) => ({ ...p, [g.id]: e.target.value }))} placeholder="Nombre de la opción" />
                <input value={opcionPrecio[g.id] ?? ''} onChange={(e) => setOpcionPrecio((p) => ({ ...p, [g.id]: e.target.value }))} placeholder="Extra €" inputMode="decimal" />
                <button className="admin-boton" type="submit"><Plus size={15} /> Añadir</button>
              </form>
            </section>
          ))}
          {!grupos.length && <p className="admin-vacio">Todavía no hay grupos. Crea el primero arriba.</p>}
        </div>
      )}
    </div>
  );
}
