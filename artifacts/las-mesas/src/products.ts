/**
 * Catálogo de productos de la web oficial.
 *
 * Fuente de verdad de PRECIOS e IDs: la tabla `productos` de Supabase (la
 * misma que usa el flujo de n8n para recalcular los importes). Se lee a través
 * de nuestra API /api/productos, porque la clave publica de Supabase no puede
 * leer esa tabla (tiene RLS).
 *
 * Las FOTOS, DESCRIPCIONES, ALERGENOS y la CATEGORÍA (de la carta) salen del
 * catálogo local de este fichero, emparejando por nombre. Así los ids y precios
 * de Supabase se combinan con la分类 correcta de nuestra carta.
 *
 * Si la API no está disponible (Supabase sin configurar o sin red), se usa el
 * catálogo local con los ids guardados en productos-supabase.json.
 */

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  allergens?: string;
  /** Ruta de la foto. null = sin fotografía propia. */
  image_url: string | null;
  category: string;
  category_slug: string;
  /** Precio en euros tal como viene de la base de datos. */
  precio_eur?: number;
  /** false = producto agotado (lo marca el panel de inventario). */
  disponible?: boolean;
}

export interface Category {
  name: string;
  slug: string;
}

export const CATEGORIES: Category[] = [
  { name: 'Hamburguesas de carne', slug: 'hamburguesas-carne' },
  { name: 'Hamburguesas de pollo', slug: 'hamburguesas-pollo' },
  { name: 'Perritos', slug: 'perritos' },
  { name: 'Pan de ajo', slug: 'pan-de-ajo' },
  { name: 'Papas', slug: 'papas' },
  { name: 'Platos combinados', slug: 'platos-combinados' },
  { name: 'Bocadillos calientes', slug: 'bocadillos-calientes' },
  { name: 'Sándwiches calientes', slug: 'sandwiches-calientes' },
  { name: 'Pizzas', slug: 'pizzas' },
  { name: 'Cafés e infusiones', slug: 'cafes-e-infusiones' },
  { name: 'Refrescos, aguas y zumos', slug: 'refrescos-aguas-zumos' },
  { name: 'Cervezas', slug: 'cervezas' },
  { name: 'Licores y destilados', slug: 'licores-y-destilados' },
  { name: 'Vinos', slug: 'vinos' },
];

import IDS_SUPABASE from './productos-supabase.json';

const A = '/assets/';

interface Presentacion {
  image_url: string | null;
  description?: string;
  allergens?: string;
  /** Categoría de la carta (coincide con CATEGORIES). */
  categoria: string;
  precio: number;
}

/**
 * Datos de la carta por nombre de producto: foto, descripción, alérgenos,
 * categoría y precio de referencia.
 */
