// Genera el workflow "Pedidos: confirmación de pago Stripe" corregido.
//
// Problemas que解决:
//  1) El workflow estaba DESACTIVADO (active: false): no se ejecutaba nada.
//  2) El nodo "Edit Fields" inyectaba datos de prueba hardcodeados, asi que
//     el flujo NUNCA veia el evento real de Stripe.
//  3) El nodo "Generar Codigo de Pedido" leia el nombre y el telefono de
//     customer_details, que Stripe no rellena (el checkout no los pide), y el
//     detalle de "items", que en Stripe no existe. De ahi salia
//     "Cliente", "Sin telefono", "0 EUR" y el detalle vacio.
//     Ahora se leen del metadata de la sesion, que es donde la web los deja.
//  4) Los nodos de Telegram, email y el aviso por voz leian
//     $json.data.object.metadata.* DESPUES del INSERT en Neon, donde $json ya
//     es la fila de la base de datos (y no existe metadata).
//  5) El INSERT en Neon mapeaba campos inexistentes y no guardaba el total ni
//     el telefono.
//  6) El email: asunto "prueba de correo n8n", cuerpo vacio (leia
//     $json.order_code despues del nodo de Telegram) y sin detalle ni total.
import { readFileSync, writeFileSync } from 'node:fs';

const origen = process.argv[2];
const destino = process.argv[3];

const wf = JSON.parse(readFileSync(origen, 'utf8'));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const cambios = [];

// ── 1) Quitar el nodo "Edit Fields" (datos de prueba) ──
const antes = wf.nodes.length;
wf.nodes = wf.nodes.filter((n) => n.name !== 'Edit Fields');
if (wf.nodes.length !== antes) cambios.push('Nodo "Edit Fields" (datos de prueba) eliminado');

// ── 2) "Generar Codigo de Pedido": leer los datos del metadata ──
const codigo = nodo('Generar Codigo de Pedido');
codigo.parameters.jsCode = `// Los datos del pedido llegan en el metadata de la sesion de Stripe: es
// donde la web (las mesas/cocina) deja el nombre, el telefono, la direccion,
// el total y el detalle del pedido.
//
// Antes se leian de customer_details y de data.object.items, pero Stripe no
// rellena el nombre ni el telefono (el checkout no los pide) y "items" no
// existe en el evento: por ahi salia "Cliente", "Sin telefono" y "0 EUR".

const salida = [];

for (const item of $input.all()) {
  const evento = item.json || {};

  // El objeto de la sesion de checkout dentro del evento.
  const objeto = (evento.data && evento.data.object) || evento.object || {};
  const metadata = objeto.metadata || {};
  const detalles = objeto.customer_details || {};

  const idSesion = String(objeto.id || evento.id || '');
  const codigoPedido =
    metadata.codigo ||
    metadata.order_code ||
    metadata.codigo_pedido ||
    ('PED-' + idSesion.slice(-4).toUpperCase());

  const nombre =
    metadata.cliente_nombre ||
    metadata.nombre ||
    detalles.name ||
    'Cliente';

  const telefono =
    metadata.telefono ||
    metadata.cliente_telefono ||
    detalles.phone ||
    'Sin telefono';

  const direccion =
    metadata.direccion ||
    metadata.cliente_direccion ||
    'Sin direccion';

  const correo =
    metadata.email ||
    metadata.correo ||
    metadata.cliente_correo ||
    detalles.email ||
    '';

  // Total: el metadata lo lleva en euros como texto. Si no esta, se usa el
  // de Stripe, que va en centimos.
  let total = Number(metadata.total);
  if (!isFinite(total) || total <= 0) total = (Number(objeto.amount_total) || 0) / 100;
  const totalTexto = metadata.total_texto || total.toFixed(2);

  // Detalle del pedido: el metadata lleva el JSON de las lineas.
  let items = [];
  try {
    const parseado = JSON.parse(metadata.detalle || metadata.items || '[]');
    if (Array.isArray(parseado)) items = parseado;
  } catch (e) {
    items = [];
  }

  const detalleTexto =
    metadata.detalle_texto ||
    items
      .map(function (it) {
        const precio =
          typeof it.precio === 'number'
            ? it.precio.toFixed(2).replace('.', ',') + ' EUR'
            : it.precio || '';
        const unidades = (it.cantidad || it.qty || 1) > 1 ? (it.cantidad || it.qty) + ' x ' : '';
        return unidades + (it.nombre || it.name || '') + ' - ' + precio;
      })
      .join('\\n');

  const resumen =
    metadata.resumen ||
    [
      'Cliente: ' + nombre,
      'Telefono: ' + telefono,
      'Direccion: ' + direccion,
      'TOTAL: ' + totalTexto + ' EUR',
    ].join('\\n');

  salida.push({
    json: {
      ...evento,
      order_code: codigoPedido,
      codigo: codigoPedido,
      cliente_nombre: nombre,
      nombre: nombre,
      telefono: telefono,
      cliente_telefono: telefono,
      direccion: direccion,
      cliente_direccion: direccion,
      total: total,
      total_texto: totalTexto,
      email: correo,
      correo: correo,
      items: items,
      detalle_texto: detalleTexto,
      resumen: resumen,
      tipo_entrega: metadata.tipoEntrega || metadata.modo_entrega || 'domicilio',
      pedido_id: metadata.pedido_id || '',
    },
  });
}

return salida;`;
cambios.push('"Generar Codigo de Pedido" lee el pedido del metadata de la sesion');

