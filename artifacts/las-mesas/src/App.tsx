import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin, Menu as MenuIcon, Moon, Phone, ShoppingBag, Sun, X } from 'lucide-react';
import './index.css';
import { useCart } from '@/CartContext';
import { useTheme } from '@/ThemeContext';
import { useI18n, type Idioma } from '@/I18nContext';
import CartSidebar from '@/CartSidebar';
import ProductCard from '@/ProductCard';
import Inventario from '@/admin/Inventario';
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
const hours = [
  ['Lunes–viernes', '18:00–23:00'],
  ['Sábado', '12:00–15:00 · 18:00–23:00'],
  ['Domingo', '12:00–17:00'],
];

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
  | { tipo: 'confirmado'; idPedido: string; codigo: string; total: string; articulos: { name: string; qty: number }[] }
  | { tipo: 'cancelado' }
  | { tipo: 'error'; mensaje: string }
  | null;

// El panel de inventario vive en su propia ruta (/admin/inventario). El
// rewrite de Vercel manda esa URL al index.html, asi que la SPA la muestra
// sin necesidad de un router.
const rutaActual =
  typeof window !== 'undefined'
    ? window.location.pathname.replace(/\/+$/, '').toLowerCase()
    : '';
const esRutaLogin = rutaActual === '/login';
const esRutaAdmin = rutaActual.startsWith('/admin');

