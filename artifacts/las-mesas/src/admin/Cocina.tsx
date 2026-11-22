import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, BellRing, Check, ChefHat, Clock3, FileText, LogOut, PackageCheck, RefreshCw, Truck, UtensilsCrossed, X } from 'lucide-react';
import { Link } from 'wouter';
import Login, { borrarToken, leerToken } from '@/admin/Login';
import { supabaseNavegador } from '@/lib/supabase';
import './cocina.css';

type EstadoCocina = 'pendiente' | 'confirmado' | 'preparando' | 'listo' | 'servido' | 'en_reparto' | 'entregado';
type ProductoPedido = Record<string, any>;
interface PedidoCocina {
  id: number;
  codigo: string;
  cliente: string;
  telefono: string;
  direccion: string;
  mesa: string;
  productos: ProductoPedido[];
  total: number;
  tipoEntrega: string;
  estadoPago: string;
  estadoCocina: EstadoCocina;
  fecha: string | null;
}

const FILTROS_ESTADO = [
  ['todos', 'Todos'],
  ['pendiente', 'Pendiente'],
  ['confirmado', 'Confirmado'],
  ['preparando', 'En cocina'],
  ['listo', 'Listo'],
  ['finalizado', 'Finalizados'],
] as const;

function textoEstado(estado: EstadoCocina) {
  return ({
    pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'En cocina', listo: 'Listo',
    servido: 'Servido', en_reparto: 'En reparto', entregado: 'Entregado',
  } as Record<EstadoCocina, string>)[estado] ?? 'Pendiente';
}

function horaPedido(fecha: string | null) {
  if (!fecha) return 'Hora no disponible';
  const date = new Date(fecha);
  return Number.isNaN(date.getTime()) ? 'Hora no disponible' : new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function minutosEspera(fecha: string | null) {
  if (!fecha) return null;
  const valor = new Date(fecha).getTime();
  if (!Number.isFinite(valor)) return null;
  return Math.max(0, Math.floor((Date.now() - valor) / 60_000));
}

function euro(value: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0);
}

function tocarAviso(context: AudioContext) {
  if (context.state !== 'running') return;
  const inicio = context.currentTime + 0.03;
  [880, 660, 880].forEach((frecuencia, indice) => {
    const cuando = inicio + indice * 0.24;
    const tono = context.createOscillator();
    const volumen = context.createGain();
    tono.type = 'sine';
    tono.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(0.0001, cuando);
    volumen.gain.exponentialRampToValueAtTime(0.16, cuando + 0.025);
    volumen.gain.exponentialRampToValueAtTime(0.0001, cuando + 0.19);
    tono.connect(volumen);
    volumen.connect(context.destination);
    tono.start(cuando);
    tono.stop(cuando + 0.2);
  });
}

function esMesa(pedido: PedidoCocina) {
  return pedido.tipoEntrega === 'mesa' || Boolean(pedido.mesa);
}

function articulosPedido(pedido: PedidoCocina) {
  return pedido.productos.map((item, index) => {
    const nombre = String(item.nombre ?? item.name ?? item.producto ?? item.title ?? 'Producto');
    const cantidad = Math.max(1, Number(item.qty ?? item.cantidad ?? item.quantity ?? 1));
    const opciones = Array.isArray(item.opciones) ? item.opciones : Array.isArray(item.options) ? item.options : [];
    const extras = opciones.map((opcion: any) => typeof opcion === 'string' ? opcion : opcion.nombre ?? opcion.name).filter(Boolean);
    const nota = String(item.nota ?? item.note ?? '').trim();
    return { key: `${pedido.id}-${index}`, nombre, cantidad, extras, nota };
  });
}

function siguienteAccion(pedido: PedidoCocina): { estado: EstadoCocina; texto: string } | null {
  switch (pedido.estadoCocina) {
    case 'pendiente': return { estado: 'confirmado', texto: 'Confirmar pedido' };
    case 'confirmado': return { estado: 'preparando', texto: 'Empezar preparación' };
    case 'preparando': return { estado: 'listo', texto: 'Marcar como listo' };
    case 'listo': return esMesa(pedido)
      ? { estado: 'servido', texto: 'Marcar servido' }
      : { estado: 'en_reparto', texto: 'Sale a reparto' };
    case 'en_reparto': return { estado: 'entregado', texto: 'Marcar entregado' };
    default: return null;
  }
}

