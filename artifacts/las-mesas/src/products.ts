// Catálogo de productos. La forma del registro imita la tabla de Neon:
// cada producto tiene `image_url` (ruta de la foto) y puede ser null si
// todavía no hay fotografía propia de ese plato.

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  allergens?: string;
  /** Ruta de la imagen del producto (columna image_url en Neon). */
  image_url: string | null;
  category: string;
  category_slug: string;
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

export const PRODUCTS: Product[] = [
  // ---------- Hamburguesas de carne ----------
  { id: 'hc-1', name: 'La suprema', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*', image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, category: 'Hamburguesas de carne', category_slug: 'hamburguesas-carne' },
  { id: 'hc-2', name: 'La tradicional', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G* · L · S*', image_url: `${A}hamburguesa-pollo-crispy.jpg`, category: 'Hamburguesas de carne', category_slug: 'hamburguesas-carne' },
  { id: 'hc-3', name: 'Burger Pizza', description: 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', price: '12,00 €', allergens: 'G · H · L · S', image_url: `${A}burger-pizza.jpg`, category: 'Hamburguesas de carne', category_slug: 'hamburguesas-carne' },

  // ---------- Hamburguesas de pollo ----------
  { id: 'hp-1', name: 'La súper', description: 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', price: '6,50 €', allergens: 'G* · H · L · S*', image_url: `${A}hamburguesa-pollo-crispy-super.jpg`, category: 'Hamburguesas de pollo', category_slug: 'hamburguesas-pollo' },
  { id: 'hp-2', name: 'La simple', description: 'Queso, cebolla y 3 salsas', price: '3,60 €', allergens: 'G · L · S', image_url: `${A}hamburguesa-pollo-crispy.jpg`, category: 'Hamburguesas de pollo', category_slug: 'hamburguesas-pollo' },

  // ---------- Perritos ----------
  { id: 'pe-1', name: 'Perrito súper', description: 'Queso, jamón, cebolla y 3 salsas', price: '3,40 €', allergens: 'G* · L · S*', image_url: `${A}brochetas-pollo.jpg`, category: 'Perritos', category_slug: 'perritos' },
  { id: 'pe-2', name: 'Perrito normal', description: 'Cebolla y 3 salsas', price: '3,00 €', allergens: 'G* · S*', image_url: `${A}fingers-pollo.jpg`, category: 'Perritos', category_slug: 'perritos' },

  // ---------- Pan de ajo ----------
  { id: 'pa-1', name: 'Normal', description: 'Pan de ajo hecho con masa de pizza', price: '4,80 €', allergens: 'G', image_url: null, category: 'Pan de ajo', category_slug: 'pan-de-ajo' },
  { id: 'pa-2', name: 'Queso', description: 'Pan de ajo hecho con masa de pizza', price: '6,30 €', allergens: 'G · L', image_url: null, category: 'Pan de ajo', category_slug: 'pan-de-ajo' },
  { id: 'pa-3', name: 'Jamón y queso', description: 'Pan de ajo hecho con masa de pizza', price: '7,80 €', allergens: 'G · L', image_url: null, category: 'Pan de ajo', category_slug: 'pan-de-ajo' },

  // ---------- Papas ----------
  { id: 'pa-p1', name: 'Cono de papas', description: 'Papas fritas', price: '1,85 €', image_url: null, category: 'Papas', category_slug: 'papas' },
  { id: 'pa-p2', name: 'Pequeña', description: 'Papas fritas', price: '3,00 €', image_url: null, category: 'Papas', category_slug: 'papas' },
  { id: 'pa-p3', name: 'Grande', description: 'Papas fritas', price: '4,20 €', image_url: null, category: 'Papas', category_slug: 'papas' },
  { id: 'pa-p4', name: 'Extras', description: 'Cebolla 0,50 € · huevo 0,50 € · jamón 1,10 € · queso 1,10 € · pollo 1,70 € · salchicha 1,70 € · atún 1,80 € · ternera 1,80 € · lomo 1,80 €', price: '', allergens: 'H · L · P', image_url: null, category: 'Papas', category_slug: 'papas' },

  // ---------- Platos combinados ----------
  { id: 'pc-1', name: 'Alitas de pollo al chipotle', description: '6 unidades · con papas fritas y ensalada fresca', price: '10,00 €', allergens: 'S*', image_url: `${A}alitas-pollo-chipotle.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-2', name: 'Nuggets de pollo premium', description: '10 unidades · con papas fritas y ensalada fresca', price: '7,50 €', allergens: 'G · H* · L*', image_url: `${A}nuggets-pollo-premium.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-3', name: 'Lágrimas de pollo crispy', description: 'Pollo crujiente', price: '7,50 €', allergens: 'G · H* · L*', image_url: `${A}lagrimas-pollo-crispy.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-4', name: 'Fingers de pollo', description: '6 unidades', price: '9,00 €', allergens: 'G · H* · L*', image_url: `${A}fingers-pollo.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-5', name: 'Brochetas de pollo', description: '3 brochetas', price: '9,00 €', image_url: `${A}brochetas-pollo.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-6', name: 'Croquetas de pollo o atún', description: '8 unidades', price: '9,50 €', allergens: 'G* · H* · L* · P*', image_url: `${A}croquetas-pollo.jpg`, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-7', name: 'Costilla a la BBQ', description: '550 g', price: '15,95 €', allergens: 'S* · MZ*', image_url: null, category: 'Platos combinados', category_slug: 'platos-combinados' },
  { id: 'pc-8', name: 'Codillo asado', description: '600 g', price: '15,95 €', image_url: null, category: 'Platos combinados', category_slug: 'platos-combinados' },

  // ---------- Bocadillos calientes ----------
  { id: 'bc-1', name: 'El ternera crack', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,80 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: 'bc-2', name: 'El ternera simple', description: 'Cebolla, queso y alioli', price: '4,20 €', allergens: 'G · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: 'bc-3', name: 'La bomba avícola', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,20 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: 'bc-4', name: 'El pollo simple', description: 'Cebolla, queso y alioli', price: '3,70 €', allergens: 'G · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: 'bc-5', name: 'El lomo goloso', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '4,50 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },
  { id: 'bc-6', name: 'El lomo simple', description: 'Cebolla, queso y alioli', price: '3,90 €', allergens: 'G · L · MZ*', image_url: null, category: 'Bocadillos calientes', category_slug: 'bocadillos-calientes' },

  // ---------- Sándwiches calientes ----------
  { id: 'sc-1', name: 'Jamón y queso', description: 'Jamón y queso', price: '2,90 €', allergens: 'G · L', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: 'sc-2', name: 'El de atún', description: 'Atún, cebolla, tomate natural, queso, huevo y alioli', price: '3,50 €', allergens: 'G · H · L · P · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: 'sc-3', name: 'El de pollo', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '3,80 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: 'sc-4', name: 'El de ternera', description: 'Cebolla, tomate natural, huevo, queso y alioli', price: '4,20 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },
  { id: 'sc-5', name: 'El de lomo', description: 'Cebolla, tomate natural, queso, huevo y alioli', price: '3,90 €', allergens: 'G · H · L · MZ*', image_url: null, category: 'Sándwiches calientes', category_slug: 'sandwiches-calientes' },

  // ---------- Pizzas ----------
  { id: 'pz-1', name: 'La bella serrana', description: 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', price: '11,50 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-2', name: 'La tradicional', description: 'Tomate, mozzarella, champiñones, jamón y aceitunas', price: '10,30 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-3', name: 'La parrillera', description: 'Tomate, mozzarella, champiñones, pimiento, cebolla, pollo y ternera', price: '11,00 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-4', name: 'La simple', description: 'Tomate, mozzarella, ajo y tomate natural', price: '10,00 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-5', name: 'La delicia', description: 'Tomate, mozzarella, atún y aceitunas', price: '10,30 €', allergens: 'G · L · P', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-6', name: 'Mar azul', description: 'Tomate, mozzarella, atún, cangrejo, mejillones y gambas', price: '12,90 €', allergens: 'G · L · P · CR · MO', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-7', name: 'La ranchera', description: 'BBQ, mozzarella, ternera, cebolla y salchicha', price: '10,80 €', allergens: 'G · L · S* · MZ*', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },
  { id: 'pz-8', name: 'Venecia', description: 'Tomate, mozzarella, jamón y bacon', price: '10,50 €', allergens: 'G · L', image_url: null, category: 'Pizzas', category_slug: 'pizzas' },

  // ---------- Cafés e infusiones ----------
  { id: 'ci-1', name: 'Café', price: '1,00 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-2', name: 'Cortado corto', price: '1,10 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-3', name: 'Cortado largo', price: '1,20 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-4', name: 'Leche y leche corto', price: '1,30 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-5', name: 'Leche y leche largo', price: '1,40 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-6', name: 'Café con leche', price: '1,40 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-7', name: 'Chocolate', price: '1,50 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-8', name: 'Infusiones', price: '1,20 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },
  { id: 'ci-9', name: 'Cortado vaso', price: '2,00 €', image_url: null, category: 'Cafés e infusiones', category_slug: 'cafes-e-infusiones' },

  // ---------- Refrescos, aguas y zumos ----------
  { id: 'rz-1', name: 'Coca-Cola', price: '2,00 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-2', name: 'Sprite', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-3', name: 'Fanta limón', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-4', name: 'Fanta naranja', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-5', name: 'Tónica', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-6', name: 'Agua pequeña', price: '1,50 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-7', name: 'Agua grande', price: '2,00 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-8', name: 'Energética', price: '1,40 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-9', name: 'Zumos', price: '1,80 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-10', name: 'Zumo naranja', price: '3,20 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-11', name: 'Red Bull', price: '2,40 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },
  { id: 'rz-12', name: 'Vaso de agua', price: '0,30 €', image_url: null, category: 'Refrescos, aguas y zumos', category_slug: 'refrescos-aguas-zumos' },

  // ---------- Cervezas ----------
  { id: 'cz-1', name: 'Tropical', price: '1,40 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-2', name: 'Tropical limón', price: '1,50 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-3', name: 'Botellín Tropical', price: '1,20 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-4', name: 'Dorada sin', price: '1,40 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-5', name: 'Dorada normal', price: '1,80 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-6', name: 'Dorada especial', price: '1,80 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-7', name: 'Estrella', price: '1,30 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-8', name: 'Estrella mini', price: '1,00 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-9', name: '1906', price: '2,90 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },
  { id: 'cz-10', name: 'Corona', price: '3,00 €', image_url: null, category: 'Cervezas', category_slug: 'cervezas' },

  // ---------- Licores y destilados ----------
  { id: 'ld-1', name: 'Ron blanco / oro', price: '1,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-2', name: 'Ginebra', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-3', name: 'Whisky', price: '2,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-4', name: 'Coñac', price: '1,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-5', name: 'Amaretto', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-6', name: 'Frangelico', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-7', name: 'Tía María', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-8', name: 'Baileys', price: '3,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-9', name: 'Marie Brizard', price: '2,80 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-10', name: 'Chinchón dulce', price: '1,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-11', name: 'Vodka', price: '2,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-12', name: 'Santa Teresa', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-13', name: 'Malibú', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-14', name: 'Tequila', price: '3,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-15', name: 'Etiqueta negra', price: '3,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-16', name: 'Etiqueta roja', price: '2,00 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-17', name: 'Cardhu', price: '5,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },
  { id: 'ld-18', name: 'Jack Daniel’s', price: '4,50 €', image_url: null, category: 'Licores y destilados', category_slug: 'licores-y-destilados' },

  // ---------- Vinos ----------
  { id: 'vi-1', name: 'Viña Lobón', price: '8,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-2', name: 'Mala Bestia', price: '9,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-3', name: 'Palacio de Beltús', price: '9,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-4', name: 'Conde de Basalu', price: '9,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-5', name: 'Luis Caña', price: '24,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-6', name: 'Despecho', price: '18,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-7', name: 'Azpilicueta', price: '27,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-8', name: 'Esencia 27', price: '18,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-9', name: 'Iniesta', price: '18,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
  { id: 'vi-10', name: 'Dulce Malicia', price: '24,00 €', image_url: null, category: 'Vinos', category_slug: 'vinos' },
];

/**
 * Devuelve los productos de una categoría.
 * En producción esta función consultará Neon; aquí se sirve el catálogo local
 * con la misma forma de datos (incluida la columna image_url).
 */
export function getProducts(categorySlug?: string): Product[] {
  if (!categorySlug) return PRODUCTS;
  return PRODUCTS.filter((product) => product.category_slug === categorySlug);
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