function App() {
  const [activeSlug, setActiveSlug] = useState(CATEGORIES[0].slug);
  const [productos, setProductos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Category[]>(CATEGORIES);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reservationStatus, setReservationStatus] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [enviandoCelebracion, setEnviandoCelebracion] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [avisoPedido, setAvisoPedido] = useState<AvisoPedido>(null);
  const [location, navegar] = useLocation();
  const [productosVisibles, setProductosVisibles] = useState(12);
  const { cart, addToCart, clearCart } = useCart();
  const { tema, alternarTema } = useTheme();
  const { idioma, cambiarIdioma, t } = useI18n();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeCategory = categorias.find((c) => c.slug === activeSlug) ?? categorias[0];
  const productosActivos = productos.filter((p) => p.category_slug === activeCategory.slug);
  useEffect(() => { setProductosVisibles(12); }, [activeSlug]);

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
      ? [`Solicitud de reserva — Las Mesas · Café & Bar`, `Nombre: ${data.get('name')}`, `Contacto: ${data.get('contact')}`, `Fecha: ${data.get('date')}`, `Hora: ${data.get('time')}`, `Personas: ${data.get('people')}`, `Comentarios: ${data.get('comments') || 'Sin comentarios'}`]
      : [`Consulta de evento — Las Mesas · Café & Bar`, `Nombre: ${data.get('eventName')}`, `Contacto: ${data.get('eventContact')}`, `Tipo de evento: ${data.get('type')}`, `Fecha aproximada: ${data.get('eventDate')}`, `Personas: ${data.get('eventPeople')}`, `Detalles: ${data.get('details')}`];
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
    const message = 'Se ha preparado tu mensaje de WhatsApp. Revísalo y pulsa «Enviar» para hacernos llegar la solicitud. No es una reserva confirmada.';
    kind === 'reserva' ? setReservationStatus(message) : setEventStatus(message);
  }

  if (esRutaLogin) return <Login />;
  if (esRutaAdmin) return <Inventario />;


  // ===== Páginas (contenido por ruta) =====
  const paginaInicio = (
    <>
      {/* ===== HERO con imagen de fondo + overlay ===== */}
      <section className="home-hero">
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-overlay" aria-hidden="true" />
        <div className="shell home-hero-content">
          <p className="eyebrow"><span className="gold-dot" /> Las Mesas · Café & Bar</p>
          <h1 className="home-hero-title">{t('home.hero.titulo1')}<br /><em>{t('home.hero.titulo2')}</em></h1>
          <p className="home-hero-desc">{t('home.hero.desc')}</p>
          <Link className="button button-gold home-hero-btn" href="/carta" data-testid="link-ver-carta">
            Ver la carta <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ===== ASÍ SE DISFRUTA: fila de 3 imágenes grandes ===== */}
      <section className="home-gallery section-pad" id="local" aria-labelledby="gallery-title">
        <div className="shell">
          <div className="home-section-head">
            <p className="eyebrow"><span className="gold-dot" /> Una mesa para cada plan</p>
            <h2 id="gallery-title">{t('home.galeria.titulo')}<span>.</span></h2>
            <p>{t('home.galeria.desc')}</p>
          </div>
          <div className="home-gallery-grid">
            <figure className="home-gallery-card home-gallery-card-tall">
              <img src="/assets/local-billar-1.webp" alt="Mesa de billar y mesas del comedor de Las Mesas" width="896" height="1195" loading="lazy" decoding="async" />
              <figcaption><span>{t('home.galeria.billar')}</span></figcaption>
            </figure>
            <figure className="home-gallery-card">
              <img src="/assets/platos-compartir.jpg" alt="Platos para compartir de la carta" width="550" height="440" loading="lazy" decoding="async" />
              <figcaption><span>{t('home.galeria.compartir')}</span></figcaption>
            </figure>
            <figure className="home-gallery-card">
              <img src="/assets/hero-las-mesas.webp" alt="El comedor de Las Mesas" width="640" height="854" loading="lazy" decoding="async" />
              <figcaption><span>{t('home.galeria.quedarse')}</span></figcaption>
            </figure>
          </div>
          <div className="house-note"><span className="note-mark">LM</span><p>«La mejor jugada<br />{t('home.galeria.cita')}»</p><span className="note-rule" /><span className="eyebrow">Las Mesas · Gran Canaria</span></div>
        </div>
      </section>

      {/* ===== NUESTROS FAVORITOS: 3 platos destacados ===== */}
      <section className="home-favorites section-pad">
        <div className="shell">
          <div className="home-fav-head">
            <div>
              <p className="eyebrow"><span className="gold-dot" /> Los más pedidos</p>
              <h2>{t('home.fav.titulo')}<span>.</span></h2>
            </div>
            <Link className="button button-outline" href="/carta" data-testid="link-toda-carta">{t('home.fav.verToda')} <ArrowRight size={16} /></Link>
          </div>
          <div className="home-fav-grid">
            {[
              { nombre: 'Burger Pizza', imagen: '/assets/burger-pizza.jpg', precio: '14,80 €' },
              { nombre: 'La Encerrona', imagen: '/assets/hamburguesa-pollo-crispy-super.jpg', precio: '12,00 €' },
              { nombre: 'Costilla a la BBQ', imagen: '/assets/costillas-bbq.webp', precio: '15,95 €' },
              { nombre: 'La Suprema', imagen: '/assets/platos-compartir.jpg', precio: '6,50 €' },
            ].map((p) => (
              <article className="home-fav-card" key={p.nombre}>
                <img src={p.imagen} alt={p.nombre} loading="lazy" decoding="async" />
                <div className="home-fav-info"><h3>{p.nombre}</h3><strong>{p.precio}</strong></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="carta-cta-section section-pad">
        <div className="shell">
          <Link className="button button-gold carta-cta-button" href="/carta" data-testid="link-ver-carta-bottom">
            Ver la carta <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
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
              <div className="panel-title"><div><span className="eyebrow">{t('carta.enMesa')}</span><h3>{activeCategory.name}</h3></div><span className="dish-count">{String(productos.length).padStart(2, '0')} opciones</span></div>
              <div className="dish-list dish-grid grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {productosActivos.slice(0, productosVisibles).map((producto) => (
                  <ProductCard
                    key={producto.id}
                    product={producto}
                    onAddToCart={(product) => addToCart({
                      id: String(product.id || product.name),
                      name: product.name,
                      price: product.price,
                      image: product.image,
                    })}
                    showSizeSelector={false}
                  />
                ))}
              </div>

              {productosActivos.length > productosVisibles && (
                <div className="carta-mas-wrap">
                  <button
                    type="button"
                    className="button button-outline carta-mas"
                    onClick={() => setProductosVisibles((n) => n + 12)}
                    data-testid="button-cargar-mas"
                  >
                    Ver más ({productosActivos.length - productosVisibles} restantes) <ArrowDown size={16} />
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
      <section className="essence section-pad" id="esencia">
        <div className="shell essence-grid">
          <div className="section-index">01 <span>— LA CASA</span></div>
          <div className="essence-title"><p className="eyebrow">{t('casa.titulo')}</p><h2>{t('local.volver.cena')}<br /><em>{t('local.quedate')}</em></h2></div>
          <div className="essence-text"><p>En Las Mesas el plan no tiene que complicarse: algo rico para picar, una charla sin prisa y, si apetece, una partida de billar.</p><p>Un café de barrio con espíritu de bar. Hecho para encontrarse.</p><a className="text-link dark-link" href="#contacto">{t('local.contacto')} <ArrowRight size={15} /></a></div>
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
      <section className="contact-section section-pad" id="contacto">
        <div className="shell">
          <div className="contact-heading"><div><p className="eyebrow"><span className="gold-dot" /> Nos vemos en el barrio</p><h2>{t('contacto.ven')}<span>.</span></h2></div><a className="button button-outline" href={mapsUrl} target="_blank" rel="noreferrer" data-testid="link-maps">{t('contacto.comoLlegar')} <ArrowUpRight size={16} /></a></div>
          <div className="contact-grid">
            <div className="address-block"><MapPin size={21} /><span className="eyebrow">Dirección</span><address className="break-words">{address}</address><a className="text-link dark-link" href={mapsUrl} target="_blank" rel="noreferrer">{t('contacto.abrirMaps')} <ArrowUpRight size={14} /></a></div>
            <div className="hours-block"><Clock3 size={21} /><span className="eyebrow">Horario</span>{hours.map(([day, time]) => <div className="hours-row" key={day}><span>{day}</span><strong>{time}</strong></div>)}</div>
            <div className="phone-block"><Phone size={21} /><span className="eyebrow">Llámanos</span><a href={phoneHref} data-testid="link-call-footer">{phone}</a><p>{t('contacto.llamamos.desc')}</p></div>
          </div>
          {/* La URL de las reseñas NO se imprime: se muestra como enlace para
              que no aparezca el texto gigante que rompía el móvil. */}
          <div className="social-editable">
            <span className="eyebrow">Redes y reseñas</span>
            <p>{t('contacto.redes')}</p>
            <span className="min-w-0 break-words">
              Instagram:{' '}
              {instagramUrl ? (
                <a href={instagramUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a>
              ) : (
                'pendiente de añadir'
              )}
            </span>
            <span className="min-w-0 break-words">
              Facebook:{' '}
              {facebookUrl ? (
                <a href={facebookUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a>
              ) : (
                'pendiente de añadir'
              )}
            </span>
            <span className="min-w-0 break-words">
              Reseñas Google:{' '}
              {reviewsUrl ? (
                <a href={reviewsUrl} target="_blank" rel="noreferrer">
                  compartir opinión
                </a>
              ) : (
                'pendiente de añadir'
              )}
            </span>
          </div>
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
    <main>
      {avisoPedido && (
        <div className={`pedido-aviso pedido-aviso-${avisoPedido.tipo}`} role="status" data-testid="pedido-aviso">
          <div className="pedido-aviso-inner">
            {avisoPedido.tipo === 'confirmado' && (
              <>
                <span className="pedido-aviso-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>{t('pedido.confirmado')}</strong>
                  <p>
                    Te hemos enviado la confirmación por correo.
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
      <div className="topline"><span>Las Mesas Bajas · Gran Canaria</span><span>{t('home.hero.desc')}</span><a href={phoneHref} data-testid="link-call-top">{phone}</a></div>
      <header className={compactHeader ? 'site-header compact' : 'site-header'}>
        <a href="#inicio" className="brand" aria-label="Las Mesas, inicio"><img src="/assets/logo-las-mesas.jpeg" alt="Logo de Las Mesas Café & Bar" /></a>
        <button className="mobile-toggle" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">{mobileOpen ? <X /> : <MenuIcon />}</button>
        <nav className={mobileOpen ? 'main-nav open' : 'main-nav'} aria-label="Navegación principal">
          {[[t('nav.casa'), '/'], [t('nav.local'), '/local'], [t('nav.carta'), '/carta'], [t('nav.celebraciones'), '/celebraciones'], [t('nav.visitamos'), '/local']].map(([label, href]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</Link>)}
          <Link className="nav-cta" href="/reservas" onClick={() => setMobileOpen(false)}>{t('nav.reserva')} <ArrowUpRight size={15} /></Link>
        </nav>
        <div className="lang-toggle" role="group" aria-label="Idioma / Language / Langue">
          {([['es','🇪🇸'],['en','🇬🇧'],['fr','🇫🇷'],['de','🇩🇪']] as Array<[Idioma,string]>).map(([cod, bandera]) => (
            <button
              key={cod}
              type="button"
              className={idioma === cod ? 'lang-btn is-active' : 'lang-btn'}
              onClick={() => cambiarIdioma(cod)}
              aria-label={cod.toUpperCase()}
              aria-pressed={idioma === cod}
              data-testid={'button-lang-' + cod}
            >
              {bandera}
            </button>
          ))}
        </div>
        <button
          className="theme-toggle"
          onClick={alternarTema}
          aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          data-testid="button-theme"
        >
          {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          className="cart-toggle"
          onClick={() => setCartOpen(true)}
          aria-label={`Abrir carrito${cartCount ? `, ${cartCount} artículos` : ''}`}
          data-testid="button-cart"
        >
          <ShoppingBag size={20} />
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </header>

      <Switch>
        <Route path="/">{paginaInicio}</Route>
        <Route path="/carta">{paginaCarta}</Route>
        <Route path="/local">{paginaLocal}</Route>
        <Route path="/celebraciones">{paginaCelebraciones}</Route>
        <Route path="/reservas">{paginaReservas}</Route>
        <Route>{paginaInicio}</Route>
      </Switch>

      <footer className="site-footer">
        <div className="shell footer-main"><a href="#inicio" className="footer-brand"><img src="/assets/logo-las-mesas.jpeg" alt="" /><span>Las Mesas · Café & Bar</span></a><p>{t('footer.lema')}</p><nav aria-label="Navegación de pie">{[['La casa','#esencia'],['El local','#local'],['La carta','#carta'],['Celebraciones','#celebraciones'],['Reservas','#reserva']].map(([label,href]) => <a key={href} href={href}>{label}</a>)}</nav></div>
        <div className="shell footer-details">
          <div className="footer-hours"><span className="footer-label">Horario</span>{hours.map(([day, time]) => <p key={day}><span>{day}</span><strong>{time}</strong></p>)}</div>
          <div className="footer-contact"><span className="footer-label">Contacto</span><a href={phoneHref}>{phone}</a><a href={mapsUrl} target="_blank" rel="noreferrer">Pintor Antonio Padrón, 59 · Cómo llegar</a></div>
          <div className="footer-social min-w-0"><span className="footer-label">Redes y reseñas</span><span>Instagram: {instagramUrl ? <a href={instagramUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a> : 'enlace pendiente de añadir'}</span><span>Facebook: {facebookUrl ? <a href={facebookUrl} target="_blank" rel="noreferrer">{t('contacto.verPerfil')}</a> : 'enlace pendiente de añadir'}</span><span>Reseñas Google: {reviewsUrl ? <a href={reviewsUrl} target="_blank" rel="noreferrer">{t('contacto.compartir')}</a> : 'enlace pendiente de añadir'}</span></div>
        </div>
        <div className="shell footer-bottom"><span>© Las Mesas · Café & Bar</span><span>Pintor Antonio Padrón, 59 · Las Mesas Bajas · Las Palmas de Gran Canaria</span></div>
        <div className="shell"><p style={{ fontSize: '.7rem', opacity: .75, lineHeight: 1.6, margin: '10px 0 0' }}>Condiciones de envío: Los precios de la carta son para consumo en local o recogida. Los pedidos a domicilio tienen un recargo del 25% sobre el precio de los productos y un coste de envío de 1,50 €/km (máximo 8 km).</p></div>
      </footer>
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}

export default App;
