import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin, Menu as MenuIcon, Moon, PartyPopper, Phone, Search, ShoppingBag, Sun, X } from 'lucide-react';
import './index.css';
import { useCart } from '@/CartContext';
import { useTheme } from '@/ThemeContext';
import { useI18n, type Idioma } from '@/I18nContext';
import CartSidebar from '@/CartSidebar';
import RuletaPremio from '@/RuletaPremio';
import ProductCard from '@/ProductCard';
import Inventario from '@/admin/Inventario';
import GestionOpciones from '@/admin/GestionOpciones';
import Cocina from '@/admin/Cocina';
import Barra from '@/admin/Barra';
import Login from '@/admin/Login';
import {
  alCambiarMenu,
  CATEGORIES,
  categoriasDe,
  getProductos,
  type Category,
  type Product,
} from '@/products';

const address = 'Pintor Antonio Padrón, 59, Las Mesas Bajas, Las Palmas de Gran Canaria';
const mapsUrl = 'https://www.google.com/maps/place/C.+Pintor+Antonio+Padr%C3%B3n,+59,+35018+Las+Mesas,+Las+Palmas/@28.0991469,-15.4976894,17z/data=!3m1!4b1!4m6!3m5!1s0xc4094784d2465e5:0x2e61ab7822fd4801!8m2!3d28.0991469!4d-15.4976894!16s%2Fg%2F11bw44jbyw?entry=ttu&g_ep=EgoyMDI2MTEwNC4wIKXMDSoASAFQAw%3D%3D';
const phone = '+34 928 896 097';
const phoneHref = 'tel:+34928896097';
const whatsapp = '34928896097';
const reviewsUrl = 'https://www.google.com/maps/place//data=!4m3!3m2!1s0xc409545c15692dd:0x541a55e1c584b7c7!12e1?source=g.page.m.ia._&laa=nmx-review-solicitation-ia2';
const instagramUrl = 'https://www.instagram.com/lasmesascafebar/';
const facebookUrl = ''; // Añadir aquí el perfil oficial cuando esté disponible.
const hours: [string, string][] = [
  ['contacto.horario.lunesViernes', '18:00–23:00'],
  ['contacto.horario.sabado', '12:00–15:00 · 18:00–23:00'],
  ['contacto.horario.domingo', '12:00–17:00'],
];
const HORARIO_SEMANAL: [number, number][][] = [
  [[18 * 60, 23 * 60]], [[18 * 60, 23 * 60]], [[18 * 60, 23 * 60]],
  [[18 * 60, 23 * 60]], [[18 * 60, 23 * 60]], [[12 * 60, 15 * 60], [18 * 60, 23 * 60]],
  [[12 * 60, 17 * 60]],
];
const DIAS_SEMANA = ['contacto.dia.lunes', 'contacto.dia.martes', 'contacto.dia.miercoles', 'contacto.dia.jueves', 'contacto.dia.viernes', 'contacto.dia.sabado', 'contacto.dia.domingo'];

type EstadoHorario =
  | { abierto: true; cierre: number; dia: number }
  | { abierto: false; apertura: number; dia: number; hoy: boolean };

function obtenerEstadoHorario(fecha: Date): EstadoHorario {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Atlantic/Canary', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const indiceDia = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[values.weekday] ?? 0;
  const minutosAhora = Number(values.hour) * 60 + Number(values.minute);
  for (const [inicio, fin] of HORARIO_SEMANAL[indiceDia]) {
    if (minutosAhora >= inicio && minutosAhora < fin) return { abierto: true, cierre: fin, dia: indiceDia };
  }
  for (let desplazamiento = 0; desplazamiento < 7; desplazamiento++) {
    const dia = (indiceDia + desplazamiento) % 7;
    const proxima = HORARIO_SEMANAL[dia].find(([inicio]) => desplazamiento > 0 || inicio > minutosAhora);
    if (proxima) return { abierto: false, apertura: proxima[0], dia, hoy: desplazamiento === 0 };
  }
  return { abierto: false, apertura: 18 * 60, dia: 0, hoy: false };
}