const PRESENTACION: Record<string, Presentacion> = {
  'La suprema': { image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', allergens: 'G* · H · L · S*', categoria: 'Hamburguesas de carne', precio: 6.5 },
  'La tradicional': { image_url: `${A}hamburguesa-pollo-crispy.jpg`, description: 'Queso, cebolla y 3 salsas', allergens: 'G* · L · S*', categoria: 'Hamburguesas de carne', precio: 3.6 },
  'Burger Pizza': { image_url: `${A}burger-pizza.jpg`, description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', allergens: 'G · H · L · S', categoria: 'Hamburguesas de carne', precio: 12 },
  'La súper': { image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', allergens: 'G* · H · L · S*', categoria: 'Hamburguesas de pollo', precio: 6.5 },
  'La simple': { image_url: `${A}platos-compartir.jpg`, description: 'Queso, cebolla y 3 salsas', allergens: 'G · L · S', categoria: 'Hamburguesas de pollo', precio: 3.6 },
  'Perrito súper': { image_url: `${A}brochetas-pollo.jpg`, description: 'Queso, jamón, cebolla y 3 salsas', allergens: 'G* · L · S*', categoria: 'Perritos', precio: 3.4 },
  'Perrito normal': { image_url: `${A}fingers-pollo.jpg`, description: 'Cebolla y 3 salsas', allergens: 'G* · S*', categoria: 'Perritos', precio: 3 },
  'Pan de ajo normal': { image_url: null, description: 'Pan de ajo hecho con masa de pizza', allergens: 'G', categoria: 'Pan de ajo', precio: 4.8 },
  'Pan de ajo con queso': { image_url: null, description: 'Pan de ajo hecho con masa de pizza', allergens: 'G · L', categoria: 'Pan de ajo', precio: 6.3 },
  'Pan de ajo con jamón y queso': { image_url: null, description: 'Pan de ajo hecho con masa de pizza', allergens: 'G · L', categoria: 'Pan de ajo', precio: 7.8 },
  'Cono de papas': { image_url: null, description: 'Papas fritas', categoria: 'Papas', precio: 1.85 },
  'Papas pequeñas': { image_url: null, description: 'Papas fritas', categoria: 'Papas', precio: 3 },
  'Papas grandes': { image_url: null, description: 'Papas fritas', categoria: 'Papas', precio: 4.2 },
  'Alitas de pollo al chipotle': { image_url: `${A}alitas-pollo-chipotle.jpg`, description: '6 unidades · con papas fritas y ensalada fresca', allergens: 'S*', categoria: 'Platos combinados', precio: 10 },
  'Nuggets de pollo premium': { image_url: `${A}nuggets-pollo-premium.jpg`, description: '10 unidades · con papas fritas y ensalada fresca', allergens: 'G · H* · L*', categoria: 'Platos combinados', precio: 7.5 },
  'Lágrimas de pollo crispy': { image_url: `${A}lagrimas-pollo-crispy.jpg`, description: 'Pollo crujiente', allergens: 'G · H* · L*', categoria: 'Platos combinados', precio: 7.5 },
  'Fingers de pollo': { image_url: `${A}fingers-pollo.jpg`, description: '6 unidades', allergens: 'G · H* · L*', categoria: 'Platos combinados', precio: 9 },
  'Brochetas de pollo': { image_url: `${A}brochetas-pollo.jpg`, description: '3 brochetas', categoria: 'Platos combinados', precio: 9 },
  'Croquetas de pollo o atún': { image_url: `${A}croquetas-pollo.jpg`, description: '8 unidades', allergens: 'G* · H* · L* · P*', categoria: 'Platos combinados', precio: 9.5 },
  'Costilla a la BBQ': { image_url: null, description: '550 g', allergens: 'S* · MZ*', categoria: 'Platos combinados', precio: 15.95 },
  'Codillo asado': { image_url: null, description: '600 g', categoria: 'Platos combinados', precio: 15.95 },
  'El ternera crack': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*', categoria: 'Bocadillos calientes', precio: 4.8 },
  'El ternera simple': { image_url: null, description: 'Cebolla, queso y alioli', allergens: 'G · L · MZ*', categoria: 'Bocadillos calientes', precio: 4.2 },
  'La bomba avícola': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*', categoria: 'Bocadillos calientes', precio: 4.2 },
  'El pollo simple': { image_url: null, description: 'Cebolla, queso y alioli', allergens: 'G · L · MZ*', categoria: 'Bocadillos calientes', precio: 3.7 },
  'El lomo goloso': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*', categoria: 'Bocadillos calientes', precio: 4.5 },
  'El lomo simple': { image_url: null, description: 'Cebolla, queso y alioli', allergens: 'G · L · MZ*', categoria: 'Bocadillos calientes', precio: 3.9 },
  'Sándwich de jamón y queso': { image_url: null, description: 'Jamón y queso', allergens: 'G · L', categoria: 'Sándwiches calientes', precio: 2.9 },
  'Sándwich de atún': { image_url: null, description: 'Atún, cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · P · MZ*', categoria: 'Sándwiches calientes', precio: 3.5 },
  'Sándwich de pollo': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*', categoria: 'Sándwiches calientes', precio: 3.8 },
  'Sándwich de ternera': { image_url: null, description: 'Cebolla, tomate natural, huevo, queso y alioli', allergens: 'G · H · L · MZ*', categoria: 'Sándwiches calientes', precio: 4.2 },
  'Sándwich de lomo': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*', categoria: 'Sándwiches calientes', precio: 3.9 },
  'Pizza La bella serrana': { image_url: null, description: 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', allergens: 'G · L', categoria: 'Pizzas', precio: 11.5 },
  'Pizza La tradicional': { image_url: null, description: 'Tomate, mozzarella, champiñones, jamón y aceitunas', allergens: 'G · L', categoria: 'Pizzas', precio: 10.3 },
  'Pizza La parrillera': { image_url: null, description: 'Tomate, mozzarella, champiñones, pimiento, cebolla, pollo y ternera', allergens: 'G · L', categoria: 'Pizzas', precio: 11 },
  'Pizza La simple': { image_url: null, description: 'Tomate, mozzarella, ajo y tomate natural', allergens: 'G · L', categoria: 'Pizzas', precio: 10 },
  'Pizza La delicia': { image_url: null, description: 'Tomate, mozzarella, atún y aceitunas', allergens: 'G · L · P', categoria: 'Pizzas', precio: 10.3 },
  'Pizza Mar azul': { image_url: null, description: 'Tomate, mozzarella, atún, cangrejo, mejillones y gambas', allergens: 'G · L · P · CR · MO', categoria: 'Pizzas', precio: 12.9 },
  'Pizza La ranchera': { image_url: null, description: 'BBQ, mozzarella, ternera, cebolla y salchicha', allergens: 'G · L · S* · MZ*', categoria: 'Pizzas', precio: 10.8 },
  'Pizza Venecia': { image_url: null, description: 'Tomate, mozzarella, jamón y bacon', allergens: 'G · L', categoria: 'Pizzas', precio: 10.5 },
  'Café': { image_url: null, categoria: 'Cafés e infusiones', precio: 1 },
  'Cortado corto': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.1 },
  'Cortado largo': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.2 },
  'Leche y leche corto': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.3 },
  'Leche y leche largo': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.4 },
  'Café con leche': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.4 },
  'Chocolate': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.5 },
  'Infusiones': { image_url: null, categoria: 'Cafés e infusiones', precio: 1.2 },
  'Cortado vaso': { image_url: null, categoria: 'Cafés e infusiones', precio: 2 },
  'Coca-Cola': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 2 },
  'Sprite': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.5 },
  'Fanta limón': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.5 },
  'Fanta naranja': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.5 },
  'Tónica': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.5 },
  'Agua pequeña': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.5 },
  'Agua grande': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 2 },
  'Energética': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.4 },
  'Zumos': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 1.8 },
  'Zumo naranja': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 3.2 },
  'Red Bull': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 2.4 },
  'Vaso de agua': { image_url: null, categoria: 'Refrescos, aguas y zumos', precio: 0.3 },
  'Tropical': { image_url: null, categoria: 'Cervezas', precio: 1.4 },
  'Tropical limón': { image_url: null, categoria: 'Cervezas', precio: 1.5 },
  'Botellín Tropical': { image_url: null, categoria: 'Cervezas', precio: 1.2 },
  'Dorada sin': { image_url: null, categoria: 'Cervezas', precio: 1.4 },
  'Dorada normal': { image_url: null, categoria: 'Cervezas', precio: 1.8 },
  'Dorada especial': { image_url: null, categoria: 'Cervezas', precio: 1.8 },
  'Estrella': { image_url: null, categoria: 'Cervezas', precio: 1.3 },
  'Estrella mini': { image_url: null, categoria: 'Cervezas', precio: 1 },
  '1906': { image_url: null, categoria: 'Cervezas', precio: 2.9 },
  'Corona': { image_url: null, categoria: 'Cervezas', precio: 3 },
  'Ron blanco / oro': { image_url: null, categoria: 'Licores y destilados', precio: 1.5 },
  'Ginebra': { image_url: null, categoria: 'Licores y destilados', precio: 3 },
  'Whisky': { image_url: null, categoria: 'Licores y destilados', precio: 2 },
  'Coñac': { image_url: null, categoria: 'Licores y destilados', precio: 1.5 },
  'Amaretto': { image_url: null, categoria: 'Licores y destilados', precio: 3.8 },
  'Frangelico': { image_url: null, categoria: 'Licores y destilados', precio: 3.8 },
  'Tía María': { image_url: null, categoria: 'Licores y destilados', precio: 3.8 },
  'Baileys': { image_url: null, categoria: 'Licores y destilados', precio: 3.8 },
  'Marie Brizard': { image_url: null, categoria: 'Licores y destilados', precio: 2.8 },
  'Chinchón dulce': { image_url: null, categoria: 'Licores y destilados', precio: 1.5 },
  'Vodka': { image_url: null, categoria: 'Licores y destilados', precio: 2 },
  'Santa Teresa': { image_url: null, categoria: 'Licores y destilados', precio: 3 },
  'Malibú': { image_url: null, categoria: 'Licores y destilados', precio: 3 },
  'Tequila': { image_url: null, categoria: 'Licores y destilados', precio: 3 },
  'Etiqueta negra': { image_url: null, categoria: 'Licores y destilados', precio: 3.5 },
  'Etiqueta roja': { image_url: null, categoria: 'Licores y destilados', precio: 2 },
  'Cardhu': { image_url: null, categoria: 'Licores y destilados', precio: 5.5 },
  'Jack Daniel’s': { image_url: null, categoria: 'Licores y destilados', precio: 4.5 },
  'Viña Lobón': { image_url: null, categoria: 'Vinos', precio: 8 },
  'Mala Bestia': { image_url: null, categoria: 'Vinos', precio: 9 },
  'Palacio de Beltús': { image_url: null, categoria: 'Vinos', precio: 9 },
  'Conde de Basalu': { image_url: null, categoria: 'Vinos', precio: 9 },
  'Luis Caña': { image_url: null, categoria: 'Vinos', precio: 24 },
  'Despecho': { image_url: null, categoria: 'Vinos', precio: 18 },
  'Azpilicueta': { image_url: null, categoria: 'Vinos', precio: 27 },
  'Esencia 27': { image_url: null, categoria: 'Vinos', precio: 18 },
  'Iniesta': { image_url: null, categoria: 'Vinos', precio: 18 },
  'Dulce Malicia': { image_url: null, categoria: 'Vinos', precio: 24 },
};

