/**
 * Catálogo de productos.
 *
 * Fuente de verdad: la tabla `productos` de Supabase, que es la misma que usa
 * el flujo de n8n. Por eso los `id` que se envían a n8n deben ser los de la
 * base de datos (n8n los usa para recalcular los precios y crear el pedido).
 *
 * Si Supabase no está configurado se usa el catálogo local como respaldo y el
 * pago se tramita por nuestra propia API (/api/checkout).
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

/** Catálogo local de respaldo (si no hay Supabase configurado). */
export const PRODUCTS_LOCALES: Product[] = [
  { id: '1', name: 'La suprema', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*', image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, category: 'Hamburguesas de carne', category_slug: 'hamburguesas-carne' },
  { id: '2', name: 'La tradicional', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G* · L · S*', image_url: `${A}hamburguesa-pollo-crispy.jpg`, category: 'Hamburguesas de carne', category_slug: 'hamburguesas-carne' },
  { id: '3', name: 'Burger Pizza', description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', price: '12,00 €', allergens: 'G · H · L · S', image_url: `${A}burger-pizza.jpg`, category: 'Hamburguesas de carne', category_slug: 'hamburguesas-carne' },
  { id: '4', name: 'La súper', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*', image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, category: 'Hamburguesas de pollo', category_slug: 'hamburguesas-pollo' },
  { id: '5', name: 'La simple', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G · L · S', image_url: `${A}platos-compartir.jpg`, category: 'Hamburguesas de pollo', category_slug: 'hamburguesas-pollo' },
  { id: '6', name: 'Perrito súper', description: 'Queso, jamón, cebolla y 3 salsas', price: '3,40 €', allergens: 'G* · L · S*', image_url: `${A}brochetas-pollo.jpg`, category: 'Perritos', category_slug: 'perritos' },
  { id: '7', name: 'Perrito normal', description: 'Cebolla y 3 salsas', price: '3,00 €', allergens: 'G* · S*', image_url: `${A}fingers-pollo.jpg`, category: 'Perritos', category_slug: 'perritos' },
  { id: '8', name: 'Normal', description: 'Pan de ajo hecho con masa de pizza', price: '4,80 €', allergens: 'G', image_url: null, category: 'Pan de ajo', category_slug: 'pan-de-ajo' },
  { id: '9', name: 'Queso', description: 'Pan de ajo hecho con masa de pizza', price: '6,30 €', allergens: 'G · L', image_url: null, category: 'Pan de ajo', category_slug: 'pan-de-ajo' },
  { id: '10', name: 'Jamón y queso', description: 'Pan de ajo hecho con masa de pizza', price: '7,80 €', allergens: 'G · L', image_url: null, category: 'Pan de ajo', category_slug: 'pan-de-ajo' },
  { id: '11', name: 'Cono de papas', description: 'Papas fritas', price: '1,85 €', image_url: null, category: 'Papas', category_slug: 'papas' },
  { id: '12', name: 'Pequeña', description: 'Papas fritas', price: '3,00 €', image_url: null, category: 'Papas', category_slug: 'papas' },
  { id: '13', name: 'Grande', description: 'Papas fritas', price: '4,20 €', image_url: null, category: 'Papas', category_slug: 'papas' },
  { id: '14', name: 'Alitas de pollo al chipotle', description: '6 unidades · con papas fritas y ensalada fresca', price: '10,00 €', allergens: 'S*', image_url: `${A}alitas-pollo-chipotle.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '15', name: 'Nuggets de pollo premium', description: '10 unidades · con papas fritas y ensalada fresca', price: '7,50 €', allergens: 'G · H* · L*', image_url: `${A}nuggets-pollo-premium.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '16', name: 'Lágrimas de pollo crispy', description: 'Pollo crujiente', price: '7,50 €', allergens: 'G · H* · L*', image_url: `${A}lagrimas-pollo-crispy.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '17', name: 'Fingers de pollo', description: '6 unidades', price: '9,00 €', allergens: 'G · H* · L*', image_url: `${A}fingers-pollo.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '18', name: 'Brochetas de pollo', description: '3 brochetas', price: '9,00 €', image_url: `${A}brochetas-pollo.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '19', name: 'Croquetas de pollo o atún', description: '8 unidades', price: '9,50 €', allergens: 'G* · H* · L* · P*', image_url: `${A}croquetas-pollo.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '20', name: 'Costilla a la BBQ', description: '550 g', price: '15,95 €', allergens: 'S* · MZ*', image_url: null, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '21', name: 'Codillo asado', description: '600 g', price: '15,95 €', image_url: null, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: '22', name: 'El ternera crack', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,80 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: '23', name: 'El ternera simple', description: 'Cebolla, queso y alioli', price: '4,20 €', allergens: 'G · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: '24', name: 'La bomba avícola', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,20 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: '25', name: 'El pollo simple', description: 'Cebolla, queso y alioli', price: '3,70 €', allergens: 'G · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: '26', name: 'El lomo goloso', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,50 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: '27', name: 'El lomo simple', description: 'Cebolla, queso y alioli', price: '3,90 €', allergens: 'G · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: '28', name: 'Jamón y queso', description: 'Jamón y queso', price: '2,90 €', allergens: 'G · L', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: '29', name: 'El de atún', description: 'Atún, cebolla, tomate natural, queso, huevo y alioli', price: '3,50 €', allergens: 'G · H · L · P · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: '30', name: 'El de pollo', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '3,80 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: '31', name: 'El de ternera', description: 'Cebolla, tomate natural, huevo, queso y alioli', price: '4,20 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: '32', name: 'El de lomo', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '3,90 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: '33', name: 'La bella serrana', description: 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', price: '11,50 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '34', name: 'La tradicional', description: 'Tomate, mozzarella, champiñones, jamón y aceitunas', price: '10,30 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '35', name: 'La parrillera', description: 'Tomate, mozzarella, champiñones, pimiento, cebolla, pollo y ternera', price: '11,00 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '36', name: 'La simple', description: 'Tomate, mozzarella, ajo y tomate natural', price: '10,00 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '37', name: 'La delicia', description: 'Tomate, mozzarella, atún y aceitunas', price: '10,30 €', allergens: 'G · L · P', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '38', name: 'Mar azul', description: 'Tomate, mozzarella, atún, cangrejo, mejillones y gambas', price: '12,90 €', allergens: 'G · L · P · CR · MO', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '39', name: 'La ranchera', description: 'BBQ, mozzarella, ternera, cebolla y salchicha', price: '10,80 €', allergens: 'G · L · S* · MZ*', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '40', name: 'Venecia', description: 'Tomate, mozzarella, jamón y bacon', price: '10,50 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: '41', name: 'Café', price: '1,00 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '42', name: 'Cortado corto', price: '1,10 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '43', name: 'Cortado largo', price: '1,20 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '44', name: 'Leche y leche corto', price: '1,30 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '45', name: 'Leche y leche largo', price: '1,40 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '46', name: 'Café con leche', price: '1,40 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '47', name: 'Chocolate', price: '1,50 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '48', name: 'Infusiones', price: '1,20 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '49', name: 'Cortado vaso', price: '2,00 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: '50', name: 'Coca-Cola', price: '2,00 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '51', name: 'Sprite', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '52', name: 'Fanta limón', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '53', name: 'Fanta naranja', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '54', name: 'Tónica', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '55', name: 'Agua pequeña', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '56', name: 'Agua grande', price: '2,00 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '57', name: 'Energética', price: '1,40 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '58', name: 'Zumos', price: '1,80 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '59', name: 'Zumo naranja', price: '3,20 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '60', name: 'Red Bull', price: '2,40 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '61', name: 'Vaso de agua', price: '0,30 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: '62', name: 'Tropical', price: '1,40 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '63', name: 'Tropical limón', price: '1,50 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '64', name: 'Botellín Tropical', price: '1,20 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '65', name: 'Dorada sin', price: '1,40 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '66', name: 'Dorada normal', price: '1,80 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '67', name: 'Dorada especial', price: '1,80 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '68', name: 'Estrella', price: '1,30 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '69', name: 'Estrella mini', price: '1,00 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '70', name: '1906', price: '2,90 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '71', name: 'Corona', price: '3,00 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: '72', name: 'Ron blanco / oro', price: '1,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '73', name: 'Ginebra', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '74', name: 'Whisky', price: '2,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '75', name: 'Coñac', price: '1,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '76', name: 'Amaretto', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '77', name: 'Frangelico', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '78', name: 'Tía María', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '79', name: 'Baileys', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '80', name: 'Marie Brizard', price: '2,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '81', name: 'Chinchón dulce', price: '1,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '82', name: 'Vodka', price: '2,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '83', name: 'Santa Teresa', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '84', name: 'Malibú', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '85', name: 'Tequila', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '86', name: 'Etiqueta negra', price: '3,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '87', name: 'Etiqueta roja', price: '2,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '88', name: 'Cardhu', price: '5,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '89', name: 'Jack Daniel’s', price: '4,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: '90', name: 'Viña Lobón', price: '8,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '91', name: 'Mala Bestia', price: '9,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '92', name: 'Palacio de Beltús', price: '9,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '93', name: 'Conde de Basalu', price: '9,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '94', name: 'Luis Caña', price: '24,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '95', name: 'Despecho', price: '18,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '96', name: 'Azpilicueta', price: '27,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '97', name: 'Esencia 27', price: '18,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '98', name: 'Iniesta', price: '18,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: '99', name: 'Dulce Malicia', price: '24,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
];

/** Configuración de Supabase (opcional). */
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Convierte un slug de categoría en un nombre legible. */
function nombreCategoria(slug: string): string {
  const encontrada = CATEGORIES.find((c) => c.slug === slug);
  if (encontrada) return encontrada.name;
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Descarga la carta desde Supabase usando su API REST (sin dependencias).
 * Devuelve null si no está configurado o si hay error.
 */
export async function getProductosRemotos(): Promise<Product[] | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/productos` +
      `?select=*&disponible=eq.true&order=categoria&order=nombre`;
    const respuesta = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!respuesta.ok) return null;

    const filas: any[] = await respuesta.json();
    if (!Array.isArray(filas) || !filas.length) return null;

    return filas.map((fila) => ({
      id: String(fila.id),
      name: String(fila.nombre),
      description: fila.descripcion ?? undefined,
      price: `${Number(fila.precio).toFixed(2).replace('.', ',')} €`,
      allergens: fila.alergenos ?? undefined,
      image_url: fila.image_url ?? null,
      category: fila.categoria ?? 'La carta',
      category_slug: slugCategoria(fila.categoria ?? 'la-carta'),
      precio_eur: Number(fila.precio),
    }));
  } catch {
    return null;
  }
}

/** Genera el slug de una categoría a partir de su nombre. */
export function slugCategoria(nombre: string): string {
  const normalizado = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const encontrada = CATEGORIES.find((c) => nombreCategoria(c.slug) === nombre);
  return encontrada ? encontrada.slug : normalizado;
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

/**
 * Devuelve los productos de una categoría.
 * En producción consulta la tabla `productos` de Supabase (misma que usa n8n);
 * si no está configurado, usa el catálogo local.
 */
export async function getProducts(
  categorySlug?: string,
): Promise<Product[]> {
  const remotos = await getProductosRemotos();
  const origen = remotos ?? PRODUCTS_LOCALES;
  if (!categorySlug) return origen;
  return origen.filter((producto) => producto.category_slug === categorySlug);
}

/** Versión síncrona con el catálogo local (para render inicial). */
export function getProductsLocal(categorySlug?: string): Product[] {
  if (!categorySlug) return PRODUCTS_LOCALES;
  return PRODUCTS_LOCALES.filter((p) => p.category_slug === categorySlug);
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
