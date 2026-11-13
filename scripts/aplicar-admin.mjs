import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const base =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/src/';

const css = readFileSync(base + 'admin.css', 'utf8');
const idx = base + 'index.css';
let c = readFileSync(idx, 'utf8');

if (c.includes('PANEL DE INVENTARIO')) {
  console.log('index.css ya tenia los estilos del panel');
} else {
  c = c.trimEnd() + '\n' + css;
  writeFileSync(idx, c, 'utf8');
  console.log('Estilos del panel anadidos a index.css');
}

unlinkSync(base + 'admin.css');
console.log('admin.css temporal eliminado');