/** Genera el slug de una categoría a partir de su nombre. */
export function slugCategoria(nombre: string): string {
  const encontrada = CATEGORIES.find((c) => c.name === nombre);
  if (encontrada) return encontrada.slug;
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Formatea un precio en euros como "6,50 €". */
export function formatearPrecio(precio: number): string {
  return `${precio.toFixed(2).replace('.', ',')} €`;
}

/** Catálogo local de respaldo (mismos datos que Supabase). */
export const PRODUCTS_LOCALES: Product[] = Object.entries(PRESENTACION).map(
  ([nombre, datos]) => ({
    id: String((IDS_SUPABASE as Record<string, number>)[nombre] ?? ''),
    name: nombre,
    description: datos.description,
    price: formatearPrecio(datos.precio),
    allergens: datos.allergens,
    image_url: datos.image_url,
    category: datos.categoria,
    category_slug: slugCategoria(datos.categoria),
    precio_eur: datos.precio,
    disponible: true,
  }),
);

/**
 * Descarga el catálogo desde nuestra API (que lee Supabase) y lo enriquece con
 * las fotos, descripciones y la categoría de la carta.
 */
export async function getProductos(): Promise<Product[]> {
  try {
    const respuesta = await fetch('/api/productos');
    if (respuesta.ok) {
      const remotos: any[] = await respuesta.json();
      if (Array.isArray(remotos) && remotos.length) {
        return remotos.map((p) => {
          const presentacion = PRESENTACION[String(p.nombre)];
          // La categoría siempre es la de nuestra carta si el producto la tiene.
          const categoriaNombre = presentacion?.categoria ?? p.categoria ?? 'La carta';
          const precio = presentacion?.precio ?? Number(p.precio);
          return {
            id: String(p.id),
            name: String(p.nombre),
            // La descripcion y la foto pueden venir ya de la base de datos.
            description: p.descripcion ?? presentacion?.description,
            price: formatearPrecio(precio),
            allergens: presentacion?.allergens,
            image_url: p.imagen ?? presentacion?.image_url ?? null,
            category: categoriaNombre,
            category_slug: slugCategoria(categoriaNombre),
            precio_eur: precio,
            // Agotado: el panel de inventario lo cambia en la base de datos.
            disponible: p.disponible !== false,
          };
        });
      }
    }
  } catch {
    /* sin red: usamos el catalogo local */
  }

  return PRODUCTS_LOCALES;
}

/**
 * La carta se puede cambiar desde el panel de inventario en cualquier
 * momento. Aqui se avisa a las pestanas abiertas para que recarguen el
 * catalogo (en una SPA no hay revalidateTag, pero el efecto es el mismo).
 */
export const EVENTO_MENU_ACTUALIZADO = 'lm:menu-actualizado';
const CLAVE_REFRESCO = 'lm_menu_refresh';

/** Avisa de que la carta ha cambiado. */
export function notificarMenuActualizado(): void {
  try {
    localStorage.setItem(CLAVE_REFRESCO, String(Date.now()));
  } catch {
    /* sin localStorage */
  }
  try {
    const canal = new BroadcastChannel('lm-menu');
    canal.postMessage({ tipo: EVENTO_MENU_ACTUALIZADO });
    canal.close();
  } catch {
    /* sin BroadcastChannel */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_MENU_ACTUALIZADO));
  }
}

