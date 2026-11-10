import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin, Menu as MenuIcon, Phone, X } from 'lucide-react';
import './index.css';

type Dish = { name: string; description?: string; price: string; allergens?: string };
const carta: Record<string, Dish[]> = {
  'Hamburguesas de carne': [
    { name: 'La suprema', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*' },
    { name: 'La tradicional', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G* · L · S*' },
    { name: 'Burger Pizza', description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', price: '12,00 €', allergens: 'G · H · L · S' },
  ],
  'Hamburguesas de pollo': [
    { name: 'La súper', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*' },
    { name: 'La simple', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G · L · S' },
  ],
  Perritos: [
    { name: 'Perrito súper', description: 'Queso, jamón, cebolla y 3 salsas', price: '3,40 €', allergens: 'G* · L · S*' },
    { name: 'Perrito normal', description: 'Cebolla y 3 salsas', price: '3,00 €', allergens: 'G* · S*' },
  ],
  'Pan de ajo': [
    { name: 'Normal', description: 'Pan de ajo hecho con masa de pizza', price: '4,80 €', allergens: 'G' },
    { name: 'Queso', description: 'Pan de ajo hecho con masa de pizza', price: '6,30 €', allergens: 'G · L' },
    { name: 'Jamón y queso', description: 'Pan de ajo hecho con masa de pizza', price: '7,80 €', allergens: 'G · L' },
  ],
  Papas: [
    { name: 'Cono de papas', description: 'Papas fritas', price: '1,85 €' },
    { name: 'Pequeña', description: 'Papas fritas', price: '3,00 €' },
    { name: 'Grande', description: 'Papas fritas', price: '4,20 €' },
    { name: 'Extras', description: 'Cebolla 0,50 € · huevo 0,50 € · jamón 1,10 € · queso 1,10 € · pollo 1,70 € · salchicha 1,70 € · atún 1,80 € · ternera 1,80 € · lomo 1,80 €', price: '', allergens: 'H · L · P' },
  ],
  'Platos combinados': [
    { name: 'Alitas de pollo al chipotle', description: '6 unidades · con papas fritas y ensalada fresca', price: '10,00 €', allergens: 'S*' },
    { name: 'Nuggets de pollo premium', description: '10 unidades · con papas fritas y ensalada fresca', price: '7,50 €', allergens: 'G · H* · L*' },
    { name: 'Lágrimas de pollo crispy', description: 'Pollo crujiente', price: '7,50 €', allergens: 'G · H* · L*' },
    { name: 'Fingers de pollo', description: '6 unidades', price: '9,00 €', allergens: 'G · H* · L*' },
    { name: 'Brochetas de pollo', description: '3 brochetas', price: '9,00 €' },
    { name: 'Croquetas de pollo o atún', description: '8 unidades', price: '9,50 €', allergens: 'G* · H* · L* · P*' },
    { name: 'Costilla a la BBQ', description: '550 g', price: '15,95 €', allergens: 'S* · MZ*' },
    { name: 'Codillo asado', description: '600 g', price: '15,95 €' },
  ],
  'Bocadillos calientes': [
    { name: 'El ternera crack', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,80 €', allergens: 'G · H · L · MZ*' },
    { name: 'El ternera simple', description: 'Cebolla, queso y alioli', price: '4,20 €', allergens: 'G · L · MZ*' },
    { name: 'La bomba avícola', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,20 €', allergens: 'G · H · L · MZ*' },
    { name: 'El pollo simple', description: 'Cebolla, queso y alioli', price: '3,70 €', allergens: 'G · L · MZ*' },
    { name: 'El lomo goloso', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,50 €', allergens: 'G · H · L · MZ*' },
    { name: 'El lomo simple', description: 'Cebolla, queso y alioli', price: '3,90 €', allergens: 'G · L · MZ*' },
  ],
  'Sándwiches calientes': [
    { name: 'Jamón y queso', description: 'Jamón y queso', price: '2,90 €', allergens: 'G · L' },
    { name: 'El de atún', description: 'Atún, cebolla, tomate natural, queso, huevo y alioli', price: '3,50 €', allergens: 'G · H · L · P · MZ*' },
    { name: 'El de pollo', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '3,80 €', allergens: 'G · H · L · MZ*' },
    { name: 'El de ternera', description: 'Cebolla, tomate natural, huevo, queso y alioli', price: '4,20 €', allergens: 'G · H · L · MZ*' },
    { name: 'El de lomo', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '3,90 €', allergens: 'G · H · L · MZ*' },
  ],
  Pizzas: [
    { name: 'La bella serrana', description: 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', price: '11,50 €', allergens: 'G · L' },
    { name: 'La tradicional', description: 'Tomate, mozzarella, champiñones, jamón y aceitunas', price: '10,30 €', allergens: 'G · L' },
    { name: 'La parrillera', description: 'Tomate, mozzarella, champiñones, pimiento, cebolla, pollo y ternera', price: '11,00 €', allergens: 'G · L' },
    { name: 'La simple', description: 'Tomate, mozzarella, ajo y tomate natural', price: '10,00 €', allergens: 'G · L' },
    { name: 'La delicia', description: 'Tomate, mozzarella, atún y aceitunas', price: '10,30 €', allergens: 'G · L · P' },
    { name: 'Mar azul', description: 'Tomate, mozzarella, atún, cangrejo, mejillones y gambas', price: '12,90 €', allergens: 'G · L · P · CR · MO' },
    { name: 'La ranchera', description: 'BBQ, mozzarella, ternera, cebolla y salchicha', price: '10,80 €', allergens: 'G · L · S* · MZ*' },
    { name: 'Venecia', description: 'Tomate, mozzarella, jamón y bacon', price: '10,50 €', allergens: 'G · L' },
  ],
  'Cafés e infusiones': [
    { name: 'Café', price: '1,00 €' }, { name: 'Cortado corto', price: '1,10 €' }, { name: 'Cortado largo', price: '1,20 €' },
    { name: 'Leche y leche corto', price: '1,30 €' }, { name: 'Leche y leche largo', price: '1,40 €' }, { name: 'Café con leche', price: '1,40 €' },
    { name: 'Chocolate', price: '1,50 €' }, { name: 'Infusiones', price: '1,20 €' }, { name: 'Cortado vaso', price: '2,00 €' },
  ],
  'Refrescos, aguas y zumos': [
    { name: 'Coca-Cola', price: '2,00 €' }, { name: 'Sprite', price: '1,50 €' }, { name: 'Fanta limón', price: '1,50 €' },
    { name: 'Fanta naranja', price: '1,50 €' }, { name: 'Tónica', price: '1,50 €' }, { name: 'Agua pequeña', price: '1,50 €' },
    { name: 'Agua grande', price: '2,00 €' }, { name: 'Energética', price: '1,40 €' }, { name: 'Zumos', price: '1,80 €' },
    { name: 'Zumo naranja', price: '3,20 €' }, { name: 'Red Bull', price: '2,40 €' }, { name: 'Vaso de agua', price: '0,30 €' },
  ],
  Cervezas: [
    { name: 'Tropical', price: '1,40 €' }, { name: 'Tropical limón', price: '1,50 €' }, { name: 'Botellín Tropical', price: '1,20 €' },
    { name: 'Dorada sin', price: '1,40 €' }, { name: 'Dorada normal', price: '1,80 €' }, { name: 'Dorada especial', price: '1,80 €' },
    { name: 'Estrella', price: '1,30 €' }, { name: 'Estrella mini', price: '1,00 €' }, { name: '1906', price: '2,90 €' }, { name: 'Corona', price: '3,00 €' },
  ],
  'Licores y destilados': [
    { name: 'Ron blanco / oro', price: '1,50 €' }, { name: 'Ginebra', price: '3,00 €' }, { name: 'Whisky', price: '2,00 €' },
    { name: 'Coñac', price: '1,50 €' }, { name: 'Amaretto', price: '3,80 €' }, { name: 'Frangelico', price: '3,80 €' },
    { name: 'Tía María', price: '3,80 €' }, { name: 'Baileys', price: '3,80 €' }, { name: 'Marie Brizard', price: '2,80 €' },
    { name: 'Chinchón dulce', price: '1,50 €' }, { name: 'Vodka', price: '2,00 €' }, { name: 'Santa Teresa', price: '3,00 €' },
    { name: 'Malibú', price: '3,00 €' }, { name: 'Tequila', price: '3,00 €' }, { name: 'Etiqueta negra', price: '3,50 €' },
    { name: 'Etiqueta roja', price: '2,00 €' }, { name: 'Cardhu', price: '5,50 €' }, { name: 'Jack Daniel’s', price: '4,50 €' },
  ],
  Vinos: [
    { name: 'Viña Lobón', price: '8,00 €' }, { name: 'Mala Bestia', price: '9,00 €' }, { name: 'Palacio de Beltús', price: '9,00 €' },
    { name: 'Conde de Basalu', price: '9,00 €' }, { name: 'Luis Caña', price: '24,00 €' }, { name: 'Despecho', price: '18,00 €' },
    { name: 'Azpilicueta', price: '27,00 €' }, { name: 'Esencia 27', price: '18,00 €' }, { name: 'Iniesta', price: '18,00 €' }, { name: 'Dulce Malicia', price: '24,00 €' },
  ],
};

const address = 'Pintor Antonio Padrón, 59, Las Mesas Bajas, Las Palmas de Gran Canaria';
const mapsUrl = 'https://www.google.com/maps/place/C.+Pintor+Antonio+Padr%C3%B3n,+59,+35018+Las+Mesas,+Las+Palmas/@28.0991469,-15.4976894,17z/data=!3m1!4b1!4m6!3m5!1s0xc4094784d2465e5:0x2e61ab7822fd4801!8m2!3d28.0991469!4d-15.4976894!16s%2Fg%2F11bw44jbyw?entry=ttu&g_ep=EgoyMDI2MTEwNC4wIKXMDSoASAFQAw%3D%3D';
const phone = '+34 928 896 097';
const phoneHref = 'tel:+34928896097';
const whatsapp = '34928896097';
const reviewsUrl = ''; // Añadir aquí el enlace oficial cuando esté disponible.
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

function App() {
  const [activeCategory, setActiveCategory] = useState(Object.keys(carta)[0]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reservationStatus, setReservationStatus] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [compactHeader, setCompactHeader] = useState(false);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const categories = Object.keys(carta);
  const reservationTimes = timesForDate(reservationDate);
  const minDate = formatLocalDate(new Date());

  useEffect(() => {
    const onScroll = () => setCompactHeader(window.scrollY > 36);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  return (
    <main>
      <div className="topline"><span>Las Mesas Bajas · Gran Canaria</span><span>Un sitio para compartir algo más que mesa</span><a href={phoneHref} data-testid="link-call-top">{phone}</a></div>
      <header className={compactHeader ? 'site-header compact' : 'site-header'}>
        <a href="#inicio" className="brand" aria-label="Las Mesas, inicio"><img src="/assets/logo-las-mesas.jpeg" alt="Logo de Las Mesas Café & Bar" /></a>
        <button className="mobile-toggle" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">{mobileOpen ? <X /> : <MenuIcon />}</button>
        <nav className={mobileOpen ? 'main-nav open' : 'main-nav'} aria-label="Navegación principal">
          {[['La casa', '#esencia'], ['El local', '#local'], ['La carta', '#carta'], ['Celebraciones', '#celebraciones'], ['Visítanos', '#contacto']].map(([label, href]) => <a key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</a>)}
          <a className="nav-cta" href="#reserva" onClick={() => setMobileOpen(false)}>Reserva tu mesa <ArrowUpRight size={15} /></a>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy reveal">
          <p className="eyebrow"><span className="gold-dot" /> Café · Bar · Billar</p>
          <h1>Las noches<br />se alargan <em>en buena compañía.</em></h1>
          <p className="hero-intro">Una mesa para comer, otra para jugar y siempre un motivo para quedarse un rato más.</p>
          <div className="hero-actions"><a className="button button-gold" href="#reserva">Reserva tu mesa <ArrowRight size={17} /></a><a className="text-link" href="#carta">Descubre la carta <ArrowDown size={15} /></a></div>
          <div className="hero-meta"><span><MapPin size={15} /> Las Mesas Bajas</span><span><Clock3 size={15} /> Consulta nuestro horario</span></div>
        </div>
        <figure className="hero-art hero-photo reveal">
          <img src="/assets/hero-las-mesas.webp" alt="Mesa de billar y comedor de Las Mesas" width="640" height="854" fetchPriority="high" decoding="async" />
          <figcaption className="hero-photo-caption"><span>LAS MESAS · GRAN CANARIA</span><b>Entre bocados y una partida</b></figcaption>
        </figure>
        <a className="scroll-cue" href="#esencia" aria-label="Desplazarse a la siguiente sección"><span>BAJA UN POCO</span><ArrowDown size={15} /></a>
      </section>

      <section className="essence section-pad" id="esencia">
        <div className="shell essence-grid">
          <div className="section-index">01 <span>— LA CASA</span></div>
          <div className="essence-title"><p className="eyebrow">Un punto de encuentro en el barrio</p><h2>Ven por la cena.<br /><em>Quédate por el rato.</em></h2></div>
          <div className="essence-text"><p>En Las Mesas el plan no tiene que complicarse: algo rico para picar, una charla sin prisa y, si apetece, una partida de billar.</p><p>Un café de barrio con espíritu de bar. Hecho para encontrarse.</p><a className="text-link dark-link" href="#contacto">Encuéntranos en Las Mesas <ArrowRight size={15} /></a></div>
        </div>
      </section>

      <section className="gallery-section section-pad" id="local" aria-labelledby="gallery-title">
        <div className="shell">
          <div className="gallery-heading">
            <div><p className="eyebrow"><span className="gold-dot" /> Una mesa para cada plan</p><h2 id="gallery-title">Así se disfruta<span>.</span></h2></div>
            <p>Comer sin prisa, compartir algo rico y dejar sitio para una partida.</p>
          </div>
          <div className="gallery-grid">
            <figure className="gallery-card gallery-card-tall">
              <img src="/assets/local-billar-1.webp" alt="Mesa de billar y mesas del comedor de Las Mesas" width="896" height="1195" loading="lazy" decoding="async" />
              <figcaption><span>Una partida</span><small>El billar del local</small></figcaption>
            </figure>
            <figure className="gallery-card">
              <img src="/assets/platos-compartir.jpg" alt="Selección fotografiada de platos para compartir de la carta" width="550" height="440" loading="lazy" decoding="async" />
              <figcaption><span>Algo para compartir</span><small>Platos de la carta</small></figcaption>
            </figure>
            <figure className="gallery-card">
              <img src="/assets/hamburguesa-pollo-crispy.jpg" alt="Hamburguesa de pollo crujiente fotografiada en el local" width="550" height="440" loading="lazy" decoding="async" />
              <figcaption><span>Hamburguesa de pollo</span><small>Un clásico de la carta</small></figcaption>
            </figure>
            <figure className="gallery-card">
              <img src="/assets/brochetas-pollo.jpg" alt="Brochetas de pollo con papas fritas" width="550" height="440" loading="lazy" decoding="async" />
              <figcaption><span>Brochetas de pollo</span><small>Para disfrutar en compañía</small></figcaption>
            </figure>
          </div>
          <p className="gallery-note">Fotografías reales del billar, el comedor y platos de la carta.</p>
          <div className="house-note"><span className="note-mark">LM</span><p>«La mejor jugada<br />es compartir la mesa.»</p><span className="note-rule" /><span className="eyebrow">Las Mesas · Gran Canaria</span></div>
        </div>
      </section>

      <section className="menu-section section-pad" id="carta">
        <div className="shell">
          <div className="menu-heading"><div><p className="eyebrow"><span className="gold-dot" /> Cocina para compartir</p><h2>La carta<span>.</span></h2><p className="section-lede">De un bocado rápido a una pizza para el centro. Aquí empieza el plan.</p></div><a className="button button-outline" href="/assets/carta-las-mesas.pdf" download="carta-las-mesas.pdf" data-testid="link-download-menu">Descargar carta completa <ArrowDown size={16} /></a></div>
          <div className="menu-experience">
            <div className="category-list" role="tablist" aria-label="Categorías de la carta" aria-orientation="vertical">
              {categories.map((category, index) => <button key={category} className={activeCategory === category ? 'category-tab active' : 'category-tab'} role="tab" tabIndex={activeCategory === category ? 0 : -1} id={`tab-${index}`} aria-selected={activeCategory === category} aria-controls="menu-panel" onClick={() => setActiveCategory(category)} onKeyDown={(e) => { const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (index + 1) % categories.length : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (index - 1 + categories.length) % categories.length : -1; if (next >= 0) { e.preventDefault(); document.getElementById(`tab-${next}`)?.focus(); setActiveCategory(categories[next]); } }} data-testid={`tab-category-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{category}<ArrowRight size={14} /></button>)}
              <p className="menu-download-note">La carta completa, lista para consultar o guardar.</p>
            </div>
            <div className="menu-panel" role="tabpanel" id="menu-panel" aria-labelledby={`tab-${categories.indexOf(activeCategory)}`} key={activeCategory}>
              <div className="panel-title"><div><span className="eyebrow">En la mesa</span><h3>{activeCategory}</h3></div><span className="dish-count">{String(carta[activeCategory].length).padStart(2, '0')} opciones</span></div>
              <div className="dish-list">
                {carta[activeCategory].map((dish) => <article className="dish-row" key={dish.name}><div className="dish-detail"><div className="dish-name">{dish.name}</div>{dish.description && <p>{dish.description}</p>}{dish.allergens && <small>Alérgenos: {dish.allergens}</small>}</div>{dish.price && <strong>{dish.price}</strong>}</article>)}
              </div>
              <p className="allergen-note"><b>Alérgenos</b> · G = gluten · H = huevo · L = lácteos · P = pescado · CR = crustáceos · MO = moluscos · S = sulfitos · MZ = mostaza.<br />Información orientativa. Si tienes alergia o intolerancia, avísanos para confirmar los ingredientes.</p>
              {activeCategory === 'Bocadillos calientes' && <p className="allergen-note">Todos los bocadillos se sirven con pan de bombón.</p>}
              <p className="allergen-note">Los asteriscos se muestran tal como aparecen en la carta original.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="play-section section-pad" aria-labelledby="play-title">
        <div className="shell play-grid">
          <div className="play-number">02 / BILLAR</div>
          <div><p className="eyebrow">Un plan con pausa</p><h2 id="play-title" className="serif">Pide algo.<br /><em>Y que ruede la partida.</em></h2></div>
          <div className="play-copy"><p>La conversación se mueve alrededor de la mesa. Entre plato y plato, una partida convierte una cena cualquiera en un buen recuerdo.</p><a className="button button-gold" href="#reserva">Ven a jugar <ArrowRight size={16} /></a></div>
        </div>
      </section>

      <section className="celebration section-pad" id="celebraciones">
        <div className="shell celebration-grid">
          <div className="celebration-copy"><p className="eyebrow"><span className="gold-dot" /> Un motivo para juntarse</p><h2>¿Qué celebramos<br /><em>esta vez?</em></h2><p>Cumpleaños, cenas de empresa o esa reunión que lleva tiempo pendiente. Cuéntanos tu idea y el equipo podrá preparar una propuesta a medida.</p><div className="celebration-tags"><span>Cumpleaños</span><span>Cenas de empresa</span><span>Otros encuentros</span></div></div>
          <form className="form-card event-form" onSubmit={(e) => sendWhatsApp(e, 'evento')}>
            <span className="eyebrow">Cuéntanos tu idea</span><h3>Solicitud de celebración</h3>
            <div className="field-grid">
              <label>Nombre<input name="eventName" required autoComplete="name" placeholder="Tu nombre" data-testid="input-event-name" /></label>
              <label>Teléfono o email<input name="eventContact" required autoComplete="email" pattern="(?:[^@ ]+@[^@ ]+\\.[^@ ]+|\\+?[0-9][0-9 \\-]{6,})" title="Introduce un teléfono válido o un correo electrónico." placeholder="¿Cómo te contactamos?" data-testid="input-event-contact" /></label>
              <label>Tipo de evento<select name="type" defaultValue="" required data-testid="select-event-type"><option value="" disabled>Elige una opción</option><option>Cumpleaños</option><option>Cena de empresa</option><option>Otro encuentro</option></select></label>
              <label>Fecha aproximada<input type="date" name="eventDate" min={minDate} required data-testid="input-event-date" /></label>
              <label>Número de personas<input type="number" min="1" max="100" name="eventPeople" required placeholder="Ej. 12" data-testid="input-event-people" /></label>
              <label className="full-field">Detalles<textarea name="details" required rows={3} placeholder="Cuéntanos un poco más sobre lo que tienes en mente" data-testid="input-event-details" /></label>
            </div>
            <button className="button button-gold form-submit" type="submit" data-testid="button-event-submit">Enviar consulta por WhatsApp <ArrowRight size={16} /></button>
            <p className="form-disclaimer">Se abrirá WhatsApp con tu mensaje preparado. Tendrás que enviarlo para que recibamos la consulta; no implica una reserva confirmada.</p>
            {eventStatus && <p className="form-status" role="status" data-testid="status-event">{eventStatus}</p>}
          </form>
        </div>
      </section>

      <section className="review-strip">
        <div className="shell review-inner"><span className="review-star" aria-hidden="true" /><p>¿Ya has pasado por aquí?<br /><em>Nos encantará saber qué te pareció.</em></p>{reviewsUrl ? <a className="button button-light" href={reviewsUrl} target="_blank" rel="noreferrer">Compartir opinión <ArrowUpRight size={15} /></a> : <span className="editable-note">Enlace a reseñas pendiente de añadir</span>}</div>
      </section>

      <section className="reservation section-pad" id="reserva">
        <div className="shell reservation-grid">
          <div className="reservation-intro"><p className="eyebrow">Una mesa te espera</p><h2>Hacemos<br /><em>un hueco.</em></h2><p>Cuéntanos cuándo vienes y cuántos sois. Te enviaremos la solicitud por WhatsApp para que puedas confirmarla con el equipo.</p><div className="direct-call"><span>¿Prefieres llamar?</span><a href={phoneHref} data-testid="link-call-reservation"><Phone size={16} /> {phone}</a></div></div>
          <form className="form-card reservation-form" onSubmit={(e) => sendWhatsApp(e, 'reserva')}>
            <span className="eyebrow">Solicitud de reserva</span>
            <div className="field-grid">
              <label>Nombre<input name="name" required autoComplete="name" placeholder="Tu nombre" data-testid="input-reservation-name" /></label>
              <label>Teléfono o email<input name="contact" required autoComplete="email" pattern="(?:[^@ ]+@[^@ ]+\\.[^@ ]+|\\+?[0-9][0-9 \\-]{6,})" title="Introduce un teléfono válido o un correo electrónico." placeholder="Tu contacto" data-testid="input-reservation-contact" /></label>
              <label>Fecha<input type="date" name="date" min={minDate} required value={reservationDate} onChange={(event) => { setReservationDate(event.target.value); setReservationTime(''); }} data-testid="input-reservation-date" /></label>
              <label>Hora<select name="time" required value={reservationTime} onChange={(event) => setReservationTime(event.target.value)} disabled={!reservationDate} data-testid="select-reservation-time"><option value="" disabled>{reservationDate ? 'Elige una hora' : 'Elige primero una fecha'}</option>{reservationTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
              <label>Número de personas<input type="number" min="1" max="20" name="people" required placeholder="Ej. 4" data-testid="input-reservation-people" /></label>
              <label className="full-field">Comentarios <span className="optional">(opcional)</span><textarea name="comments" rows={2} placeholder="Algo que debamos tener en cuenta" data-testid="input-reservation-comments" /></label>
            </div>
            <button className="button button-gold form-submit" type="submit" data-testid="button-reservation-submit">Preparar solicitud <ArrowRight size={16} /></button>
            <p className="form-disclaimer">Se abrirá WhatsApp con el mensaje preparado. Debes pulsar «Enviar»; la mesa no queda reservada hasta recibir confirmación del local.</p>
            {reservationStatus && <p className="form-status" role="status" data-testid="status-reservation">{reservationStatus}</p>}
          </form>
        </div>
      </section>

      <section className="contact-section section-pad" id="contacto">
        <div className="shell">
          <div className="contact-heading"><div><p className="eyebrow"><span className="gold-dot" /> Nos vemos en el barrio</p><h2>Ven a Las Mesas<span>.</span></h2></div><a className="button button-outline" href={mapsUrl} target="_blank" rel="noreferrer" data-testid="link-maps">Cómo llegar <ArrowUpRight size={16} /></a></div>
          <div className="contact-grid">
            <div className="address-block"><MapPin size={21} /><span className="eyebrow">Dirección</span><address>{address}</address><a className="text-link dark-link" href={mapsUrl} target="_blank" rel="noreferrer">Abrir en Google Maps <ArrowUpRight size={14} /></a></div>
            <div className="hours-block"><Clock3 size={21} /><span className="eyebrow">Horario</span>{hours.map(([day, time]) => <div className="hours-row" key={day}><span>{day}</span><strong>{time}</strong></div>)}</div>
            <div className="phone-block"><Phone size={21} /><span className="eyebrow">Llámanos</span><a href={phoneHref} data-testid="link-call-footer">{phone}</a><p>Para consultas y reservas, estamos al otro lado.</p></div>
          </div>
          <div className="social-editable"><span className="eyebrow">Redes y reseñas</span><p>Instagram oficial disponible; los demás enlaces están pendientes.</p><span>Instagram: <a href={instagramUrl} target="_blank" rel="noreferrer">ver perfil</a></span><span>Facebook: {facebookUrl || 'pendiente de añadir'}</span><span>Reseñas Google: {reviewsUrl || 'pendiente de añadir'}</span></div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-main"><a href="#inicio" className="footer-brand"><img src="/assets/logo-las-mesas.jpeg" alt="" /><span>Las Mesas · Café & Bar</span></a><p>Comer. Encontrarse. Jugar un rato.</p><nav aria-label="Navegación de pie">{[['La casa','#esencia'],['El local','#local'],['La carta','#carta'],['Celebraciones','#celebraciones'],['Reservas','#reserva']].map(([label,href]) => <a key={href} href={href}>{label}</a>)}</nav></div>
        <div className="shell footer-details">
          <div className="footer-hours"><span className="footer-label">Horario</span>{hours.map(([day, time]) => <p key={day}><span>{day}</span><strong>{time}</strong></p>)}</div>
          <div className="footer-contact"><span className="footer-label">Contacto</span><a href={phoneHref}>{phone}</a><a href={mapsUrl} target="_blank" rel="noreferrer">Pintor Antonio Padrón, 59 · Cómo llegar</a></div>
          <div className="footer-social"><span className="footer-label">Redes y reseñas</span><span>Instagram: {instagramUrl ? <a href={instagramUrl} target="_blank" rel="noreferrer">ver perfil</a> : 'enlace pendiente de añadir'}</span><span>Facebook: {facebookUrl ? <a href={facebookUrl} target="_blank" rel="noreferrer">ver perfil</a> : 'enlace pendiente de añadir'}</span><span>Reseñas Google: {reviewsUrl ? <a href={reviewsUrl} target="_blank" rel="noreferrer">compartir opinión</a> : 'enlace pendiente de añadir'}</span></div>
        </div>
        <div className="shell footer-bottom"><span>© Las Mesas · Café & Bar</span><span>Pintor Antonio Padrón, 59 · Las Mesas Bajas · Las Palmas de Gran Canaria</span></div>
      </footer>
    </main>
  );
}

export default App;