const Cocina: React.FC = () => {
  const [token, setToken] = useState(() => leerToken());
  const [comprobandoSesion, setComprobandoSesion] = useState(() => !leerToken());
  const [pedidos, setPedidos] = useState<PedidoCocina[]>([]);
  const [tipo, setTipo] = useState<'todos' | 'mesa' | 'domicilio'>('todos');
  const [estado, setEstado] = useState<string>('todos');
  const [cargando, setCargando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [sonidoActivo, setSonidoActivo] = useState(false);
  const [pushActivo, setPushActivo] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState('');
  const [pushMensaje, setPushMensaje] = useState('');
  const [avisoNuevo, setAvisoNuevo] = useState('');
  const [pedidosNuevos, setPedidosNuevos] = useState<number[]>([]);
  const pedidosVistos = useRef<Set<number> | null>(null);
  const peticionActiva = useRef(false);
  const sonidoRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const avisoTimer = useRef<number | null>(null);

  useEffect(() => {
    if (token) { setComprobandoSesion(false); return; }
    const supabase = supabaseNavegador();
    if (!supabase) { setComprobandoSesion(false); return; }
    let vigente = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return;
      const access = data.session?.access_token ?? '';
      if (access) setToken(access);
      setComprobandoSesion(false);
    }).catch(() => { if (vigente) setComprobandoSesion(false); });
    return () => { vigente = false; };
  }, [token]);

  const cargarPedidos = useCallback(async (silencioso = false) => {
    if (!token || peticionActiva.current) return;
    peticionActiva.current = true;
    if (!silencioso) setCargando(true);
    try {
      const response = await fetch('/api/admin-productos?vista=cocina', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          borrarToken();
          setToken('');
        }
        throw new Error(data?.error || 'No se pudieron cargar los pedidos.');
      }
      const lista: PedidoCocina[] = Array.isArray(data.pedidos) ? data.pedidos : [];
      if (typeof data.pushPublicKey === 'string') setPushPublicKey(data.pushPublicKey);
      const vistos = pedidosVistos.current;
      if (!vistos) {
        pedidosVistos.current = new Set(lista.map((pedido) => pedido.id));
      } else {
        const nuevos = lista.filter((pedido) => !vistos.has(pedido.id));
        nuevos.forEach((pedido) => vistos.add(pedido.id));
        if (nuevos.length) {
          const nuevosPendientes = nuevos.filter((pedido) => pedido.estadoCocina === 'pendiente').map((pedido) => pedido.id);
          if (nuevosPendientes.length) setPedidosNuevos((actuales) => Array.from(new Set([...actuales, ...nuevosPendientes])));
          setAvisoNuevo(nuevos.length === 1 ? '¡Nuevo pedido recibido!' : `¡Han llegado ${nuevos.length} pedidos nuevos!`);
          if (sonidoRef.current && audioRef.current) tocarAviso(audioRef.current);
          if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
          avisoTimer.current = window.setTimeout(() => setAvisoNuevo(''), 12000);
        }
      }
      setPedidos(lista);
      setPedidosNuevos((actuales) => actuales.filter((id) => lista.some((pedido) => pedido.id === id && pedido.estadoCocina === 'pendiente')));
      setError('');
      setUltimaActualizacion(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.');
    } finally {
      peticionActiva.current = false;
      if (!silencioso) setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void cargarPedidos();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void cargarPedidos(true);
    }, 3000);
    const alVolver = () => { if (document.visibilityState === 'visible') void cargarPedidos(true); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [token, cargarPedidos]);

  useEffect(() => {
    if (!token || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then((registro) => registro.pushManager.getSubscription())
      .then((suscripcion) => { if (suscripcion) setPushActivo(true); })
      .catch(() => undefined);
  }, [token]);

  async function alternarSonido() {
    if (sonidoRef.current) {
      sonidoRef.current = false;
      setSonidoActivo(false);
      return;
    }
    try {
      const ContextoAudio = window.AudioContext;
      if (!ContextoAudio) throw new Error('El navegador no admite avisos sonoros.');
      const context = audioRef.current ?? new ContextoAudio();
      audioRef.current = context;
      await context.resume();
      sonidoRef.current = true;
      setSonidoActivo(true);
      tocarAviso(context);
    } catch {
      setError('No se pudo activar el sonido. Comprueba el volumen del iPad e inténtalo otra vez.');
    }
  }

  function clavePushABuffer(valor: string): Uint8Array {
    const normalizado = valor.replace(/-/g, '+').replace(/_/g, '/');
    const decodificado = window.atob(normalizado + '='.repeat((4 - normalizado.length % 4) % 4));
    return Uint8Array.from(decodificado, (caracter) => caracter.charCodeAt(0));
  }

  async function alternarPush() {
    setPushCargando(true);
    setPushMensaje('');
    try {
      const instalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      if (!instalada) throw new Error('En el iPad, abre esta página en Safari, pulsa Compartir y elige “Añadir a pantalla de inicio”. Después abre Cocina desde ese icono.');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Este iPad no admite notificaciones web. Actualiza iPadOS y abre Cocina desde la pantalla de inicio.');
      }

      const registro = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const suscripcionActual = await registro.pushManager.getSubscription();
      if (suscripcionActual && pushActivo) {
        const jsonActual = suscripcionActual.toJSON();
        await fetch('/api/admin-productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accion: 'eliminar_push', panel: 'cocina', subscription: jsonActual }),
        });
        setPushActivo(false);
        setPushMensaje('Avisos de pedidos desactivados en este iPad.');
        return;
      }
      if (!pushPublicKey) throw new Error('Falta configurar la clave pública de notificaciones en el servidor.');
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') throw new Error('Permite las notificaciones de Cocina en los ajustes del iPad.');
      const bytesClave = clavePushABuffer(pushPublicKey);
      const claveServidor = new ArrayBuffer(bytesClave.byteLength);
      new Uint8Array(claveServidor).set(bytesClave);
      const suscripcion = suscripcionActual ?? await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveServidor,
      });
      const respuesta = await fetch('/api/admin-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accion: 'registrar_push', panel: 'cocina', subscription: suscripcion.toJSON() }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data?.error || 'No se pudieron guardar los avisos de este iPad.');
      setPushActivo(true);
      setPushMensaje('La suscripción de este iPad quedó guardada. Falta autorizar y configurar el envío de notificaciones desde el servidor para que lleguen pedidos.');
    } catch (error) {
      setPushMensaje(error instanceof Error ? error.message : 'No se pudieron activar los avisos push.');
    } finally {
      setPushCargando(false);
    }
  }

  useEffect(() => () => {
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    if (audioRef.current && audioRef.current.state !== 'closed') void audioRef.current.close();
  }, []);

  async function cambiarEstado(pedido: PedidoCocina, nuevoEstado: EstadoCocina) {
    setActualizandoId(pedido.id);
    setError('');
    try {
      const response = await fetch('/api/admin-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accion: 'actualizar_cocina', id: pedido.id, estado_cocina: nuevoEstado }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo actualizar el pedido.');
      setPedidos((actuales) => actuales.map((item) => item.id === pedido.id ? { ...item, estadoCocina: nuevoEstado } : item));
      if (nuevoEstado === 'confirmado') setPedidosNuevos((actuales) => actuales.filter((id) => id !== pedido.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el pedido.');
      void cargarPedidos(true);
    } finally {
      setActualizandoId(null);
    }
  }

  function salir() {
    borrarToken();
    const supabase = supabaseNavegador();
    if (supabase) void supabase.auth.signOut();
    window.location.assign('/login');
  }

  const filtrados = useMemo(() => pedidos.filter((pedido) => {
    const mesa = esMesa(pedido);
    if (tipo === 'mesa' && !mesa) return false;
    if (tipo === 'domicilio' && mesa) return false;
    if (estado === 'finalizado') return pedido.estadoCocina === 'servido' || pedido.estadoCocina === 'entregado';
    if (estado !== 'todos' && pedido.estadoCocina !== estado) return false;
    return true;
  }), [pedidos, tipo, estado]);

  const pedidosOrdenados = useMemo(() => [...filtrados].sort((a, b) => {
    const prioridad = (pedido: PedidoCocina) => ({ pendiente: 0, confirmado: 1, preparando: 2, listo: 3, en_reparto: 3, servido: 4, entregado: 4 }[pedido.estadoCocina] ?? 5);
    const diferenciaPrioridad = prioridad(a) - prioridad(b);
    if (diferenciaPrioridad) return diferenciaPrioridad;
    const fechaA = a.fecha ? new Date(a.fecha).getTime() : Number.MAX_SAFE_INTEGER;
    const fechaB = b.fecha ? new Date(b.fecha).getTime() : Number.MAX_SAFE_INTEGER;
    return fechaA - fechaB;
  }), [filtrados]);

  if (comprobandoSesion) return <div className="cocina-cargando"><RefreshCw className="cocina-spin" /> Comprobando acceso…</div>;
  if (!token) return <Login destino="/admin/cocina" />;

  return (
    <main className="cocina-page">
      <header className="cocina-topbar">
        <Link href="/admin/inventario" className="cocina-volver"><ArrowLeft size={17} /> Volver al inventario</Link>
        <div className="cocina-brand"><ChefHat size={20} /><span>Las Mesas</span><i /> Cocina</div>
        <div className="cocina-top-actions">
          <Link href="/admin/barra" className="cocina-link-barra"><FileText size={16} /><span>Barra</span></Link>
          <button type="button" className={sonidoActivo ? 'sonido-activo' : ''} onClick={() => void alternarSonido()} aria-pressed={sonidoActivo}>
            {sonidoActivo ? <BellRing size={16} /> : <Bell size={16} />} <span>{sonidoActivo ? 'Avisos activos' : 'Activar avisos'}</span>
          </button>
          <button type="button" className={pushActivo ? 'sonido-activo' : ''} onClick={() => void alternarPush()} disabled={pushCargando} aria-pressed={pushActivo} aria-label={pushActivo ? 'Desactivar suscripción de avisos push' : 'Preparar avisos push'}>
            {pushActivo ? <BellRing size={16} /> : <Bell size={16} />} <span>{pushCargando ? 'Configurando…' : pushActivo ? 'Suscripción guardada' : 'Preparar avisos push'}</span>
          </button>
          <button type="button" onClick={() => void cargarPedidos()} disabled={cargando} aria-label="Actualizar pedidos">
            <RefreshCw size={16} className={cargando ? 'cocina-spin' : ''} /> <span>Actualizar</span>
          </button>
          <button type="button" onClick={salir} aria-label="Salir"><LogOut size={16} /><span>Salir</span></button>
        </div>
      </header>

      <section className="cocina-contenido">
        <div className="cocina-heading">
          <div>
            <span className="cocina-eyebrow"><UtensilsCrossed size={15} /> Panel de trabajo</span>
            <h1>Pedidos de cocina</h1>
            <p>Mesas y pedidos a domicilio en un solo lugar.</p>
          </div>
          <div className={`cocina-actualizacion ${error ? 'sin-conexion' : ultimaActualizacion ? 'conectado' : 'conectando'}`} role="status" aria-live="polite"><span className="cocina-live-dot" />{error ? 'Sin conexión con los pedidos' : ultimaActualizacion ? 'Conectado · actualización cada 3 segundos' : 'Conectando con los pedidos…'}{ultimaActualizacion && <small>Última: {horaPedido(ultimaActualizacion.toISOString())}</small>}</div>
        </div>

        <div className="cocina-tipo-filtros" role="group" aria-label="Filtrar por tipo de pedido">
          {([
            ['todos', `Todos (${pedidos.length})`],
            ['mesa', `Mesas (${pedidos.filter(esMesa).length})`],
            ['domicilio', `A domicilio (${pedidos.filter((pedido) => !esMesa(pedido)).length})`],
          ] as const).map(([valor, label]) => (
            <button key={valor} type="button" className={tipo === valor ? 'activo' : ''} onClick={() => setTipo(valor)}>
              {valor === 'domicilio' ? <Truck size={16} /> : valor === 'mesa' ? <UtensilsCrossed size={16} /> : <PackageCheck size={16} />}{label}
            </button>
          ))}
        </div>

        <div className="cocina-estado-filtros" role="group" aria-label="Filtrar por estado">
          {FILTROS_ESTADO.map(([valor, label]) => (
            <button key={valor} type="button" className={estado === valor ? 'activo' : ''} onClick={() => setEstado(valor)}>{label}</button>
          ))}
        </div>

        {avisoNuevo && <div className="cocina-aviso-nuevo" role="alert"><BellRing size={19} /><strong>{avisoNuevo}</strong><span>Revisa la tarjeta del pedido en la lista.</span><button type="button" onClick={() => setAvisoNuevo('')} aria-label="Cerrar aviso"><X size={17} /></button></div>}
        {pushMensaje && <div className={`cocina-error ${pushActivo ? 'cocina-info' : ''}`} role="status">{pushMensaje}</div>}
        {error && <div className="cocina-error" role="alert">{error}</div>}
        {cargando && !pedidos.length ? <div className="cocina-vacio"><RefreshCw className="cocina-spin" /> Cargando pedidos…</div> : null}
        {!cargando && !error && filtrados.length === 0 && <div className="cocina-vacio"><ChefHat size={28} /><strong>No hay pedidos en esta vista</strong><span>Los pedidos nuevos aparecerán automáticamente.</span></div>}

        <div className="cocina-lista">
          {pedidosOrdenados.map((pedido) => {
            const mesa = esMesa(pedido);
            const proxima = siguienteAccion(pedido);
            const items = articulosPedido(pedido);
            const minutos = minutosEspera(pedido.fecha);
            const nuevoSinConfirmar = pedidosNuevos.includes(pedido.id);
            return (
              <article className={`cocina-pedido cocina-pedido-${pedido.estadoCocina}${nuevoSinConfirmar ? ' cocina-pedido-nuevo' : ''}`} key={pedido.id}>
                <div className="cocina-pedido-head">
                  <div className="cocina-pedido-origen">
                    <span className={`cocina-tipo-tag ${mesa ? 'mesa' : 'domicilio'}`}>
                      {mesa ? <><UtensilsCrossed size={13} /> {pedido.mesa ? `Mesa ${pedido.mesa.replace(/^mesa\s*/i, '')}` : 'Pedido de mesa'}</> : <><Truck size={13} /> A domicilio</>}
                    </span>
                    <span className="cocina-hora"><Clock3 size={13} /> {horaPedido(pedido.fecha)}</span>
                    <span className="cocina-codigo">#{pedido.codigo}</span>
                    {nuevoSinConfirmar && <span className="cocina-nuevo-tag">Nuevo</span>}
                    {minutos !== null && <span className={`cocina-espera ${minutos >= 15 ? 'retrasado' : ''}`}><Clock3 size={13} /> {minutos} min</span>}
                  </div>
                  <span className={`cocina-estado-tag ${pedido.estadoCocina}`}>{textoEstado(pedido.estadoCocina)}</span>
                </div>

                {!mesa && <div className="cocina-cliente"><strong>{pedido.cliente || 'Cliente'}</strong>{pedido.telefono && <a href={`tel:${pedido.telefono}`}>{pedido.telefono}</a>}{pedido.direccion && <span>{pedido.direccion}</span>}</div>}
                {mesa && pedido.cliente && <div className="cocina-cliente"><strong>{pedido.cliente}</strong>{pedido.telefono && <a href={`tel:${pedido.telefono}`}>{pedido.telefono}</a>}</div>}

                <ul className="cocina-items">
                  {items.map((item) => (
                    <li key={item.key}>
                      <span className="cocina-cantidad">{item.cantidad}×</span>
                      <div><strong>{item.nombre}</strong>{item.extras.length > 0 && <small>{item.extras.join(' · ')}</small>}{item.nota && <small className="cocina-nota">Nota: {item.nota}</small>}</div>
                    </li>
                  ))}
                </ul>

                <div className="cocina-pedido-foot">
                  <div className="cocina-total"><span>Total</span><strong>{euro(pedido.total)}</strong>{pedido.estadoPago && <small>Pago: {pedido.estadoPago.replaceAll('_', ' ')}</small>}</div>
                  {proxima && <button type="button" className="cocina-accion" onClick={() => void cambiarEstado(pedido, proxima.estado)} disabled={actualizandoId === pedido.id}>
                    {actualizandoId === pedido.id ? <RefreshCw size={16} className="cocina-spin" /> : <Check size={17} />}
                    {actualizandoId === pedido.id ? 'Guardando…' : proxima.texto}
                  </button>}
                  {!proxima && <span className="cocina-finalizado"><Check size={15} /> Pedido finalizado</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default Cocina;