/** Se suscribe a los avisos de cambio de la carta y devuelve lacleanup. */
export function alCambiarMenu(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const alEvento = () => fn();
  const alGuardar = (e: StorageEvent) => {
    if (e.key === CLAVE_REFRESCO) fn();
  };
  window.addEventListener(EVENTO_MENU_ACTUALIZADO, alEvento);
  window.addEventListener('storage', alGuardar);

  let canal: BroadcastChannel | null = null;
  try {
    canal = new BroadcastChannel('lm-menu');
    canal.onmessage = () => fn();
  } catch {
    /* sin BroadcastChannel */
  }

  return () => {
    window.removeEventListener(EVENTO_MENU_ACTUALIZADO, alEvento);
    window.removeEventListener('storage', alGuardar);
    canal?.close();
  };
}

/** Categorías presentes en un conjunto de productos. */
export function categoriasDe(productos: Product[]): Category[] {
  const vistas = new Map<string, Category>();
  for (const producto of productos) {
    if (!vistas.has(producto.category_slug)) {
      vistas.set(producto.category_slug, {
        name: producto.category,
        slug: producto.category_slug,
      });
    }
  }
  return [...vistas.values()];
}

/** Iniciales para el marcador de posición elegante cuando no hay foto. */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? '')
    .join('');
}
