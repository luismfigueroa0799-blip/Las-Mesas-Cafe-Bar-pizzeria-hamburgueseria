/**
 * Catálogo de productos de la web oficial.
 *
 * Fuente de verdad de PRECIOS e IDs: la tabla `productos` de Supabase (la
 * misma que usa el flujo de n8n para recalcular los importes). Se lee a través
 * de nuestra API /api/productos, porque la clave publica de Supabase no puede
 * leer esa tabla (tiene RLS).
 *
 * Las FOTOS, DESCRIPCIONES y ALERGENOS sesacan del catálogo local de este
 * fichero, emparejando por nombre.
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
  /** Ruta de la foto (columna image_url). null = sin fotografía propia. */
  image_url: string | null;
  category: string;
  category_slug: string;
  /** Precio en euros tal como viene de la base de datos. */
  precio_eur?: number;
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

const A = '/assets/';

/** Datos de presentación (foto, descripción, alérgenos) por nombre de producto. */
const PRESENTACION: Record<
  string,
  { image_url: string | null; description?: string; allergens?: string }
> = {
  'La suprema': { image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', allergens: 'G* · H · L · S*' },
  'La tradicional': { image_url: `${A}hamburguesa-pollo-crispy.jpg`, description: 'Queso, cebolla y 3 salsas', allergens: 'G* · L · S*' },
  'Burger Pizza': { image_url: `${A}burger-pizza.jpg`, description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', allergens: 'G · H · L · S' },
  'La súper': { image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', allergens: 'G* · H · L · S*' },
  'La simple': { image_url: `${A}platos-compartir.jpg`, description: 'Queso, cebolla y 3 salsas', allergens: 'G · L · S' },
  'Perrito súper': { image_url: `${A}brochetas-pollo.jpg`, description: 'Queso, jamón, cebolla y 3 salsas', allergens: 'G* · L · S*' },
  'Perrito normal': { image_url: `${A}fingers-pollo.jpg`, description: 'Cebolla y 3 salsas', allergens: 'G* · S*' },
  'Pan de ajo normal': { image_url: null, description: 'Pan de ajo hecho con masa de pizza', allergens: 'G' },
  'Pan de ajo con queso': { image_url: null, description: 'Pan de ajo hecho con masa de pizza', allergens: 'G · L' },
  'Pan de ajo con jamón y queso': { image_url: null, description: 'Pan de ajo hecho con masa de pizza', allergens: 'G · L' },
  'Cono de papas': { image_url: null, description: 'Papas fritas' },
  'Papas pequeñas': { image_url: null, description: 'Papas fritas' },
  'Papas grandes': { image_url: null, description: 'Papas fritas' },
  'Alitas de pollo al chipotle': { image_url: `${A}alitas-pollo-chipotle.jpg`, description: '6 unidades · con papas fritas y ensalada fresca', allergens: 'S*' },
  'Nuggets de pollo premium': { image_url: `${A}nuggets-pollo-premium.jpg`, description: '10 unidades · con papas fritas y ensalada fresca', allergens: 'G · H* · L*' },
  'Lágrimas de pollo crispy': { image_url: `${A}lagrimas-pollo-crispy.jpg`, description: 'Pollo crujiente', allergens: 'G · H* · L*' },
  'Fingers de pollo': { image_url: `${A}fingers-pollo.jpg`, description: '6 unidades', allergens: 'G · H* · L*' },
  'Brochetas de pollo': { image_url: `${A}brochetas-pollo.jpg`, description: '3 brochetas' },
  'Croquetas de pollo o atún': { image_url: `${A}croquetas-pollo.jpg`, description: '8 unidades', allergens: 'G* · H* · L* · P*' },
  'Costilla a la BBQ': { image_url: null, description: '550 g', allergens: 'S* · MZ*' },
  'Codillo asado': { image_url: null, description: '600 g' },
  'El ternera crack': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*' },
  'El ternera simple': { image_url: null, description: 'Cebolla, queso y alioli', allergens: 'G · L · MZ*' },
  'La bomba avícola': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*' },
  'El pollo simple': { image_url: null, description: 'Cebolla, queso y alioli', allergens: 'G · L · MZ*' },
  'El lomo goloso': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*' },
  'El lomo simple': { image_url: null, description: 'Cebolla, queso y alioli', allergens: 'G · L · MZ*' },
  'Sándwich de jamón y queso': { image_url: null, description: 'Jamón y queso', allergens: 'G · L' },
  'Sándwich de atún': { image_url: null, description: 'Atún, cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · P · MZ*' },
  'Sándwich de pollo': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*' },
  'Sándwich de ternera': { image_url: null, description: 'Cebolla, tomate natural, huevo, queso y alioli', allergens: 'G · H · L · MZ*' },
  'Sándwich de lomo': { image_url: null, description: 'Cebolla, tomate natural, queso, huevo y alioli', allergens: 'G · H · L · MZ*' },
  'Pizza La bella serrana': { image_url: null, description: 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', allergens: 'G · L' },
  'Pizza La tradicional': { image_url: null, description: 'Tomate, mozzarella, champiñones, jamón y aceitunas', allergens: 'G · L' },
  'Pizza La parrillera': { image_url: null, description: 'Tomate, mozzarella, champiñones, pimiento, cebolla, pollo y ternera', allergens: 'G · L' },
  'Pizza La simple': { image_url: null, description: 'Tomate, mozzarella, ajo y tomate natural', allergens: 'G · L' },
  'Pizza La delicia': { image_url: null, description: 'Tomate, mozzarella, atún y aceitunas', allergens: 'G · L · P' },
  'Pizza Mar azul': { image_url: null, description: 'Tomate, mozzarella, atún, cangrejo, mejillones y gambas', allergens: 'G · L · P · CR · MO' },
  'Pizza La ranchera': { image_url: null, description: 'BBQ, mozzarella, ternera, cebolla y salchicha', allergens: 'G · L · S* · MZ*' },
  'Pizza Venecia': { image_url: null, description: 'Tomate, mozzarella, jamón y bacon', allergens: 'G · L' },
};

/** Mapea nombres de la carta a los ids de la tabla `productos` de Supabase. */
const IDS_SUPABASE: Record<string, number> = {
  'La suprema': 4, 'La tradicional': 5, 'Burger Pizza': 6, 'La súper': 7, 'La simple': 8,
  'Perrito súper': 9, 'Perrito normal': 10, 'Pan de ajo normal': 11, 'Pan de ajo con queso': 12,
  'Pan de ajo con jamón y queso': 13, 'Cono de papas': 14, 'Papas pequeñas': 15, 'Papas grandes': 16,
  'Alitas de pollo al chipotle': 17, 'Nuggets de pollo premium': 18, 'Lágrimas de pollo crispy': 19,
  'Fingers de pollo': 20, 'Brochetas de pollo': 21, 'Croquetas de pollo o atún': 22,
  'Costilla a la BBQ': 23, 'Codillo asado': 24, 'El ternera crack': 25, 'El ternera simple': 26,
  'La bomba avícola': 27, 'El pollo simple': 28, 'El lomo goloso': 29, 'El lomo simple': 30,
  'Sándwich de jamón y queso': 31, 'Sándwich de atún': 32, 'Sándwich de pollo': 33,
  'Sándwich de ternera': 34, 'Sándwich de lomo': 35, 'Pizza La bella serrana': 36,
  'Pizza La tradicional': 37, 'Pizza La parrillera': 38, 'Pizza La simple': 39,
  'Pizza La delicia': 40, 'Pizza Mar azul': 41, 'Pizza La ranchera': 42, 'Pizza Venecia': 43,
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
function formatearPrecio(precio: number): string {
  return `${precio.toFixed(2).replace('.', ',')} €`;
}

/**
 * Catálogo local de respaldo: mismos productos que la base de datos, con los
 * ids de Supabase para que n8n los pueda validar.
 */
export const PRODUCTS_LOCALES: Product[] = Object.entries(PRESENTACION).map(
  ([nombre, datos], indice) => {
    const id = IDS_SUPABASE[nombre] ?? indice + 1;
    const categoria = CATEGORIES.find((c) =>
      Object.keys(PRESENTACION).some(
        (n) => n === nombre && n.startsWith(c.name.split(' ')[0]),
      ),
    );
    const categoriaNombre = categoria?.name ?? 'La carta';
    return {
      id: String(id),
      name: nombre,
      description: datos.description,
      price: '',
      allergens: datos.allergens,
      image_url: datos.image_url,
      category: categoriaNombre,
      category_slug: slugCategoria(categoriaNombre),
    };
  },
);

/**
 * Descarga el catálogo desde nuestra API (que lee Supabase) y lo enriquece con
 * las fotos y descripciones locales.
 */
export async function getProductos(): Promise<Product[]> {
  try {
    const respuesta = await fetch('/api/productos');
    if (respuesta.ok) {
      const remotos: any[] = await respuesta.json();
      if (Array.isArray(remotos) && remotos.length) {
        return remotos.map((p) => {
          const presentacion = PRESENTACION[p.nombre] ?? {};
          const categoriaNombre = p.categoria || 'La carta';
          return {
            id: String(p.id),
            name: String(p.nombre),
            description: presentacion.description,
            price: formatearPrecio(Number(p.precio)),
            allergens: presentacion.allergens,
            image_url: presentacion.image_url ?? null,
            category: categoriaNombre,
            category_slug: slugCategoria(categoriaNombre),
            precio_eur: Number(p.precio),
          };
        });
      }
    }
  } catch {
    /* sin red: usamos el catalogo local */
  }

  // Respaldo: el catalogo local, con el precio que figura en la carta.
  const PRECIOS: Record<string, number> = {
    'La suprema': 6.5, 'La tradicional': 3.6, 'Burger Pizza': 12, 'La súper': 6.5, 'La simple': 3.6,
    'Perrito súper': 3.4, 'Perrito normal': 3, 'Pan de ajo normal': 4.8, 'Pan deajo con queso': 6.3,
    'Pan de ajo con queso': 6.3, 'Pan de ajo con jamón y queso': 7.8, 'Cono de papas': 1.85,
    'Papas pequeñas': 3, 'Papas grandes': 4.2, 'Alitas de pollo al chipotle': 10,
    'Nuggets de pollo premium': 7.5, 'Lágrimas de pollo crispy': 7.5, 'Fingers de pollo': 9,
    'Brochetas de pollo': 9, 'Croquetas de pollo o atún': 9.5, 'Costilla a la BBQ': 15.95,
    'Codillo asado': 15.95, 'El ternera crack': 4.8, 'El ternera simple': 4.2, 'La bomba avícola': 4.2,
    'El pollo simple': 3.7, 'El lomo goloso': 4.5, 'El lomo simple': 3.9,
    'Sándwich de jamón y queso': 2.9, 'Sándwich de atún': 3.5, 'Sándwich de pollo': 3.8,
    'Sándwich de ternera': 4.2, 'Sándwich de lomo': 3.9, 'Pizza La bella serrana': 11.5,
    'Pizza La tradicional': 10.3, 'Pizza La parrillera': 11, 'Pizza La simple': 10,
    'Pizza La delicia': 10.3, 'Pizza Mar azul': 12.9, 'Pizza La ranchera': 10.8, 'Pizza Venecia': 10.5,
  };

  return PRODUCTS_LOCALES.map((p) => ({
    ...p,
    price: formatearPrecio(PRECIOS[p.name] ?? 0),
    precio_eur: PRECIOS[p.name] ?? 0,
  }));
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
