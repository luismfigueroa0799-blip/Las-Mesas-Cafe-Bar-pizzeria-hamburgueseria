// Comprueba que los productos de Neon se ven bien en la carta:
//  - cuantos tienen categoria conocida por el PRESENTACION local
//  - que la API publica el flag de disponibilidad
import { readFileSync } from 'node:fs';

const BASE =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';

// Nombres y categorias del PRESENTACION local
const src = readFileSync(
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/src/products.ts',
  'utf8',
);
const pares = new Map();
const re = /'([^']+)':\s*\{[^}]*?categoria:\s*'([^']+)'/g;
let m;
while ((m = re.exec(src)) !== null) pares.set(m[1], m[2]);

console.log('Productos en el PRESENTACION local:', pares.size);

const productos = await (await fetch(BASE + '/api/productos')).json();
console.log('Productos que devuelve la API:', productos.length);

let conCategoriaConocida = 0;
const desconocidos = [];
for (const p of productos) {
  const cat = pares.get(p.nombre);
  if (cat) conCategoriaConocida += 1;
  else desconocidos.push(p.nombre);
}
console.log('Con categoria conocida por el PRESENTACION:', conCategoriaConocida);
console.log('SIN categoria conocida:', desconocidos.length);
console.log('Ejemplos:', desconocidos.slice(0, 8).join(', '));

// Que campos trae cada producto de la API
console.log('\nCampos que devuelve la API:', Object.keys(productos[0] ?? {}).join(', '));
console.log('Ejemplo:', JSON.stringify(productos.find((p) => desconocidos.includes(p.nombre)) ?? productos[0]));
