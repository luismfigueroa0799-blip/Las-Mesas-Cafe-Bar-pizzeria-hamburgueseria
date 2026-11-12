/**
 * Importa la carta real en la tabla `productos` de Supabase, que es la que
 * usa el flujo de n8n para recalcular los precios de cada pedido.
 *
 * Los ids se conservan (1, 2, 3...) y se anade un producto por cada plato de
 * nuestro catalogo. Al final escribe un fichero con el mapa nombre -> id para
 * poder actualizar el catalogo del frontend.
 *
 * Uso:  node scripts/importar-carta-supabase.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const URL_SUPABASE =
  process.env.SUPABASE_URL || 'https://fohxajfpnriusuybdteu.supabase.co';
const KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('Falta SUPABASE_SECRET_KEY');
  process.exit(1);
}

const CARTA = [
  // Hamburguesas de carne
  ['La suprema', 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', 6.5, 'Hamburguesas'],
  ['La tradicional', 'Queso, cebolla y 3 salsas', 3.6, 'Hamburguesas'],
  ['Burger Pizza', 'Hamburguesa de carne, huevo frito, bacon, queso, lechuga, tomate natural, cebolla, rúcula y salsa cheddar', 12.0, 'Hamburguesas'],
  // Hamburguesas de pollo
  ['La súper', 'Queso, huevo, bacon, tomate natural, cebolla y 3 salsas', 6.5, 'Hamburguesas'],
  ['La simple', 'Queso, cebolla y 3 salsas', 3.6, 'Hamburguesas'],
  // Perritos
  ['Perrito súper', 'Queso, jamón, cebolla y 3 salsas', 3.4, 'Perritos'],
  ['Perrito normal', 'Cebolla y 3 salsas', 3.0, 'Perritos'],
  // Pan de ajo
  ['Pan de ajo normal', 'Pan de ajo hecho con masa de pizza', 4.8, 'Pizzas'],
  ['Pan de ajo con queso', 'Pan de ajo hecho con masa de pizza', 6.3, 'Pizzas'],
  ['Pan de ajo con jamón y queso', 'Pan de ajo hecho con masa de pizza', 7.8, 'Pizzas'],
  // Papas
  ['Cono de papas', 'Papas fritas', 1.85, 'Papas'],
  ['Papas pequeñas', 'Papas fritas', 3.0, 'Papas'],
  ['Papas grandes', 'Papas fritas', 4.2, 'Papas'],
  // Platos combinados
  ['Alitas de pollo al chipotle', '6 unidades · con papas fritas y ensalada fresca', 10.0, 'Platos combinados'],
  ['Nuggets de pollo premium', '10 unidades · con papas fritas y ensalada fresca', 7.5, 'Platos combinados'],
  ['Lágrimas de pollo crispy', 'Pollo crujiente', 7.5, 'Platos combinados'],
  ['Fingers de pollo', '6 unidades', 9.0, 'Platos combinados'],
  ['Brochetas de pollo', '3 brochetas', 9.0, 'Platos combinados'],
  ['Croquetas de pollo o atún', '8 unidades', 9.5, 'Platos combinados'],
  ['Costilla a la BBQ', '550 g', 15.95, 'Platos combinados'],
  ['Codillo asado', '600 g', 15.95, 'Platos combinados'],
  // Bocadillos calientes
  ['El ternera crack', 'Cebolla, tomate natural, queso, huevo y alioli', 4.8, 'Bocadillos'],
  ['El ternera simple', 'Cebolla, queso y alioli', 4.2, 'Bocadillos'],
  ['La bomba avícola', 'Cebolla, tomate natural, queso, huevo y alioli', 4.2, 'Bocadillos'],
  ['El pollo simple', 'Cebolla, queso y alioli', 3.7, 'Bocadillos'],
  ['El lomo goloso', 'Cebolla, tomate natural, queso, huevo y alioli', 4.5, 'Bocadillos'],
  ['El lomo simple', 'Cebolla, queso y alioli', 3.9, 'Bocadillos'],
  // Sándwiches calientes
  ['Sándwich de jamón y queso', 'Jamón y queso', 2.9, 'Sándwiches'],
  ['Sándwich de atún', 'Atún, cebolla, tomate natural, queso, huevo y alioli', 3.5, 'Sándwiches'],
  ['Sándwich de pollo', 'Cebolla, tomate natural, queso, huevo y alioli', 3.8, 'Sándwiches'],
  ['Sándwich de ternera', 'Cebolla, tomate natural, huevo, queso y alioli', 4.2, 'Sándwiches'],
  ['Sándwich de lomo', 'Cebolla, tomate natural, queso, huevo y alioli', 3.9, 'Sándwiches'],
  // Pizzas
  ['Pizza La bella serrana', 'Tomate, mozzarella, jamón serrano, rúcula, aceite de oliva y tomate cherry', 11.5, 'Pizzas'],
  ['Pizza La tradicional', 'Tomate, mozzarella, champiñones, jamón y aceitunas', 10.3, 'Pizzas'],
  ['Pizza La parrillera', 'Tomate, mozzarella, champiñones, pimiento, cebolla, pollo y ternera', 11.0, 'Pizzas'],
  ['Pizza La simple', 'Tomate, mozzarella, ajo y tomate natural', 10.0, 'Pizzas'],
  ['Pizza La delicia', 'Tomate, mozzarella, atún y aceitunas', 10.3, 'Pizzas'],
  ['Pizza Mar azul', 'Tomate, mozzarella, atún, cangrejo, mejillones y gambas', 12.9, 'Pizzas'],
  ['Pizza La ranchera', 'BBQ, mozzarella, ternera, cebolla y salchicha', 10.8, 'Pizzas'],
  ['Pizza Venecia', 'Tomate, mozzarella, jamón y bacon', 10.5, 'Pizzas'],
  // Cafés e infusiones
  ['Café', '', 1.0, 'Cafés'],
  ['Cortado corto', '', 1.1, 'Cafés'],
  ['Cortado largo', '', 1.2, 'Cafés'],
  ['Leche y leche corto', '', 1.3, 'Cafés'],
  ['Leche y leche largo', '', 1.4, 'Cafés'],
  ['Café con leche', '', 1.4, 'Cafés'],
  ['Chocolate', '', 1.5, 'Cafés'],
  ['Infusiones', '', 1.2, 'Cafés'],
  ['Cortado vaso', '', 2.0, 'Cafés'],
  // Refrescos, aguas y zumos
  ['Coca-Cola', '', 2.0, 'Bebidas'],
  ['Sprite', '', 1.5, 'Bebidas'],
  ['Fanta limón', '', 1.5, 'Bebidas'],
  ['Fanta naranja', '', 1.5, 'Bebidas'],
  ['Tónica', '', 1.5, 'Bebidas'],
  ['Agua pequeña', '', 1.5, 'Bebidas'],
  ['Agua grande', '', 2.0, 'Bebidas'],
  ['Energética', '', 1.4, 'Bebidas'],
  ['Zumos', '', 1.8, 'Bebidas'],
  ['Zumo naranja', '', 3.2, 'Bebidas'],
  ['Red Bull', '', 2.4, 'Bebidas'],
  ['Vaso de agua', '', 0.3, 'Bebidas'],
  // Cervezas
  ['Tropical', '', 1.4, 'Cervezas'],
  ['Tropical limón', '', 1.5, 'Cervezas'],
  ['Botellín Tropical', '', 1.2, 'Cervezas'],
  ['Dorada sin', '', 1.4, 'Cervezas'],
  ['Dorada normal', '', 1.8, 'Cervezas'],
  ['Dorada especial', '', 1.8, 'Cervezas'],
  ['Estrella', '', 1.3, 'Cervezas'],
  ['Estrella mini', '', 1.0, 'Cervezas'],
  ['1906', '', 2.9, 'Cervezas'],
  ['Corona', '', 3.0, 'Cervezas'],
  // Licores y destilados
  ['Ron blanco / oro', '', 1.5, 'Licores'],
  ['Ginebra', '', 3.0, 'Licores'],
  ['Whisky', '', 2.0, 'Licores'],
  ['Coñac', '', 1.5, 'Licores'],
  ['Amaretto', '', 3.8, 'Licores'],
  ['Frangelico', '', 3.8, 'Licores'],
  ['Tía María', '', 3.8, 'Licores'],
  ['Baileys', '', 3.8, 'Licores'],
  ['Marie Brizard', '', 2.8, 'Licores'],
  ['Chinchón dulce', '', 1.5, 'Licores'],
  ['Vodka', '', 2.0, 'Licores'],
  ['Santa Teresa', '', 3.0, 'Licores'],
  ['Malibú', '', 3.0, 'Licores'],
  ['Tequila', '', 3.0, 'Licores'],
  ['Etiqueta negra', '', 3.5, 'Licores'],
  ['Etiqueta roja', '', 2.0, 'Licores'],
  ['Cardhu', '', 5.5, 'Licores'],
  ["Jack Daniel’s", '', 4.5, 'Licores'],
  // Vinos
  ['Viña Lobón', '', 8.0, 'Vinos'],
  ['Mala Bestia', '', 9.0, 'Vinos'],
  ['Palacio de Beltús', '', 9.0, 'Vinos'],
  ['Conde de Basalu', '', 9.0, 'Vinos'],
  ['Luis Caña', '', 24.0, 'Vinos'],
  ['Despecho', '', 18.0, 'Vinos'],
  ['Azpilicueta', '', 27.0, 'Vinos'],
  ['Esencia 27', '', 18.0, 'Vinos'],
  ['Iniesta', '', 18.0, 'Vinos'],
  ['Dulce Malicia', '', 24.0, 'Vinos'],
];

async function api(ruta, metodo, cuerpo) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const t = await r.text();
  let d = null;
  try {
    d = t ? JSON.parse(t) : null;
  } catch {
    d = t;
  }
  return { ok: r.ok, status: r.status, datos: d };
}

// 1) Los 3 productos de prueba se conservan; el resto se anade a partir del 4.
const existentes = await api('productos?select=id,nombre,precio', 'GET');
console.log('Productos actuales:', existentes.datos?.length ?? 0);

const mapa = {};
let siguienteId = 1;
for (const p of existentes.datos ?? []) {
  mapa[p.nombre] = p.id;
  siguienteId = Math.max(siguienteId, Number(p.id) + 1);
}

// 2) Insertar los que faltan
const nuevos = [];
for (const [nombre, descripcion, precio, categoria] of CARTA) {
  if (mapa[nombre]) continue;
  const id = siguienteId++;
  const r = await api('productos', 'POST', {
    id,
    nombre,
    precio,
    categoria,
    disponible: true,
  });
  if (r.ok) {
    mapa[nombre] = id;
    nuevos.push({ id, nombre, precio });
  } else {
    console.log('  ERROR al insertar', nombre, JSON.stringify(r.datos).slice(0, 160));
  }
}

console.log(`\nInsertados: ${nuevos.length}`);
console.log('Total productos:', Object.keys(mapa).length);

// 3) Mapa nombre -> id para el frontend
writeFileSync(
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/src/productos-supabase.json',
  JSON.stringify(mapa, null, 2),
  'utf8',
);
console.log('\nMapa guardado en src/productos-supabase.json');
console.log('Ejemplo:', JSON.stringify(Object.entries(mapa).slice(0, 6)));
