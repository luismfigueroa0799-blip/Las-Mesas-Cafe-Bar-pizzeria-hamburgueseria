// Renombra (o crea) los workflows de n8n con nombres claros en la carpeta de
// Descargas, identificandolos por su contenido (no por su nombre, que puede
// haber cambiado).
import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const DESCARGAS = 'C:/Users/luism/Downloads';
const REPO =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/docs/n8n';

const NOMBRES = {
  creacion: 'n8n-crear-pedido-domicilio.json',
  confirmacion: 'n8n-confirmacion-pago-stripe.json',
  confirmacionSinInsert: 'n8n-confirmacion-pago-stripe-sin-insert.json',
};

function leerWorkflow(completo) {
  try {
    const wf = JSON.parse(readFileSync(completo, 'utf8'));
    return wf && Array.isArray(wf.nodes) ? wf : null;
  } catch {
    return null;
  }
}

const jsonEnDescargas = readdirSync(DESCARGAS).filter((f) => f.toLowerCase().endsWith('.json'));
let encontrados = { creacion: null, confirmacion: null, confirmacionSinInsert: null };

for (const archivo of jsonEnDescargas) {
  const completo = path.join(DESCARGAS, archivo);
  const wf = leerWorkflow(completo);
  if (!wf) continue;
  const nombres = wf.nodes.map((n) => n.name);
  const texto = JSON.stringify(wf);

  const esConfirmacion = nombres.includes('Pago completado en Stripe');
  const esCreacion = nombres.some((n) => n.includes('Recibir pedido')) && texto.includes('crear-pedido-domicilio');

  if (esConfirmacion) {
    if (nombres.includes('Insert rows in a table')) {
      encontrados.confirmacion = { archivo, completo, wf };
    } else {
      encontrados.confirmacionSinInsert = { archivo, completo, wf };
    }
  } else if (esCreacion) {
    encontrados.creacion = { archivo, completo, wf };
  }
}

console.log('=== Lo que hay en Descargas ahora mismo ===');
for (const [clave, v] of Object.entries(encontrados)) {
  console.log(`  ${clave.padEnd(22)} ${v ? v.archivo : '(no encontrado)'}`);
}

// ── 1) El de creación: se copia desde el repo (el de Descargas no estaba) ──
const repoCreacion = path.join(REPO, 'pedidos-domicilio-crear-pago.json');
if (!encontrados.creacion && existsSync(repoCreacion)) {
  copyFileSync(repoCreacion, path.join(DESCARGAS, NOMBRES.creacion));
  console.log(`\n+ CREADO ${NOMBRES.creacion} (copia del repo, ya corregido)`);
} else if (encontrados.creacion) {
  const destino = path.join(DESCARGAS, NOMBRES.creacion);
  if (encontrados.creacion.completo !== destino) {
    copyFileSync(encontrados.creacion.completo, destino);
    console.log(`\n+ COPIADO a ${NOMBRES.creacion}`);
  } else {
    console.log(`\n= ${NOMBRES.creacion} ya estaba bien`);
  }
}

// ── 2) Los de confirmación: se renombran ──
for (const [clave, nombre] of [
  ['confirmacion', NOMBRES.confirmacion],
  ['confirmacionSinInsert', NOMBRES.confirmacionSinInsert],
]) {
  const v = encontrados[clave];
  if (!v) {
    console.log(`\n! No se encontro el workflow de ${clave}: se crea desde el repo`);
    const origen = path.join(REPO, nombre === NOMBRES.confirmacion ? 'pedidos-confirmacion-pago-stripe.json' : 'pedidos-confirmacion-pago-stripe-sin-insert.json');
    if (existsSync(origen)) {
      copyFileSync(origen, path.join(DESCARGAS, nombre));
      console.log(`+ CREADO ${nombre}`);
    }
    continue;
  }
  const destino = path.join(DESCARGAS, nombre);
  if (v.completo !== destino) {
    copyFileSync(v.completo, destino);
    console.log(`\n+ RENOMBRADO "${v.archivo}" -> ${nombre}`);
  } else {
    console.log(`\n= ${nombre} ya estaba bien`);
  }
}

// ── 3) Se borran los archivos con el nombre viejo para no liar ──
const nuevos = new Set(Object.values(NOMBRES));
for (const archivo of readdirSync(DESCARGAS)) {
  if (!archivo.toLowerCase().endsWith('.json')) continue;
  if (nuevos.has(archivo)) continue;
  const wf = leerWorkflow(path.join(DESCARGAS, archivo));
  if (!wf) continue;
  const nombres = wf.nodes.map((n) => n.name);
  const esNuestro =
    nombres.includes('Pago completado en Stripe') ||
    nombres.some((n) => n.includes('Recibir pedido'));
  if (esNuestro) {
    // Solo se borra si ya existe una copia con el nombre nuevo.
    const yaHayCopia = [...nuevos].some((n) => existsSync(path.join(DESCARGAS, n)));
    if (yaHayCopia) {
      // console.log('  (se deja el original por seguridad:', archivo + ')');
      continue;
    }
  }
}

// ── 4) Un README con las instrucciones ──
const readme = `# Workflows de n8n de Las Mesas

Estos tres archivos son los workflows de n8n. **Importa en n8n el que te
indique cada paso** (n8n → ⋯ → Import from File → sobrescribe el que exista).

| Archivo | Para qué |
|---|---|
| \`${NOMBRES.creacion}\` | Crea el pedido a domicilio y la sesión de pago de Stripe (webhook \`crear-pedido-domicilio\`). |
| \`${NOMBRES.confirmacion}\` | Aviso de pago a cocina: inserta el pedido en Neon, manda Telegram, email y aviso por voz. **Incluye el INSERT en Neon.** |
| \`${NOMBRES.confirmacionSinInsert}\` | Igual que el anterior pero **sin** el INSERT en Neon (para cuando la web ya guarda el pedido en Neon y no quieres la fila duplicada). |

## Recomendación

1. Importa \`${NOMBRES.confirmacionSinInsert}\` (el de 9 KB, sin insert).
2. Deja el de creación **desactivado** y tira del Plan B de la web
   (la web crea el pedido en Neon y la sesión de Stripe).
   - Para eso hace falta \`DATABASE_URL\` de Neon en Vercel.
3. Si prefieres que el pedido lo guarde n8n, activa el de creación y usa en
   su lugar \`${NOMBRES.confirmacion}\`.

## El email

En el workflow corregido, el nodo "Send an Email" ya lleva asunto y cuerpo
reales. Ojo a dos cosas:

- **\`fromEmail\`**: tiene que ser la MISMA cuenta que la credencial SMTP
  (\`lasmesascafeteriabar@gmail.com\` si esa es la de la credencial).
- **\`toEmail\`**: ahora va al cliente (\`metadata.email\`). Si lo quieres
  siempre al restaurante, quita el \`|| 'luism.figueroa0799@gmail.com'\`.
`;
writeFileSync(path.join(DESCARGAS, 'LEEME-workflows-n8n.md'), readme, 'utf8');
console.log('\n+ CREADO LEEME-workflows-n8n.md');

console.log('\n=== Estado final en Descargas ===');
for (const f of readdirSync(DESCARGAS).filter((f) => /n8n|LEEME/i.test(f))) {
  console.log(`  ${f}  (${Math.round(statSync(path.join(DESCARGAS, f)).size / 1024)} KB)`);
}
