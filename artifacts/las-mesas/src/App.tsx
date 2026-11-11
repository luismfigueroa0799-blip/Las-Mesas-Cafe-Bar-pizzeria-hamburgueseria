import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin, Menu as MenuIcon, Phone, X } from 'lucide-react';
import './index.css';
import { CartProvider, useCart } from '@/CartContext';
import ProductCard from '@/ProductCard';

// Tipo para un producto
interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  image: string;
  allergens?: string;
}

// Datos de la carta (en producción se obtendrían de getProducts() de Neon)
const initialProducts: Product[] = [
  { id: '1', name: 'La suprema', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', image: '/assets/lagrimas-pollo-crispy.jpg', allergens: 'G* · H · L · S*' },
  { id: '2', name: 'La tradicional', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', image: '/assets/fingers-pollo.jpg', allergens: 'G* · L · S*' },
  { id: '3', name: 'Burger Pizza', description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', price: '12,00 €', image: '/assets/burger-pizza.jpg', allergens: 'G · H · L · S' },
  { id: '4', name: 'La súper', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', image: '/assets/hamburguesa-pollo-crispy.jpg', allergens: 'G* · H · L · S*' },
  { id: '5', name: 'La simple', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', image: '/assets/platos-compartir.jpg', allergens: 'G · L · S' },
  { id: '6', name: 'Perrito súper', description: 'Queso, jamón, cebolla y 3 salsas', price: '3,40 €', image: '/assets/brochetas-pollo.jpg', allergens: 'G* · L · S*' },
  { id: '7', name: 'Perrito normal', description: 'Cebolla y 3 salsas', price: '3,00 €', image: '/assets/local-billar-1.webp', allergens: 'G* · S*' },
  { id: '8', name: 'Normal', description: 'Pan de ajo hecho con masa de pizza', price: '4,80 €', image: '/assets/hamburguesa-pollo-crispy.jpg', allergens: 'G' },
  { id: '9', name: 'Queso', description: 'Pan de ajo hecho con masa de pizza', price: '6,30 €', image: '/assets/lagrimas-pollo-crispy.jpg', allergens: 'G · L' },
  { id: '10', name: 'Jamón y queso', description: 'Pan de ajo hecho con masa de pizza', price: '7,80 €', image: '/assets/fingers-pollo.jpg', allergens: 'G · L' },
  // ... más productos pueden agregarse
];

// Obtener productos (simulación de getProducts() de Neon)
const getProducts = (category?: string) => {
  // Si se especifica una categoría, filtrar por nombre
  if (category) {
    return initialProducts.filter(p => p.name.toLowerCase().includes(category.toLowerCase().split(' ')[0]));
  }
  return initialProducts;
};

// Función para formatear precio
const formatPrice = (price: string) => price;

function App() {
  const { addToCart, total } = useCart();
  const [activeCategory, setActiveCategory] = useState<'Hamburguesas de carne' | 'Hamburguesas de pollo' | 'Perritos' | 'Pan de ajo' | 'Papas' | 'Platos combinados' | 'Bocadillos calientes' | 'Sándwiches calientes' | 'Pizzas' | 'Cafés e infusiones' | 'Refrescos, aguas y zumos' | 'Cervezas' | 'Licores y destilados' | 'Vinos'>('Hamburguesas de carne');
  
  // Obtener productos para la categoría actual
  const products = getProducts(activeCategory);

  // ... resto de la lógica existente

  return (
    <CartProvider>
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

        {/* Sección de la Carta con diseño mejorado */}
        <section className="menu-section section-pad" id="carta">
          <div className="shell">
            <div className="menu-heading">
              <div>
                <p className="eyebrow"><span className="gold-dot" /> Cocina para compartir</p>
                <h2>La carta<span>.</span></h2>
                <p className="section-lede">De un bocado rápido a una pizza para el centro. Aquí empieza el plan.</p>
              </div>
              <a className="button button-outline" href="/assets/carta-las-mesas.pdf" download="carta-las-mesas.pdf" data-testid="link-download-menu">Descargar carta completa <ArrowDown size={16} /></a>
            </div>
            <div className="menu-experience">
              <div className="category-list" role="tablist" aria-label="Categorías de la carta" aria-orientation="vertical">
                {['Hamburguesas de carne', 'Hamburguesas de pollo', 'Perritos', 'Pan de ajo', 'Papas', 'Platos combinados', 'Bocadillos calientes', 'Sándwiches calientes', 'Pizzas', 'Cafés e infusiones', 'Refrescos, aguas y zumos', 'Cervezas', 'Licores y destilados', 'Vinos'].map((category, index) => (
                  <button
                    key={category}
                    className={activeCategory === category ? 'category-tab active' : 'category-tab'}
                    role="tab"
                    tabIndex={activeCategory === category ? 0 : -1}
                    id={`tab-${index}`}
                    aria-selected={activeCategory === category}
                    aria-controls="menu-panel"
                    onClick={() => setActiveCategory(category)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>{category}<ArrowRight size={14} />
                  </button>
                ))}
                <p className="menu-download-note">La carta completa, lista para consultar o guardar.</p>
              </div>
              <div className="menu-panel" role="tabpanel" id="menu-panel" aria-labelledby={`tab-${categories.indexOf(activeCategory)}`} key={activeCategory}>
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">En la mesa</span>
                    <h3>{activeCategory}</h3>
                  </div>
                  <span className="dish-count">{String(products.length).padStart(2, '0')} opciones</span>
                </div>
                <div className="dish-list">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={addToCart}
                      selectedSize="normal"
                      showSizeSelector={false}
                    />
                  ))}
                </div>
                <p className="allergen-note"><b>Alérgenos</b> · G = gluten · H = huevo · L = lácteos · P = pescado · CR = crustáceos · MO = moluscos · S = sulfitos · MZ = mostaza.<br />Información orientativa. Si tienes alergia o intolerancia, avísanos para confirmar los ingredientes.</p>
                {activeCategory === 'Bocadillos calientes' && <p className="allergen-note">Todos los bocadillos se sirven con pan de bombón.</p>}
                <p className="allergen-note">Los asteriscos se muestran tal como aparecen en la carta original.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Resto del componente existente... */}
        {/* ... mantener el resto del componente original */}
        
        <footer className="site-footer">
          <div className="shell footer-main">
            <a href="#inicio" className="footer-brand"><img src="/assets/logo-las-mesas.jpeg" alt="" /><span>Las Mesas · Café & Bar</span></a>
            <p>Comer. Encontrarse. Jugar un rato.</p>
            <nav aria-label="Navegación de pie">
              {[['La casa','#esencia'],['El local','#local'],['La carta','#carta'],['Celebraciones','#celebraciones'],['Reservas','#reserva']].map(([label,href]) => <a key={href} href={href}>{label}</a>)}
            </nav>
          </div>
          <div className="shell footer-details">
            <div className="footer-hours"><span className="footer-label">Horario</span>{hours.map(([day, time]) => <p key={day}><span>{day}</span><strong>{time}</strong></p>)}</div>
            <div className="footer-contact"><span className="footer-label">Contacto</span><a href={phoneHref}>{phone}</a><a href={mapsUrl} target="_blank" rel="noreferrer">Pintor Antonio Padrón, 59 · Cómo llegar</a></div>
            <div className="footer-social">
              <span className="footer-label">Redes y reseñas</span>
              <span>Instagram: <a href={instagramUrl} target="_blank" rel="noreferrer">ver perfil</a></span>
              <span>Facebook: {facebookUrl ? <a href={facebookUrl} target="_blank" rel="noreferrer">ver perfil</a> : 'enlace pendiente de añadir'}</span>
              <span>Reseñas Google: {reviewsUrl ? <a href={reviewsUrl} target="_blank" rel="noreferrer">compartir opinión</a> : 'enlace pendiente de añadir'}</span>
            </div>
          </div>
          <div className="shell footer-bottom">
            <span>© Las Mesas · Café & Bar</span>
            <span>Pintor Antonio Padrón, 59 · Las Mesas Bajas · Las Palmas de Gran Canaria</span>
          </div>
        </footer>
      </main>
    </CartProvider>
  );
}

// Exportar getProducts para que pueda ser usado externamente
export { getProducts };

export default App;