function horaDeMinutos(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function formatLocalDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function timesBetween(startHour: number, endHour: number) {
  return Array.from({ length: (endHour - startHour) * 2 }, (_, index) => {
    const hour = startHour + Math.floor(index / 2);
    const minute = index % 2 === 0 ? '00' : '30';
    return `${String(hour).padStart(2, '0')}:${minute}`;
  });
}

function timesForDate(date: string) {
  if (!date) return [];
  const day = new Date(`${date}T12:00:00`).getDay();
  if (day === 0) return timesBetween(12, 17);
  if (day === 6) return [...timesBetween(12, 15), ...timesBetween(18, 23)];
  return timesBetween(18, 23);
}

// Estado del aviso de pedido (confirmación o cancelación tras el pago).
type AvisoPedido =
  | { tipo: 'confirmado'; idPedido: string; codigo: string; total: string; articulos: { name: string; qty: number }[]; mesa?: string }
  | { tipo: 'cancelado' }
  | { tipo: 'error'; mensaje: string }
  | null;

function App() {
  const [horaActual, setHoraActual] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setHoraActual(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [activeSlug, setActiveSlug] = useState(CATEGORIES[0].slug);
  const [productos, setProductos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Category[]>(CATEGORIES);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reservationStatus, setReservationStatus] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [enviandoCelebracion, setEnviandoCelebracion] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  // Menú móvil: Escape, clic fuera y bloqueo de scroll del fondo.
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const anteriorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.body.style.overflow = anteriorOverflow;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [mobileOpen]);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [busquedaCarta, setBusquedaCarta] = useState('');
  const [avisoPedido, setAvisoPedido] = useState<AvisoPedido>(null);
  const [location, navegar] = useLocation();
  const mesaQuery = new URLSearchParams(window.location.search).get('mesa');
  const mesaActual = mesaQuery && Number.isInteger(Number(mesaQuery)) && Number(mesaQuery) >= 1 && Number(mesaQuery) <= 9
    ? String(Number(mesaQuery))
    : '';
  const rutaActual = location.replace(/\/+$/, '').toLowerCase();
  const esInicio = rutaActual === '' || rutaActual === '/';
  const esRutaLogin = rutaActual === '/login';
  const esRutaOpciones = rutaActual === '/admin/opciones';
  const esRutaCocina = rutaActual === '/admin/cocina';
  const esRutaBarra = rutaActual === '/admin/barra';
  const esRutaAdmin = rutaActual.startsWith('/admin');
  const [productosVisibles, setProductosVisibles] = useState(12);
  const { cart, addToCart, clearCart } = useCart();
  const { tema, alternarTema } = useTheme();
  const { idioma, cambiarIdioma, t } = useI18n();
  const estadoHorario = useMemo(() => obtenerEstadoHorario(horaActual), [horaActual]);
  const textoEstadoHorario = estadoHorario.abierto
    ? `${t('contacto.estado.abierto')} · ${t('contacto.estado.cierra').replace('{hora}', horaDeMinutos(estadoHorario.cierre))}`
    : `${t('contacto.estado.cerrado')} · ${estadoHorario.hoy
      ? t('contacto.estado.abreHoy').replace('{hora}', horaDeMinutos(estadoHorario.apertura))
      : t('contacto.estado.proxima').replace('{dia}', t(DIAS_SEMANA[estadoHorario.dia])).replace('{hora}', horaDeMinutos(estadoHorario.apertura))}`;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeCategory = categorias.find((c) => c.slug === activeSlug) ?? categorias[0];
  const productosActivos = productos.filter((p) => p.category_slug === activeCategory.slug);
  const textoBusqueda = busquedaCarta.trim().toLocaleLowerCase('es');
  const productosFiltrados = textoBusqueda
    ? productosActivos.filter((p) => `${p.name} ${p.description ?? ''}`.toLocaleLowerCase('es').includes(textoBusqueda))
    : productosActivos;
  useEffect(() => { setProductosVisibles(12); }, [activeSlug, busquedaCarta]);

  // Cargar la carta desde la API (lee Neon: ids, precios y disponibilidad).
  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      const todos = await getProductos();
      if (!vigente) return;
      setProductos(todos);
    };
    void cargar();
    // Si desde el panel de inventario se marca un producto como agotado, la
    // carta se refresca sola en esta pestaña.
    const pararEscucha = alCambiarMenu(() => void cargar());

    // La carta se refresca sola cada minuto: asi un cliente que tiene la
    // carta abierta ve al instante que un producto se ha agotado, este en el
    // movil que sea. (Tambien se refresca al instante si el panel de
    // inventario esta abierto en este mismo navegador.)
    const refresco = window.setInterval(() => void cargar(), 60000);

    return () => {
      vigente = false;
      pararEscucha();
      window.clearInterval(refresco);
    };
  }, []);

  // Categorias derivadas del catalogo de productos.
  useEffect(() => {
    const cats = categoriasDe(productos);
    if (cats.length) {
      setCategorias(cats);
      setActiveSlug((previo) =>
        cats.some((c) => c.slug === previo) ? previo : cats[0].slug,
      );
    }
  }, [productos]);
  const reservationTimes = timesForDate(reservationDate);
  const minDate = formatLocalDate(new Date());

  useEffect(() => {
    const onScroll = () => setCompactHeader(window.scrollY > 36);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Tras volver de Stripe comprobamos el pago y confirmamos el pedido.
  // El ref evita que este efecto se repita en cada render: clearCart cambia de
  // identidad en cada render y lo usaba como dependencia, lo que vaciaba el
  // carrito y hacia que el pedido se enviara con total 0 e items vacios.
  const confirmacionHecha = useRef(false);
  useEffect(() => {
    if (confirmacionHecha.current) return;
    confirmacionHecha.current = true;
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('pedido');
    const sessionId = params.get('session_id');
    const codigo = params.get('codigo') ?? '';
    // Conservar la mesa del QR al limpiar la URL tras pagar/cancelar, para que
    // el cliente siga en la misma mesa y pueda pedir más sin escanear de nuevo.
    const mesaParam = params.get('mesa');
    const urlLimpia = () => {
      const limpia = new URLSearchParams();
      if (mesaParam) limpia.set('mesa', mesaParam);
      const query = limpia.toString();
      return window.location.pathname + (query ? '?' + query : '');
    };

    if (estado === 'cancelado') {
      setAvisoPedido({ tipo: 'cancelado' });
      window.history.replaceState({}, '', urlLimpia() + '#carta');
      return;
    }
    if (estado !== 'ok') return;

    // Flujo con n8n: vuelve de Stripe con ?pedido=ok&codigo=ABC123 y no hay
    // session_id que consultar. Se da por pagado y se muestra el codigo.
    if (!sessionId) {
      setAvisoPedido({
        tipo: 'confirmado',
        idPedido: '',
        codigo,
        total: '',
        articulos: [],
        mesa: mesaParam ?? undefined,
      });
      clearCart();
      window.history.replaceState({}, '', urlLimpia());
      return;
    }

    let vigente = true;
    (async () => {
      try {
        const respuesta = await fetch(`/api/pedido?session_id=${encodeURIComponent(sessionId)}`);
        const datos = await respuesta.json();
        if (!vigente) return;
        if (!respuesta.ok || !datos.pagado) {
          setAvisoPedido({ tipo: 'error', mensaje: datos?.error ?? 'No hemos podido confirmar el pago.' });
        } else {
          setAvisoPedido({
            tipo: 'confirmado',
            idPedido: String(datos.idPedido ?? '').slice(-8).toUpperCase(),
            codigo,
            total: datos.total ?? '',
            articulos: Array.isArray(datos.articulos)
              ? datos.articulos.map((a: { name: string; qty: number }) => ({ name: a.name, qty: a.qty }))
              : [],
            mesa: mesaParam ?? undefined,
          });
        }
        clearCart();
      } catch {
        if (vigente) setAvisoPedido({ tipo: 'error', mensaje: 'No hemos podido confirmar el pago.' });
      }
    })();

    window.history.replaceState({}, '', urlLimpia());
    return () => {
      vigente = false;
    };
  }, []);

  /**
   * Envia la solicitud de celebracion al flujo de n8n, que la guarda en la
   * tabla solicitudes_celebracion de Neon.
   */
  async function enviarCelebracion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const data = new FormData(formulario);

    setEnviandoCelebracion(true);
    setEventStatus('');

    try {
      const respuesta = await fetch('/api/solicitud-celebracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: String(data.get('eventName') ?? ''),
          contacto: String(data.get('eventContact') ?? ''),
          tipoEvento: String(data.get('type') ?? ''),
          fechaAproximada: String(data.get('eventDate') ?? ''),
          numeroPersonas: Number(data.get('eventPeople') ?? 0),
          detalles: String(data.get('details') ?? ''),
        }),
      });

      const texto = await respuesta.text();
      let datos: any = null;
      try {
        datos = JSON.parse(texto);
      } catch {
        /* respuesta no json */
      }

      if (!respuesta.ok) {
        setEventStatus(
          datos?.error ?? 'No hemos podido enviar la solicitud. Inténtalo de nuevo.',
        );
        return;
      }

      setEventStatus('Solicitud enviada correctamente');
      formulario.reset();
    } catch {
      setEventStatus(
        'No hemos podido enviar la solicitud. Inténtalo de nuevo o llámanos al ' +
          '+34 928 896 097.',
      );
    } finally {
      setEnviandoCelebracion(false);
    }
  }

  function sendWhatsApp(event: FormEvent<HTMLFormElement>, kind: 'reserva' | 'evento') {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const lines = kind === 'reserva'
      ? [`Solicitud de reserva — Pizzeria Las Mesas`, `Nombre: ${data.get('name')}`, `Contacto: ${data.get('contact')}`, `Fecha: ${data.get('date')}`, `Hora: ${data.get('time')}`, `Personas: ${data.get('people')}`, `Comentarios: ${data.get('comments') || 'Sin comentarios'}`]
      : [`Consulta de evento — Pizzeria Las Mesas`, `Nombre: ${data.get('eventName')}`, `Contacto: ${data.get('eventContact')}`, `Tipo de evento: ${data.get('type')}`, `Fecha aproximada: ${data.get('eventDate')}`, `Personas: ${data.get('eventPeople')}`, `Detalles: ${data.get('details')}`];
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
    const message = 'Se ha preparado tu mensaje de WhatsApp. Revísalo y pulsa «Enviar» para hacernos llegar la solicitud. No es una reserva confirmada.';
    kind === 'reserva' ? setReservationStatus(message) : setEventStatus(message);
  }

  if (esRutaLogin) return <Login />;
  if (esRutaCocina) return <Cocina />;
  if (esRutaBarra) return <Barra />;
  if (esRutaOpciones) return <GestionOpciones />;
  if (esRutaAdmin) return <Inventario />;


  // ===== Portada compacta: pedir, reservar, celebrar y llegar =====
  const paginaInicio = (
    <section className="home-hero home-compact" aria-labelledby="home-title">
      <div className="home-hero-bg" aria-hidden="true" />
      <div className="home-hero-overlay" aria-hidden="true" />
      <div className="shell home-hero-content">
        <p className="eyebrow"><span className="gold-dot" /> Pizzeria Las Mesas · Gran Canaria</p>
        <h1 className="home-hero-title" id="home-title">{t('home.hero.titulo1')}<br /><em>{t('home.hero.titulo2')}</em></h1>
        <p className="home-hero-desc">{t('home.hero.desc2')}</p>

        <div className="home-actions-grid" aria-label={t('home.acceso.titulo')}>
          <Link className="home-action-card home-action-primary" href={mesaActual ? `/carta?mesa=${encodeURIComponent(mesaActual)}` : '/carta'} data-testid="link-pedir-inicio">
            <span className="home-action-icon"><ShoppingBag size={21} aria-hidden="true" /></span>
            <span className="home-action-copy"><strong>{mesaActual ? `${t('home.hero.pedirMesa')} ${mesaActual}` : t('home.acceso.pedir')}</strong><small>{t('home.acceso.pedir.desc')}</small></span>
            <ArrowRight className="home-action-arrow" size={19} aria-hidden="true" />
          </Link>
          <Link className="home-action-card" href="/reservas" data-testid="link-reservar-inicio">
            <span className="home-action-icon"><CalendarDays size={21} aria-hidden="true" /></span>
            <span className="home-action-copy"><strong>{t('home.acceso.reserva')}</strong><small>{t('home.acceso.reserva.desc')}</small></span>
            <ArrowRight className="home-action-arrow" size={19} aria-hidden="true" />
          </Link>
          <Link className="home-action-card" href="/celebraciones" data-testid="link-celebraciones-inicio">
            <span className="home-action-icon"><PartyPopper size={21} aria-hidden="true" /></span>
            <span className="home-action-copy"><strong>{t('home.acceso.celebraciones')}</strong><small>{t('home.acceso.celebraciones.desc')}</small></span>
            <ArrowRight className="home-action-arrow" size={19} aria-hidden="true" />
          </Link>
          <a className="home-action-card" href={mapsUrl} target="_blank" rel="noreferrer" data-testid="link-como-llegar-inicio">
            <span className="home-action-icon"><MapPin size={21} aria-hidden="true" /></span>
            <span className="home-action-copy"><strong>{t('home.acceso.llegar')}</strong><small>{t('home.acceso.llegar.desc')}</small></span>
            <ArrowUpRight className="home-action-arrow" size={19} aria-hidden="true" />
          </a>
        </div>

        <div className="home-info-strip">
          <div className="home-info-hours"><span className={`home-open-dot ${estadoHorario.abierto ? 'is-open' : ''}`} aria-hidden="true" /><span>{textoEstadoHorario}</span><Link href="/local#horario">{t('home.acceso.horarioCompleto')}</Link></div>
          <a className="home-info-phone" href={phoneHref}><Phone size={17} aria-hidden="true" /><span>{phone}</span></a>
        </div>
        <Link className="home-about-link" href="/local">{t('home.acceso.conocenos')} <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  );

  const paginaCarta = (
    <>
      <section className="menu-section section-pad" id="carta">
        <div className="shell">
          <div className="menu-heading"><div><p className="eyebrow"><span className="gold-dot" /> {t('carta.titulo')}</p><h2>{t('carta.titulo')}<span>.</span></h2><p className="section-lede">{t('carta.desc')}</p></div><a className="button button-outline" href="/assets/carta-las-mesas.pdf" download="carta-las-mesas.pdf" data-testid="link-download-menu">{t('carta.descargar')} <ArrowDown size={16} /></a></div>
          <div className="menu-experience">
            <div
              className="category-list overflow-x-auto whitespace-nowrap px-4 min-w-0"
              role="tablist"
              aria-label="Categorías de la carta"
              aria-orientation="vertical"
            >
              {categorias.map((category, index) => <button key={category.slug} className={activeCategory.slug === category.slug ? 'category-tab active' : 'category-tab'} role="tab" tabIndex={activeCategory.slug === category.slug ? 0 : -1} id={`tab-${index}`} aria-selected={activeCategory.slug === category.slug} aria-controls="menu-panel" onClick={() => setActiveSlug(category.slug)} onKeyDown={(e) => { const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (index + 1) % categorias.length : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (index - 1 + categorias.length) % categorias.length : -1; if (next >= 0) { e.preventDefault(); document.getElementById(`tab-${next}`)?.focus(); setActiveSlug(categorias[next].slug); } }} data-testid={`tab-category-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{category.name}<ArrowRight size={14} /></button>)}
              <p className="menu-download-note">{t('carta.download')}</p>
            </div>
            <div className="menu-panel" role="tabpanel" id="menu-panel" aria-labelledby={`tab-${categorias.findIndex((c) => c.slug === activeCategory.slug)}`} key={activeCategory.slug}>
              <div className="panel-title"><div><span className="eyebrow">{t('carta.enMesa')}</span><h3>{activeCategory.name}</h3></div><span className="dish-count" aria-live="polite">{productosFiltrados.length} {textoBusqueda ? t(productosFiltrados.length === 1 ? 'carta.resultado' : 'carta.resultados') : t(productosFiltrados.length === 1 ? 'carta.producto' : 'carta.productos')}</span></div>
              <div className="carta-busqueda-wrap">
                <label className="carta-busqueda">
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={busquedaCarta}
                    onChange={(event) => setBusquedaCarta(event.target.value)}
                    placeholder={t('carta.buscar')}
                    aria-label={t('carta.buscarAria')}
                    data-testid="input-buscar-carta"
                  />
                  {busquedaCarta && <button type="button" onClick={() => setBusquedaCarta('')} aria-label={t('carta.borrarBusqueda')}>×</button>}
                </label>
              </div>
              <div className="dish-list dish-grid grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {productosFiltrados.slice(0, productosVisibles).map((producto) => (
                  <ProductCard
                    key={producto.id}
                    product={producto}
                    onAddToCart={(product) => {
                      addToCart({
                        id: String(product.id || product.name),
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        opciones: product.opciones ?? [],
                        nota: product.nota ?? '',
                      });
                      setCartOpen(true);
                    }}
                    showSizeSelector={false}
                  />
                ))}
                {productosFiltrados.length === 0 && (
                  <div className="carta-sin-resultados">
                    <strong>{t('carta.noEncontrado')}</strong>
                    <span>{t('carta.pruebaBusqueda')}</span>
                    {busquedaCarta && <button type="button" onClick={() => setBusquedaCarta('')}>{t('carta.verCategoria')}</button>}
                  </div>
                )}
              </div>

              {productosFiltrados.length > productosVisibles && (
                <div className="carta-mas-wrap">
                  <button
                    type="button"
                    className="button button-outline carta-mas"
                    onClick={() => setProductosVisibles((n) => n + 12)}
                    data-testid="button-cargar-mas"
                  >
                    Ver más ({productosFiltrados.length - productosVisibles} restantes) <ArrowDown size={16} />
                  </button>
                </div>
              )}
              <p className="allergen-note"><b>{t('carta.alergenos.texto')}</b> · G = gluten · H = huevo · L = lácteos · P = pescado · CR = crustáceos · MO = moluscos · S = sulfitos · MZ = mostaza.<br />Información orientativa. Si tienes alergia o intolerancia, avísanos para confirmar los ingredientes.</p>
              {activeCategory.slug === 'bocadillos-calientes' && <p className="allergen-note">{t('carta.bocadillos')}</p>}
              <p className="allergen-note">{t('carta.asteriscos')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const paginaLocal = (
    <>
      <section className="essence section-pad" id="esencia" aria-labelledby="esencia-title">
        <div className="shell essence-grid">
          <div className="section-index">01 <span>— LA CASA</span></div>
          <div className="essence-title"><p className="eyebrow">{t('casa.titulo')}</p><h2 id="esencia-title">{t('local.volver.cena')}<br /><em>{t('local.quedate')}</em></h2></div>
          <div className="essence-text"><p>{t('local.esencia.p1')}</p><p>{t('local.esencia.p2')}</p><a className="text-link dark-link" href="#contacto">{t('local.contacto')} <ArrowRight size={15} /></a></div>
        </div>
      </section>
      <section className="gallery-section section-pad" id="local-galeria" aria-labelledby="gallery-title">
        <div className="shell">
          <div className="gallery-heading">
            <div><p className="eyebrow"><span className="gold-dot" /> Una mesa para cada plan</p><h2 id="gallery-title">{t('home.galeria.titulo')}<span>.</span></h2></div>
            <p>{t('home.galeria.desc')}</p>
          </div>
          <div className="gallery-grid">
            <figure className="gallery-card gallery-card-tall">
              <img src="/assets/local-billar-1.webp" alt="Mesa de billar y mesas del comedor de Las Mesas" width="896" height="1195" loading="lazy" decoding="async" />
              <figcaption><span>{t('casa.billar')}</span><small>{t('home.galeria.billar')}</small></figcaption>
            </figure>
            <figure className="gallery-card">
              <img src="/assets/platos-compartir.jpg" alt="Selección fotografiada de platos para compartir de la carta" width="550" height="440" loading="lazy" decoding="async" />
              <figcaption><span>{t('casa.compartir')}</span><small>Platos de la carta</small></figcaption>
            </figure>
            </div>
          <p className="gallery-note">{t('home.galeria.desc')}</p>
          <div className="house-note"><span className="note-mark">LM</span><p>«La mejor jugada<br />{t('cita.sub')}»</p><span className="note-rule" /><span className="eyebrow">Las Mesas · Gran Canaria</span></div>
        </div>
      </section>
      <section className="contact-section section-pad" id="contacto" aria-labelledby="contacto-title">
        <div className="shell">
          <div className="contact-heading"><div><p className="eyebrow"><span className="gold-dot" /> {t('contacto.titulo')}</p><h2 id="contacto-title">{t('contacto.ven')}<span>.</span></h2><p className="contact-lede">{t('contacto.intro')}</p></div><a className="button button-outline" href={mapsUrl} target="_blank" rel="noreferrer" data-testid="link-maps">{t('contacto.comoLlegar')} <ArrowUpRight size={16} /></a></div>
          <div className="contact-grid">
            <div className="address-block"><MapPin size={21} aria-hidden="true" /><span className="eyebrow">{t('contacto.direccion')}</span><address className="break-words">{address}</address></div>
            <div className="hours-block" id="horario" aria-labelledby="horario-title"><Clock3 size={21} aria-hidden="true" /><h3 className="eyebrow" id="horario-title">{t('contacto.horario')}</h3><dl className="hours-list">{hours.map(([day, time]) => <div className="hours-row" key={day}><dt>{t(day)}</dt><dd>{time}</dd></div>)}</dl><p className={`hours-status ${estadoHorario.abierto ? 'is-open' : 'is-closed'}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" />{textoEstadoHorario}</p></div>
            <div className="phone-block"><Phone size={21} aria-hidden="true" /><span className="eyebrow">{t('contacto.llamanos')}</span><a href={phoneHref} data-testid="link-call-footer">{phone}</a><p>{t('contacto.llamamos.desc')}</p></div>
          </div>
          {/* La URL de las reseñas NO se imprime: se muestra como enlace para
              que no aparezca el texto gigante que rompía el móvil. */}
          {(instagramUrl || reviewsUrl) && <div className="social-editable">
            <span className="eyebrow">{t('contacto.social')}</span>
            <p>{t('contacto.redes')}</p>
            {instagramUrl && <span className="min-w-0 break-words">
              {t('contacto.instagram')}: {' '}
              <a href={instagramUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a>
            </span>}
            {facebookUrl && <span className="min-w-0 break-words">
              {t('contacto.facebook')}: <a href={facebookUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a>
            </span>}
            {reviewsUrl && <span className="min-w-0 break-words">
              {t('contacto.googleResenas')}: {' '}
              <a href={reviewsUrl} target="_blank" rel="noreferrer">{t('contacto.compartir')}</a>
            </span>}
          </div>}
        </div>
      </section>
    </>
  );

  const paginaCelebraciones = (
    <>
      <section className="celebration section-pad" id="celebraciones">
        <div className="shell celebration-grid">
          <div className="celebration-copy"><p className="eyebrow"><span className="gold-dot" /> Un motivo para juntarse</p><h2>{t('celebrar.titulo2')}<br /><em>{t('celebrar.titulo3')}</em></h2><p>{t('celebrar.desc')}</p><div className="celebration-tags"><span>{t('form.cumple')}</span><span>Cenas de empresa</span><span>Otros encuentros</span></div></div>
          <form className="form-card event-form" onSubmit={(e) => void enviarCelebracion(e)}>
            <span className="eyebrow">{t('celebrar.boton')}</span><h3>{t('celebrar.submit')}</h3>
            <div className="field-grid">
              <label>{t('form.nombre')}<input name="eventName" required autoComplete="name" placeholder={t('form.nombre.ph')} data-testid="input-event-name" /></label>
              <label>{t('form.contacto')}<input name="eventContact" required autoComplete="email" pattern="(?:[^@ ]+@[^@ ]+\\.[^@ ]+|\\+?[0-9][0-9 \\-]{6,})" title={t('form.contacto.title')} placeholder={t('form.contacto.ph')} data-testid="input-event-contact" /></label>
              <label>{t('form.tipoEvento')}<select name="type" defaultValue="" required data-testid="select-event-type"><option value="" disabled>{t('form.elige')}</option><option>{t('form.cumple')}</option><option>{t('form.cenaEmpresa')}</option><option>{t('form.otro')}</option></select></label>
              <label>{t('form.fecha')}<input type="date" name="eventDate" min={minDate} required data-testid="input-event-date" /></label>
              <label>{t('form.personas')}<input type="number" min="1" max="100" name="eventPeople" required placeholder={t('form.personas.ph')} data-testid="input-event-people" /></label>
              <label className="full-field">{t('form.detalles')}<textarea name="details" required rows={3} placeholder={t('form.detalles.ph')} data-testid="input-event-details" /></label>
            </div>
            <button className="button button-gold form-submit" type="submit" disabled={enviandoCelebracion} data-testid="button-event-submit">
              {enviandoCelebracion ? 'Enviando…' : 'Enviar solicitud'}
              <ArrowRight size={16} />
            </button>
            <p className="form-disclaimer">{t('form.celebrar.desc')}</p>
            {eventStatus && <p className="form-status" role="status" data-testid="status-event">{eventStatus}</p>}
          </form>
        </div>
      </section>
    </>
  );

  const paginaReservas = (
    <>
      <section className="reservation section-pad" id="reserva">
        <div className="shell reservation-grid">
          <div className="reservation-intro"><p className="eyebrow">{t('reserva.titulo1')}</p><h2>{t('reserva.titulo2')}<br /><em>{t('reserva.titulo3')}</em></h2><p>Cuéntanos cuándo vienes y cuántos sois. Te enviaremos la solicitud por WhatsApp para que puedas confirmarla con el equipo.</p><div className="direct-call"><span>{t('reserva.prefieres')}</span><a href={phoneHref} data-testid="link-call-reservation"><Phone size={16} /> {phone}</a></div></div>
          <form className="form-card reservation-form" onSubmit={(e) => sendWhatsApp(e, 'reserva')}>
            <span className="eyebrow">{t('reserva.submit')}</span>
            <div className="field-grid">
              <label>{t('form.nombre')}<input name="name" required autoComplete="name" placeholder={t('form.nombre.ph')} data-testid="input-reservation-name" /></label>
              <label>{t('form.contacto')}<input name="contact" required autoComplete="email" pattern="(?:[^@ ]+@[^@ ]+\\.[^@ ]+|\\+?[0-9][0-9 \\-]{6,})" title="Introduce un teléfono válido o un correo electrónico." placeholder={t('form.nombre.ph')} data-testid="input-reservation-contact" /></label>
              <label>{t('form.fechaReserva')}<input type="date" name="date" min={minDate} required value={reservationDate} onChange={(event) => { setReservationDate(event.target.value); setReservationTime(''); }} data-testid="input-reservation-date" /></label>
              <label>{t('form.hora')}<select name="time" required value={reservationTime} onChange={(event) => setReservationTime(event.target.value)} disabled={!reservationDate} data-testid="select-reservation-time"><option value="" disabled>{reservationDate ? 'Elige una hora' : 'Elige primero una fecha'}</option>{reservationTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
              <label>{t('form.personas')}<input type="number" min="1" max="20" name="people" required placeholder="Ej. 4" data-testid="input-reservation-people" /></label>
              <label className="full-field">{t('form.comentarios')} <span className="optional">{t('form.opcional')}</span><textarea name="comments" rows={2} placeholder={t('form.comentarios.ph')} data-testid="input-reservation-comments" /></label>
            </div>
            <button className="button button-gold form-submit" type="submit" data-testid="button-reservation-submit">{t('reserva.preparar')} <ArrowRight size={16} /></button>
            <p className="form-disclaimer">{t('form.reserva.desc')}</p>
            {reservationStatus && <p className="form-status" role="status" data-testid="status-reservation">{reservationStatus}</p>}
          </form>
        </div>
      </section>
    </>
  );

  return (
    <>
      <a className="skip-link" href="#contenido-principal">{t('accesibilidad.saltar')}</a>
      {avisoPedido && (
        <div className={`pedido-aviso pedido-aviso-${avisoPedido.tipo}`} role="status" data-testid="pedido-aviso">
          <div className="pedido-aviso-inner">
            {avisoPedido.tipo === 'confirmado' && (
              <>
                <span className="pedido-aviso-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>{t('pedido.confirmado')}</strong>
                  <p>
                    {avisoPedido.mesa
                      ? `Tu pedido para la mesa ${avisoPedido.mesa} está confirmado.`
                      : 'Te hemos enviado la confirmación por correo.'}
                    {avisoPedido.codigo && <>{' '}{t('pedido.codigo')} <b>{avisoPedido.codigo}</b>.</>}
                    {avisoPedido.idPedido && <>{' '}{t('pedido.referencia')} <b>{avisoPedido.idPedido}</b>.</>}
                    {avisoPedido.total && <>{' '}{t('pedido.total')} <b>{avisoPedido.total} €</b>.</>}
                    {avisoPedido.articulos.length > 0 && (
                      <> {' '}{avisoPedido.articulos.map((a) => `${a.qty} × ${a.name}`).join(', ')}.</>
                    )}
                  </p>
                </div>
                <button type="button" onClick={() => setAvisoPedido(null)} aria-label="Cerrar aviso">×</button>
              </>
            )}
            {avisoPedido.tipo === 'cancelado' && (
              <>
                <span className="pedido-aviso-icon" aria-hidden="true">!</span>
                <div>
                  <strong>{t('pedido.cancelado')}</strong>
                  <p>{t('pedido.cancelado2')}</p>
                </div>
                <button type="button" onClick={() => setAvisoPedido(null)} aria-label="Cerrar aviso">×</button>
              </>
            )}
            {avisoPedido.tipo === 'error' && (
              <>
                <span className="pedido-aviso-icon" aria-hidden="true">!</span>
                <div>
                  <strong>{t('pedido.error')}</strong>
                  <p>{avisoPedido.mensaje} Si se ha realizado el cargo, escríbenos y lo revisamos.</p>
                </div>
                <button type="button" onClick={() => setAvisoPedido(null)} aria-label="Cerrar aviso">×</button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="topline"><span>Pizzeria Las Mesas · Gran Canaria</span><span>{t('home.hero.desc2')}</span><a href={phoneHref} data-testid="link-call-top">{phone}</a></div>
      <div className="site-topbar">
      <header className={compactHeader ? 'site-header compact' : 'site-header'}>
        <a href="/" className="brand" aria-label="Pizzeria Las Mesas, inicio" onClick={() => setMobileOpen(false)}>
          <img className="logo-3d" src="/images/logo.png" alt="Logo de Pizzeria Las Mesas" />
        </a>

        {!esInicio && <button
          type="button"
          className={mobileOpen ? 'mobile-toggle is-open' : 'mobile-toggle'}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
          aria-controls="menu-principal"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          <span className="hamb-linea" /><span className="hamb-linea" /><span className="hamb-linea" />
        </button>}


        <div className="header-controles">
          <div className="lang-toggle" role="group" aria-label="Idioma / Language / Langue">
            {([['es','🇪🇸'],['en','🇬🇧'],['fr','🇫🇷'],['de','🇩🇪']] as Array<[Idioma,string]>).map(([cod, bandera]) => (
              <button key={cod} type="button" className={idioma === cod ? 'lang-btn is-active' : 'lang-btn'} onClick={() => cambiarIdioma(cod)} aria-label={'Idioma: ' + cod.toUpperCase()} aria-pressed={idioma === cod} data-testid={'button-lang-' + cod}>
                {bandera}
              </button>
            ))}
          </div>
          <button className="theme-toggle" onClick={alternarTema} aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'} data-testid="button-theme">
            {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="cart-toggle" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito${cartCount ? `, ${cartCount} artículos` : ''}`} data-testid="button-cart">
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

        {!esInicio && <nav id="menu-principal" ref={menuRef} className={mobileOpen ? 'main-nav open' : 'main-nav'} aria-label="Navegación principal">
          <div className="nav-cabecera-movil">
            <img className="logo-3d" src="/images/logo.png" alt="" />
            <strong>Pizzeria Las Mesas</strong>
            <button type="button" className="nav-cerrar" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>×</button>
          </div>
          <ul className="nav-lista">
            <li><Link href="/" className={location === '/' ? 'nav-link activo' : 'nav-link'} aria-current={location === '/' ? 'page' : 'false'} onClick={() => setMobileOpen(false)} data-testid="nav-inicio">{t('nav.inicio')}<span className="nav-subrayado" /></Link></li>
            <li><Link href="/carta" className={location === '/carta' ? 'nav-link activo' : 'nav-link'} aria-current={location === '/carta' ? 'page' : 'false'} onClick={() => setMobileOpen(false)} data-testid="nav-carta">{t('nav.carta2')}<span className="nav-subrayado" /></Link></li>
            <li><Link href="/local" className={location === '/local' ? 'nav-link activo' : 'nav-link'} aria-current={location === '/local' ? 'page' : 'false'} onClick={() => setMobileOpen(false)} data-testid="nav-nosotros">{t('nav.nosotros')}<span className="nav-subrayado" /></Link></li>
            <li><Link href="/local#horario" className={location === '/local#horario' ? 'nav-link activo' : 'nav-link'} aria-current={location === '/local#horario' ? 'page' : 'false'} onClick={() => setMobileOpen(false)} data-testid="nav-horario">{t('nav.horario')}<span className="nav-subrayado" /></Link></li>
            <li><Link href="/local#contacto" className={location === '/local#contacto' ? 'nav-link activo' : 'nav-link'} aria-current={location === '/local#contacto' ? 'page' : 'false'} onClick={() => setMobileOpen(false)} data-testid="nav-contacto">{t('nav.contacto')}<span className="nav-subrayado" /></Link></li>
          </ul>
          <Link className="nav-cta" href="/reservas" onClick={() => setMobileOpen(false)}>{t('nav.reserva')} <ArrowUpRight size={15} /></Link>
          <div className="nav-controles-inferiores">
            <div className="lang-toggle" role="group" aria-label="Idioma / Language / Langue">
              {([['es','🇪🇸'],['en','🇬🇧'],['fr','🇫🇷'],['de','🇩🇪']] as Array<[Idioma,string]>).map(([cod, bandera]) => (
                <button key={'menu-' + cod} type="button" className={idioma === cod ? 'lang-btn is-active' : 'lang-btn'} onClick={() => cambiarIdioma(cod)} aria-label={'Idioma: ' + cod.toUpperCase()} aria-pressed={idioma === cod}>
                  {bandera}
                </button>
              ))}
            </div>
            <button className="theme-toggle" onClick={alternarTema} aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
              {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </nav>}
      </div>

      <main id="contenido-principal" tabIndex={-1}>
      <Switch>
        <Route path="/">{paginaInicio}</Route>
        <Route path="/carta">{paginaCarta}</Route>
        <Route path="/local">{paginaLocal}</Route>
        <Route path="/celebraciones">{paginaCelebraciones}</Route>
        <Route path="/reservas">{paginaReservas}</Route>
        <Route>{paginaInicio}</Route>
      </Switch>
      </main>

      <footer className="site-footer">
        <div className="shell footer-main"><a href="/" className="footer-brand"><img src="/assets/logo-las-mesas.jpeg" alt="" /><span>Pizzeria Las Mesas</span></a><p>{t('footer.lema')}</p><nav aria-label="Navegación de pie">{[[t('nav.casa'),'/local#esencia'],[t('nav.local'),'/local#local-galeria'],[t('nav.carta'),'/carta'],[t('nav.celebraciones'),'/celebraciones'],[t('nav.reserva'),'/reservas']].map(([label,href]) => <a key={href} href={href}>{label}</a>)}</nav></div>
        <div className="shell footer-details">
          <div className="footer-hours"><span className="footer-label">{t('contacto.horario')}</span>{hours.map(([day, time]) => <p key={day}><span>{t(day)}</span><strong>{time}</strong></p>)}</div>
          <div className="footer-contact"><span className="footer-label">{t('nav.contacto')}</span><a href={phoneHref}>{phone}</a><a href={mapsUrl} target="_blank" rel="noreferrer">Pintor Antonio Padrón, 59 · {t('contacto.comoLlegar')}</a></div>
          <div className="footer-social min-w-0"><span className="footer-label">{t('contacto.social')}</span>{instagramUrl && <span>{t('contacto.instagram')}: <a href={instagramUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a></span>}{facebookUrl && <span>{t('contacto.facebook')}: <a href={facebookUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a></span>}{reviewsUrl && <span>{t('contacto.googleResenas')}: <a href={reviewsUrl} target="_blank" rel="noreferrer">{t('contacto.compartir')}</a></span>}</div>
        </div>
        <div className="shell footer-bottom"><span>© Pizzeria Las Mesas</span><span>Pintor Antonio Padrón, 59 · Las Mesas Bajas · Las Palmas de Gran Canaria</span></div>
        <div className="shell"><p style={{ fontSize: '.7rem', opacity: .75, lineHeight: 1.6, margin: '10px 0 0' }}>Condiciones de envío: Los precios de la carta son para consumo en local o recogida. Los pedidos a domicilio tienen un recargo del 25% sobre el precio de los productos y un coste de envío de 1,50 €/km (máximo 8 km).</p></div>
      </footer>
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
      <RuletaPremio onAbrirCarrito={() => setCartOpen(true)} />
    </>
  );
}

export default App;