// ── 3) INSERT en Neon con el mapeo correcto ──
const insertar = nodo('Insert rows in a table');
const G = "$('Generar Codigo de Pedido').first().json";
insertar.parameters.columns.value = {
  id_pedido: `={{ ${G}.order_code }}`,
  cliente_nombre: `={{ ${G}.cliente_nombre }}`,
  cliente_telefono: `={{ ${G}.telefono }}`,
  direccion: `={{ ${G}.direccion }}`,
  productos: `={{ JSON.stringify(${G}.items) }}`,
  total: `={{ ${G}.total }}`,
  tipo_entrega: `={{ ${G}.tipo_entrega }}`,
  estado: 'Pendiente',
  fecha: '={{ $now.toISO() }}',
};
cambios.push('"Insert rows in a table" (Neon) con el mapeo correcto');

// ── 4) Telegram: leer del nodo de codigo (no de la fila de Neon) ──
const telegram = nodo('Avisar domicilio por Telegram');
telegram.parameters.text = [
  '=🚨 NUEVO PEDIDO EN COCINA 🚨',
  '',
  `Código: {{ ${G}.order_code }}`,
  `Cliente: {{ ${G}.cliente_nombre }}`,
  `Teléfono: {{ ${G}.telefono }}`,
  `Dirección: {{ ${G}.direccion }}`,
  '-------------------------',
  'DETALLE:',
  `{{ ${G}.detalle_texto }}`,
  '-------------------------',
  `TOTAL: {{ ${G}.total_texto }} €`,
].join('\n');
cambios.push('"Avisar domicilio por Telegram" con los datos del pedido');

// ── 5) El aviso por voz (hooknotifier): igual que el Telegram ──
const http = nodo('HTTP Request');
for (const p of http.parameters.bodyParameters.parameters) {
  if (p.name === 'body') {
    p.value = [
      '=🚨 NUEVO PEDIDO EN COCINA 🚨\\n\\n',
      `Código: {{ ${G}.order_code }}\\n`,
      `Cliente: {{ ${G}.cliente_nombre }}\\n`,
      `Teléfono: {{ ${G}.telefono }}\\n`,
      `Dirección: {{ ${G}.direccion }}\\n`,
      '-------------------------\\n',
      'DETALLE:\\n',
      `{{ ${G}.detalle_texto }}\\n`,
      '-------------------------\\n',
      `TOTAL: {{ ${G}.total_texto }} €`,
    ].join('');
  }
}
cambios.push('"HTTP Request" (aviso por voz) con los datos del pedido');

// ── 6) El email ──
const email = nodo('Send an Email');
// La direccion de origen tiene que ser la misma cuenta que la credencial
// SMTP, o el envio se rechaza.
email.parameters.fromEmail = '=lasmesascafeteriabar@gmail.com';
email.parameters.toEmail = `={{ ${G}.email || 'luism.figueroa0799@gmail.com' }}`;
email.parameters.subject = `=Nuevo pedido {{ ${G}.order_code }} - Las Mesas`;
email.parameters.html = [
  '=<h2>¡Gracias por tu pedido!</h2>',
  `<p>Hemos recibido tu pedido <b>{{ ${G}.order_code }}</b>.</p>`,
  `<p>Cliente: <b>{{ ${G}.cliente_nombre }}</b></p>`,
  `<p>Teléfono: <b>{{ ${G}.telefono }}</b></p>`,
  `<p>Dirección: <b>{{ ${G}.direccion }}</b></p>`,
  '<hr>',
  '<p><b>DETALLE:</b></p>',
  `<pre>{{ ${G}.detalle_texto }}</pre>`,
  '<hr>',
  `<p><b>TOTAL: {{ ${G}.total_texto }} €</b></p>`,
].join('\n');
cambios.push('"Send an Email" con asunto, destinatario y cuerpo reales');

// ── 7) Conexiones: el trigger va directo al nodo de codigo ──
wf.connections = {
  'Pago completado en Stripe': {
    main: [[{ node: 'Generar Codigo de Pedido', type: 'main', index: 0 }]],
  },
  'Generar Codigo de Pedido': {
    main: [[{ node: 'Insert rows in a table', type: 'main', index: 0 }]],
  },
  'Insert rows in a table': {
    main: [
      [
        { node: 'Avisar domicilio por Telegram', type: 'main', index: 0 },
        { node: 'HTTP Request', type: 'main', index: 0 },
      ],
    ],
  },
  'Avisar domicilio por Telegram': {
    main: [[{ node: 'Send an Email', type: 'main', index: 0 }]],
  },
  'Send an Email': { main: [[]] },
  'HTTP Request': { main: [[]] },
};
cambios.push('Conexiones: el trigger va directo al nodo de codigo (sin datos de prueba)');

// ── 8) Activar el workflow ──
wf.active = true;
cambios.push('Workflow activado (active: true)');

writeFileSync(destino, JSON.stringify(wf, null, 2), 'utf8');
console.log('Workflow corregido guardado en:', destino);
for (const c of cambios) console.log('  +', c);
