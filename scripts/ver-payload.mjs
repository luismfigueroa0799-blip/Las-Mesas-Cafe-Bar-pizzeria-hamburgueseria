import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..', 'artifacts', 'las-mesas');
const repoRaiz = path.resolve(raiz, '..', '..');

function localizarEsbuild() {
  const d = path.join(repoRaiz, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (existsSync(d)) return d;
  const alm = path.join(repoRaiz, 'node_modules', '.pnpm');
  const c = readdirSync(alm).find((n) => n.startsWith('esbuild@'));
  const r = path.join(alm, c, 'node_modules', 'esbuild', 'lib', 'main.js');
  return existsSync(r) ? r : null;
}

const em = await import(pathToFileURL(localizarEsbuild()).href);
const build = em.build ?? em.default.build;
const salida = path.join(process.env.TEMP || '.', 'pedido.mjs');
await build({
  entryPoints: [path.join(repoRaiz, 'scripts', 'pedido-entrada.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: salida, logLevel: 'error',
});
const { construirPedido } = await import(pathToFileURL(salida).href);

const evento = {
  type: 'checkout.session.completed',
  livemode: false,
  created: 1762900000,
  data: { object: {
    id: 'cs_test_a1B2c3', payment_intent: 'pi_test_X9Y8', amount_total: 1480, amount_subtotal: 1480,
    currency: 'eur', payment_method_types: ['card'],
    customer_details: { email: 'cliente@ejemplo.com', name: 'Ana Pérez', phone: '600000000' },
    metadata: {
      nombre: 'Ana Pérez', telefono: '34600000000', cliente_telefono: '34600000000',
      correo: 'cliente@ejemplo.com', tipoEntrega: 'domicilio', direccion: 'Calle Mayor, nº 24, 3º B, 35018, Las Palmas',
      calle: 'Calle Mayor', numero: '24', piso: '3º B', codigoPostal: '35018', ciudad: 'Las Palmas de Gran Canaria',
      modoRecogida: 'domicilio',
      items: JSON.stringify([{ id: '3', name: 'Burger Pizza', qty: 1, price: '12,00 €' }, { id: '62', name: 'Tropical', qty: 2, price: '1,40 €' }]),
    },
  } },
};

const p = construirPedido(evento);
console.log('=== PAYLOAD QUE RECIBE n8n ===');
console.log(JSON.stringify(p, null, 2));
console.log('');
console.log('CLAVES NIVEL RAIZ:', Object.keys(p).join(', '));
console.log('CLAVES DE CADA ARTICULO:', Object.keys(p.articulos[0]).join(', '));