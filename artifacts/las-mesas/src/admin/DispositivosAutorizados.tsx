import { useEffect, useState } from 'react';
import { Check, Copy, LoaderCircle, ShieldCheck, Smartphone, X } from 'lucide-react';

type Dispositivo = { id: string; panel: 'barra' | 'cocina'; name: string; created_at: string; last_seen: string | null };
const etiquetaPanel = (panel: string) => panel === 'barra' ? 'Barra' : 'Cocina';

export default function DispositivosAutorizados({ abierto, cerrar }: { abierto: boolean; cerrar: () => void }) {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [panel, setPanel] = useState<'cocina' | 'barra'>('cocina');
  const [nombre, setNombre] = useState('Tablet Cocina');
  const [codigo, setCodigo] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [copiaFallida, setCopiaFallida] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function llamar(action: string, extra: Record<string, unknown> = {}) {
    const response = await fetch('/api/admin-login', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error ?? 'No se pudo completar la operación.');
    return data;
  }

  async function cargarDispositivos() {
    setCargando(true); setError('');
    try {
      const data = await llamar('listar_dispositivos');
      setDispositivos(Array.isArray(data.devices) ? data.devices : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los dispositivos.'); }
    finally { setCargando(false); }
  }

  useEffect(() => { if (abierto) void cargarDispositivos(); }, [abierto]);
  useEffect(() => { setNombre(panel === 'barra' ? 'Tablet Barra' : 'Tablet Cocina'); }, [panel]);
  useEffect(() => {
    if (!abierto) return;
    const cerrarEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', cerrarEsc);
    return () => window.removeEventListener('keydown', cerrarEsc);
  }, [abierto, cerrar]);

  async function generarCodigo(event: React.FormEvent) {
    event.preventDefault(); setCargando(true); setError(''); setCodigo(''); setCopiado(false); setCopiaFallida(false);
    try {
      const data = await llamar('crear_codigo_dispositivo', { panel, device_name: nombre });
      setCodigo(String(data.code ?? ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el código.'); }
    finally { setCargando(false); }
  }

  async function copiarCodigo() {
    setCopiado(false);
    setCopiaFallida(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        throw new Error('Portapapeles no disponible');
      }
    } catch {
      try {
        const campo = document.createElement('textarea');
        campo.value = codigo;
        campo.setAttribute('readonly', '');
        campo.style.position = 'fixed';
        campo.style.opacity = '0';
        campo.style.pointerEvents = 'none';
        document.body.appendChild(campo);
        campo.select();
        const correcto = document.execCommand('copy');
        document.body.removeChild(campo);
        if (!correcto) {
          setCopiaFallida(true);
          return;
        }
      } catch {
        setCopiaFallida(true);
        return;
      }
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2200);
  }

  async function revocar(device: Dispositivo) {
    if (!window.confirm(`¿Revocar el acceso de “${device.name}”? Dejará de recibir pedidos al instante.`)) return;
    setCargando(true); setError('');
    try {
      await llamar('revocar_dispositivo', { device_id: device.id });
      setDispositivos((items) => items.filter((item) => item.id !== device.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo revocar el dispositivo.'); }
    finally { setCargando(false); }
  }

  if (!abierto) return null;
  return (
    <div className="admin-modal-fondo dispositivo-modal-fondo" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cerrar(); }}>
      <section className="admin-modal dispositivos-modal" role="dialog" aria-modal="true" aria-labelledby="dispositivos-titulo">
        <header className="admin-modal-cabecera">
          <div><span className="dispositivos-eyebrow"><ShieldCheck size={14} /> Seguridad de paneles</span><h2 id="dispositivos-titulo">Dispositivos autorizados</h2></div>
          <button type="button" className="admin-icono" onClick={cerrar} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="admin-modal-cuerpo dispositivos-cuerpo">
          <p className="dispositivos-explicacion">Autoriza únicamente las tablets del local. Cada código sirve una vez, caduca en 10 minutos y solo funciona para el panel seleccionado.</p>
          <form className="dispositivos-form" onSubmit={(event) => void generarCodigo(event)}>
            <label className="admin-field"><span>Panel</span><select value={panel} onChange={(event) => setPanel(event.target.value as 'barra' | 'cocina')}><option value="cocina">Cocina</option><option value="barra">Barra</option></select></label>
            <label className="admin-field"><span>Nombre del dispositivo</span><input value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={60} required placeholder="Ej. iPad Cocina" /></label>
            <button className="admin-boton" type="submit" disabled={cargando || !nombre.trim()}>{cargando ? 'Preparando…' : 'Generar código de vinculación'}</button>
          </form>
          {codigo && <div className="dispositivos-codigo" role="status"><strong>{codigo}</strong><button type="button" onClick={() => void copiarCodigo()}>{copiado ? <Check size={15} /> : <Copy size={15} />}{copiado ? 'Copiado' : 'Copiar'}</button>{copiaFallida && <input aria-label="Código para copiar manualmente" readOnly value={codigo} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />}<small>{copiaFallida ? 'No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.' : copiado ? 'Código copiado al portapapeles.' : `En esa tablet abre /admin/vincular?panel=${panel} e introduce el código. Caduca en 10 minutos y solo se puede usar una vez.`}</small></div>}
          {error && <p className="admin-error" role="alert">{error}</p>}
          <div className="dispositivos-lista-cabecera"><h3>Tablets activas</h3><button type="button" className="admin-boton admin-boton-claro" onClick={() => void cargarDispositivos()} disabled={cargando}>{cargando ? <LoaderCircle size={15} className="animate-spin" /> : 'Actualizar'}</button></div>
          {cargando && dispositivos.length === 0 ? <p className="dispositivos-vacio">Cargando dispositivos…</p> : dispositivos.length === 0 ? <p className="dispositivos-vacio">Todavía no hay tablets autorizadas.</p> : <ul className="dispositivos-lista">{dispositivos.map((device) => <li key={device.id}><Smartphone size={18} /><div><strong>{device.name}</strong><span>{etiquetaPanel(device.panel)} · Autorizada {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(device.created_at))}{device.last_seen ? ` · Último acceso ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(device.last_seen))}` : ''}</span></div><button type="button" className="admin-boton-peligro" disabled={cargando} onClick={() => void revocar(device)}>Revocar</button></li>)}</ul>}
          <p className="dispositivos-nota">No hace falta crear una cuenta de correo para Cocina ni Barra. El código vincula este dispositivo solo al panel elegido; Administración también necesita vincular el dispositivo desde el que abrirá esos paneles.</p>
        </div>
      </section>
    </div>
  );
}
