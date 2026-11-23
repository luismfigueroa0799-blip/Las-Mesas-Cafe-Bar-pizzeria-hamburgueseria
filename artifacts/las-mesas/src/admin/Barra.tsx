import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, CalendarClock, Check, ChefHat, FileText, LogOut, Printer, RefreshCw, Search, Truck, UtensilsCrossed, X } from 'lucide-react';
import Login, { borrarToken, leerToken } from '@/admin/Login';
import { supabaseNavegador } from '@/lib/supabase';
import './barra.css';

type LineaPedido = Record<string, any>;
interface PedidoBarra {
  id: number;
  codigo: string;
  cliente: string;
  telefono: string;
  direccion: string;
  mesa: string;
  productos: LineaPedido[];
  total: number;
  tipoEntrega: string;
  estadoPago: string;
  estadoCocina: string;
  fecha: string | null;
}
type FiltroEstadoBarra = 'todos' | 'nuevos' | 'en-curso' | 'listos' | 'finalizados' | 'archivo';

function coincideFiltroEstado(pedido: PedidoBarra, filtro: FiltroEstadoBarra) {
  const estado = String(pedido.estadoCocina || 'pendiente').toLowerCase();
  const finalizado = estado === 'servido' || estado === 'entregado';
  const fechaMs = pedido.fecha ? new Date(pedido.fecha).getTime() : Number.NaN;
  const archivado = finalizado && Number.isFinite(fechaMs) && fechaMs > 0 && Date.now() - fechaMs > 24 * 60 * 60 * 1000;
  if (filtro === 'todos') return !archivado;
  if (filtro === 'nuevos') return estado === 'pendiente';
  if (filtro === 'en-curso') return estado === 'confirmado' || estado === 'preparando';
  if (filtro === 'listos') return estado === 'listo' || estado === 'en_reparto';
  if (filtro === 'finalizados') return finalizado && !archivado;
  return archivado;
}

function euros(valor: unknown) {
  const numero = typeof valor === 'string'
    ? Number(valor.replace(',', '.').replace(/[^\d.-]/g, ''))
    : Number(valor);
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(numero) ? numero : 0);
}

function fechaPedido(valor: string | null) {
  if (!valor) return 'Fecha no disponible';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha);
}

function nombreEstado(valor: string) {
  const estado = String(valor || 'pendiente').replaceAll('_', ' ');
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

function lineasDe(pedido: PedidoBarra) {
  return pedido.productos.map((linea, indice) => {
    const cantidad = Math.max(1, Number(linea.qty ?? linea.cantidad ?? linea.quantity ?? 1));
    const precio = Number(linea.precio_unitario ?? linea.precio ?? linea.price ?? 0);
    const opciones = Array.isArray(linea.opciones) ? linea.opciones : Array.isArray(linea.options) ? linea.options : [];
    const nombresOpciones = opciones.map((opcion: any) => typeof opcion === 'string' ? opcion : opcion.nombre ?? opcion.name).filter(Boolean);
    return {
      key: `${pedido.id}-${indice}`,
      nombre: String(linea.nombre ?? linea.name ?? linea.producto ?? 'Producto'),
      cantidad,
      precio: Number.isFinite(precio) ? precio : 0,
      subtotal: Number.isFinite(Number(linea.subtotal)) ? Number(linea.subtotal) : (Number.isFinite(precio) ? precio * cantidad : 0),
      opciones: nombresOpciones,
      nota: String(linea.nota ?? linea.note ?? '').trim(),
      premio: linea.premio_ruleta === true || linea.isPrize === true,
    };
  });
}

const Barra: React.FC = () => {
  const [token, setToken] = useState(() => leerToken());
  const [comprobandoSesion, setComprobandoSesion] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoBarra[]>([]);
  const [cargando, setCargando] = useState(false);
  const [actualizada, setActualizada] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'mesa' | 'domicilio'>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoBarra>('todos');
  const [facturaId, setFacturaId] = useState<number | null>(null);
  const [imprimirAlAbrir, setImprimirAlAbrir] = useState(false);
  const [pushActivo, setPushActivo] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState('');
  const [pushMensaje, setPushMensaje] = useState('');
  const peticionActiva = useRef(false);

  useEffect(() => {
    setComprobandoSesion(false);
  }, []);

  const cargarPedidos = useCallback(async (silencioso = false) => {
    if (!token || peticionActiva.current) return;
    peticionActiva.current = true;
    if (!silencioso) setCargando(true);
    try {
      const respuesta = await fetch('/api/admin-productos?vista=barra', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        if (respuesta.status === 403) {
          setPedidos([]);
          setPushActivo(false);
          localStorage.setItem('lasmesas-barra-push', 'inactivo');
          borrarToken();
          setToken('');
        }
        if (respuesta.status === 401) {
          borrarToken();
          setToken('');
        }
        throw new Error(datos?.error || 'No se pudieron cargar las comandas.');
      }
      setPedidos(Array.isArray(datos.pedidos) ? datos.pedidos : []);
      if (typeof datos.pushPublicKey === 'string') setPushPublicKey(datos.pushPublicKey);
      setActualizada(new Date());
      setError('');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las comandas.');
    } finally {
      peticionActiva.current = false;
      if (!silencioso) setCargando(false);
    }
  }, [token]);

  function clavePushABuffer(valor: string): Uint8Array {
    const normalizado = valor.replace(/-/g, '+').replace(/_/g, '/');
    const decodificado = window.atob(normalizado + '='.repeat((4 - normalizado.length % 4) % 4));
    return Uint8Array.from(decodificado, (caracter) => caracter.charCodeAt(0));
  }

  async function alternarAvisosPush() {
    setPushCargando(true);
    setPushMensaje('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Este navegador no admite avisos push. Abre Barra en Chrome actualizado en la tablet Android.');
      }
      const registro = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const suscripcionActual = await registro.pushManager.getSubscription();
      if (pushActivo) {
        if (suscripcionActual) {
          const respuesta = await fetch('/api/admin-productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ accion: 'eliminar_push', panel: 'barra', subscription: suscripcionActual.toJSON() }),
          });
          if (!respuesta.ok) throw new Error('No se pudo desactivar el aviso de Barra.');
        }
        localStorage.setItem('lasmesas-barra-push', 'inactivo');
        setPushActivo(false);
        setPushMensaje('Avisos de Barra desactivados en esta tablet.');
        return;
      }
      if (!pushPublicKey) throw new Error('No se pudo cargar la clave de avisos. Actualiza el panel e inténtalo de nuevo.');
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') throw new Error('Permite las notificaciones de Chrome en los ajustes de la tablet.');
      const bytesClave = clavePushABuffer(pushPublicKey);
      const claveServidor = new ArrayBuffer(bytesClave.byteLength);
      new Uint8Array(claveServidor).set(bytesClave);
      const suscripcion = suscripcionActual ?? await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveServidor });
      const respuesta = await fetch('/api/admin-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accion: 'registrar_push', panel: 'barra', subscription: suscripcion.toJSON() }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data?.error || 'No se pudieron guardar los avisos de esta tablet.');
      localStorage.setItem('lasmesas-barra-push', 'activo');
      setPushActivo(true);
      setPushMensaje('Avisos activados. Esta tablet recibirá una alerta cuando se confirme un pedido pagado.');
    } catch (fallo) {
      setPushMensaje(fallo instanceof Error ? fallo.message : 'No se pudieron activar los avisos push.');
    } finally {
      setPushCargando(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void cargarPedidos();
    const temporizador = window.setInterval(() => {
      if (document.visibilityState === 'visible') void cargarPedidos(true);
    }, 3000);
    const alVolver = () => { if (document.visibilityState === 'visible') void cargarPedidos(true); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [token, cargarPedidos]);

  useEffect(() => {
    if (!token || !('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (localStorage.getItem('lasmesas-barra-push') !== 'activo' || Notification.permission !== 'granted') return;
    let vigente = true;
    const sincronizarSuscripcion = async () => {
      const registro = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (!suscripcion || !vigente) return;
      const respuesta = await fetch('/api/admin-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accion: 'registrar_push', panel: 'barra', subscription: suscripcion.toJSON() }),
      });
      if (respuesta.ok && vigente) setPushActivo(true);
    };
    void sincronizarSuscripcion().catch(() => undefined);
    return () => { vigente = false; };
  }, [token]);

  function salir() {
    borrarToken();
    const supabase = supabaseNavegador();
    if (supabase) void supabase.auth.signOut();
    window.location.assign('/login');
  }

  const filtrados = useMemo(() => pedidos.filter((pedido) => {
    const texto = busqueda.trim().toLowerCase();
    const mesa = pedido.tipoEntrega === 'mesa' || Boolean(pedido.mesa);
    const coincideTexto = !texto || [pedido.codigo, pedido.cliente, pedido.telefono, pedido.direccion, ...pedido.productos.map((item) => item.nombre ?? item.name ?? '')]
      .some((valor) => String(valor ?? '').toLowerCase().includes(texto));
    const coincideTipo = filtroTipo === 'todos' || (filtroTipo === 'mesa' ? mesa : !mesa);
    return coincideTexto && coincideTipo && coincideFiltroEstado(pedido, filtroEstado);
  }), [pedidos, busqueda, filtroTipo, filtroEstado]);

  const conteoEstado = (filtro: FiltroEstadoBarra) => pedidos.filter((pedido) => coincideFiltroEstado(pedido, filtro)).length;

  const factura = pedidos.find((pedido) => pedido.id === facturaId) ?? null;
  const articulosFactura = factura ? lineasDe(factura) : [];

  useEffect(() => {
    if (!factura || !imprimirAlAbrir) return;
    const temporizador = window.setTimeout(() => {
      window.print();
      setImprimirAlAbrir(false);
    }, 180);
    return () => window.clearTimeout(temporizador);
  }, [factura, imprimirAlAbrir]);

  if (comprobandoSesion) return <div className="barra-cargando"><RefreshCw className="barra-spin" /> Comprobando acceso…</div>;
  if (!token) return <Login destino="/admin/barra" />;

  return (
    <main className="barra-page">
      <header className="barra-topbar">
        <div className="barra-brand"><ChefHat size={20} /><span>Las Mesas</span><i /> Barra</div>
        <nav className="barra-acciones">
          <button type="button" className={pushActivo ? 'barra-avisos-activos' : ''} onClick={() => void alternarAvisosPush()} disabled={pushCargando} aria-pressed={pushActivo}>
            {pushActivo ? <BellRing size={16} /> : <Bell size={16} />}<span>{pushCargando ? 'Configurando…' : pushActivo ? 'Avisos activos' : 'Activar avisos'}</span>
          </button>
          <button type="button" onClick={() => void cargarPedidos()} disabled={cargando}><RefreshCw size={16} className={cargando ? 'barra-spin' : ''} /><span>Actualizar</span></button>
          <button type="button" onClick={salir}><LogOut size={16} /><span>Salir</span></button>
        </nav>
      </header>

      <section className="barra-contenido">
        <div className="barra-heading">
          <div><span className="barra-eyebrow"><FileText size={15} /> Control de pedidos pagados</span><h1>Comandas de barra</h1><p>Se muestran cuando Stripe confirma el pago.</p></div>
          <div className={`barra-live ${error ? 'sin-conexion' : actualizada ? 'conectado' : 'conectando'}`} role="status" aria-live="polite"><span />{error ? 'Sin conexión con los pedidos' : actualizada ? 'Conectado · sincronizado cada 3 segundos' : 'Conectando con los pedidos…'}{actualizada && <small>Actualizada {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(actualizada)}</small>}</div>
        </div>

        {pushMensaje && <div className={`barra-push-mensaje ${pushActivo ? 'activo' : ''}`} role="status">{pushMensaje}</div>}
        <div className="barra-resumen">
          <div><span>Comandas cargadas</span><strong>{pedidos.length}</strong></div>
          <div><span>Mesas</span><strong>{pedidos.filter((pedido) => pedido.tipoEntrega === 'mesa' || Boolean(pedido.mesa)).length}</strong></div>
          <div><span>A domicilio</span><strong>{pedidos.filter((pedido) => pedido.tipoEntrega !== 'mesa' && !pedido.mesa).length}</strong></div>
        </div>

        <div className="barra-filtros">
          <label className="barra-busqueda"><Search size={17} /><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por código, cliente o producto" /></label>
          <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value as typeof filtroTipo)} aria-label="Filtrar por tipo">
            <option value="todos">Todos los pedidos</option><option value="mesa">Mesas</option><option value="domicilio">A domicilio</option>
          </select>
        </div>

        <div className="barra-estado-filtros" role="group" aria-label="Filtrar comandas por estado de preparación">
          {([['todos','Activos'],['nuevos','Nuevos'],['en-curso','En preparación'],['listos','Listos'],['finalizados','Finalizados'],['archivo','Archivo · +24 h']] as const).map(([valor, texto]) => (
            <button key={valor} type="button" className={filtroEstado === valor ? 'activo' : ''} aria-pressed={filtroEstado === valor} onClick={() => setFiltroEstado(valor)}>{texto}<span>{conteoEstado(valor)}</span></button>
          ))}
        </div>

        {error && <div className="barra-error" role="alert">{error}</div>}
        {cargando && pedidos.length === 0 && <div className="barra-vacio"><RefreshCw className="barra-spin" /> Cargando comandas…</div>}
        {!cargando && !error && filtrados.length === 0 && <div className="barra-vacio"><FileText size={30} /><strong>No hay comandas en esta vista</strong><span>Los pedidos aparecerán aquí automáticamente.</span></div>}

        <div className="barra-lista">
          {filtrados.map((pedido) => {
            const mesa = pedido.tipoEntrega === 'mesa' || Boolean(pedido.mesa);
            const lineas = lineasDe(pedido);
            const estadoCocina = String(pedido.estadoCocina || 'pendiente').toLowerCase();
            const pasos = mesa
              ? ['pendiente', 'confirmado', 'preparando', 'listo', 'servido']
              : ['pendiente', 'confirmado', 'preparando', 'listo', 'en_reparto', 'entregado'];
            const indicePaso = pasos.indexOf(estadoCocina);
            const pasosCompletados = indicePaso < 0 && (estadoCocina === 'servido' || estadoCocina === 'entregado')
              ? pasos.length - 1
              : Math.max(0, indicePaso);
            return (
              <article className="barra-pedido" key={pedido.id}>
                <div className="barra-pedido-cabeza">
                  <div className="barra-codigo-wrap"><span className="barra-codigo">{pedido.codigo || `#${pedido.id}`}</span><span className={`barra-origen ${mesa ? 'mesa' : 'domicilio'}`}>{mesa ? <><UtensilsCrossed size={13} /> {pedido.mesa ? `Mesa ${pedido.mesa.replace(/^mesa\s*/i, '')}` : 'Mesa'}</> : <><Truck size={13} /> A domicilio</>}</span></div>
                  <span className={`barra-estado ${String(pedido.estadoPago || 'pendiente').toLowerCase().replaceAll('_', '-')}`}>Pago: {nombreEstado(pedido.estadoPago || 'pendiente')}</span>
                </div>
                <div className="barra-metadata"><span><CalendarClock size={14} /> {fechaPedido(pedido.fecha)}</span>{pedido.cliente && <strong>{pedido.cliente}</strong>}{pedido.telefono && <a href={`tel:${pedido.telefono}`}>{pedido.telefono}</a>}{!mesa && pedido.direccion && <span>{pedido.direccion}</span>}</div>
                <div className="barra-progreso" aria-label={`Estado de cocina: ${nombreEstado(estadoCocina)}`}>
                  <div className="barra-progreso-cabeza"><strong><ChefHat size={15} /> Progreso en cocina</strong><span className={`barra-cocina-estado ${estadoCocina}`}>{nombreEstado(estadoCocina)}</span></div>
                  <ol className="barra-pasos">
                    {pasos.map((paso, indice) => <li key={paso} className={`${indice <= pasosCompletados ? 'completado' : ''} ${indice === indicePaso ? 'actual' : ''}`}>
                      <span className="barra-paso-punto">{indice < pasosCompletados ? <Check size={11} /> : indice + 1}</span>
                      <span>{nombreEstado(paso)}</span>
                    </li>)}
                  </ol>
                </div>
                <div className="barra-lineas">
                  {lineas.map((linea) => <div className="barra-linea" key={linea.key}><span>{linea.cantidad}×</span><div><strong>{linea.nombre}</strong>{linea.opciones.length > 0 && <small>{linea.opciones.join(' · ')}</small>}{linea.nota && <small>Nota: {linea.nota}</small>}</div><b>{euros(linea.subtotal)}</b></div>)}
                </div>
                <div className="barra-pedido-pie"><div className="barra-total"><span>Total</span><strong>{euros(pedido.total)}</strong></div><div className="barra-factura-botones"><button type="button" className="barra-factura-boton ver" onClick={() => { setImprimirAlAbrir(false); setFacturaId(pedido.id); }}><FileText size={16} /> Ver factura</button><button type="button" className="barra-factura-boton imprimir" onClick={() => { setImprimirAlAbrir(true); setFacturaId(pedido.id); }}><Printer size={16} /> Imprimir factura</button></div></div>
              </article>
            );
          })}
        </div>
      </section>

      {factura && <div className="barra-factura-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFacturaId(null); }}>
        <section className="barra-factura-dialog" role="dialog" aria-modal="true" aria-label={`Factura del pedido ${factura.codigo}`}>
          <div className="barra-factura-acciones"><button type="button" onClick={() => setFacturaId(null)}><X size={16} /> Cerrar</button><button type="button" className="principal" onClick={() => window.print()}><Printer size={16} /> Imprimir / Guardar PDF</button></div>
          <article className="barra-factura-hoja">
            <header className="barra-factura-cabecera"><div><p>LAS MESAS · CAFÉ &amp; BAR</p><h2>Factura del pedido</h2><span>Pintor Antonio Padrón, 59 · Las Mesas Bajas</span><span>+34 928 896 097</span></div><div className="barra-factura-numero"><small>N.º de pedido</small><strong>{factura.codigo || `#${factura.id}`}</strong><small>{fechaPedido(factura.fecha)}</small></div></header>
            <div className="barra-factura-cliente"><div><small>Cliente</small><strong>{factura.cliente || 'Cliente de mostrador'}</strong></div>{factura.telefono && <div><small>Teléfono</small><strong>{factura.telefono}</strong></div>}<div><small>Servicio</small><strong>{factura.tipoEntrega === 'mesa' || factura.mesa ? (factura.mesa ? `Mesa ${factura.mesa.replace(/^mesa\s*/i, '')}` : 'Mesa') : 'A domicilio'}</strong></div>{factura.direccion && <div><small>Dirección</small><strong>{factura.direccion}</strong></div>}</div>
            <table className="barra-factura-tabla"><thead><tr><th>Artículo</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead><tbody>{articulosFactura.map((linea) => <tr key={linea.key}><td><strong>{linea.nombre}</strong>{linea.opciones.length > 0 && <small>{linea.opciones.join(' · ')}</small>}{linea.nota && <small>Nota: {linea.nota}</small>}</td><td>{linea.cantidad}</td><td>{euros(linea.precio)}</td><td>{euros(linea.subtotal)}</td></tr>)}</tbody></table>
            <div className="barra-factura-total"><span>Total del pedido</span><strong>{euros(factura.total)}</strong></div>
            <footer className="barra-factura-pie"><Check size={15} /> Documento asociado al pedido {factura.codigo || `#${factura.id}`} · Pago: {nombreEstado(factura.estadoPago || 'pendiente')}</footer>
          </article>
        </section>
      </div>}
    </main>
  );
};

export default Barra;
