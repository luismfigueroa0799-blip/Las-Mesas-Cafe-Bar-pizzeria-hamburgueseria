// Genera el workflow de n8n corregido:
//
// 1) "Responder URL de pago" referencia un nodo que no existe
//    ($('Crear pedido a domicilio')), y por eso el flujo devolvia 500
//    "Error in workflow". El nodo se renombro a "Insert rows in a table".
//
// 2) El mapeo del INSERT en Neon usaba campos que no existen en la salida
//    del nodo de codigo ($json.telefono, $json.tipoEntrega, $json.id_pedido),
//    asi que se guardaban vacios.
//
// 3) La sesion de Stripe de n8n solo llevaba 5 claves en el metadata, que es
//    lo que hacia que el flujo de confirmacion de pago mandara a Telegram
//    "Cliente", "Sin telefono" y "0 EUR" sin detalle.
//
// 4) Las urls de exito y de cancelacion apuntaban a example.com.
import { readFileSync, writeFileSync } from 'node:fs';

const origen = process.argv[2];
const destino = process.argv[3];

const wf = JSON.parse(readFileSync(origen, 'utf8'));
const nodo = (nombre) => wf.nodes.find((n) => n.name === nombre);

const cambios = [];

// ── 1) "Responder URL de pago": la referencia al nodo inexistente ──
const responder = nodo('Responder URL de pago');
const viejo = responder.parameters.responseBody;
responder.parameters.responseBody =
  "={{ JSON.stringify({ ok: true, pedido_id: $('Insert rows in a table').first().json.id, total: $('Recalcular precio real').first().json.total, checkout_url: $json.url }) }}";
cambios.push('"Responder URL de pago": la referencia al nodo inexistente corregida');

// ── 2) "Insert rows in a table" (Neon): mapeo corregido ──
const insertar = nodo('Insert rows in a table');
insertar.parameters.columns.value = {
  id: '=',
  id_pedido: "={{ $json.id_pedido ?? '' }}",
  cliente_nombre: '={{ $json.nombre }}',
  cliente_telefono: '={{ $json.cliente_telefono }}',
  direccion: '={{ $json.direccion }}',
  productos: '={{ JSON.stringify($json.items) }}',
  total: '={{ $json.total }}',
  tipo_entrega: '={{ $json.tipo }}',
  estado: 'pendiente',
  fecha: '={{ $now.toISO() }}',
};
cambios.push('"Insert rows in a table": cliente_telefono, tipo_entrega y fecha corregidos');

// ── 3) "Recalcular precio real": preparar el detalle y el resumen ──
const codigo = nodo('Recalcular precio real');
const jsViejo = codigo.parameters.jsCode;
const jsNuevo = jsViejo.replace(
  /return \[\{\n  json: \{\n    valido: true,[\s\S]*?\n  \},\n\}\];/,
  `const total = totalCentimos / 100;

// El detalle en el formato que usa el flujo de confirmacion de pago: el
// precio como texto ("6,50 EUR") y los importes en centimos.
const lineasTexto = items.map(function (it) {
  const precio = Number(it.precio_unitario).toFixed(2).replace('.', ',') + ' €';
  return {
    id: String(it.id),
    nombre: it.nombre,
    name: it.nombre,
    cantidad: it.qty,
    qty: it.qty,
    precio: precio,
    price: precio,
    unit_cents: Math.round(Number(it.precio_unitario) * 100),
    subtotal_cents: Math.round(Number(it.subtotal) * 100),
  };
});

const detalleTexto = items.map(function (it) {
  const precio = Number(it.precio_unitario).toFixed(2).replace('.', ',') + ' €';
  return (it.qty > 1 ? it.qty + ' x ' : '') + it.nombre + ' - ' + precio;
}).join('\\n');

const resumen = [
  'Cliente: ' + pedido.nombre,
  'Telefono: ' + pedido.cliente_telefono,
  'Direccion: ' + pedido.direccion,
  'TOTAL: ' + total.toFixed(2).replace('.', ',') + ' EUR',
].join('\\n');

return [{
  json: {
    valido: true,
    tipo: 'domicilio',
    mesa_id: null,
    direccion: pedido.direccion,
    cliente_telefono: pedido.cliente_telefono,
    nombre: pedido.nombre,
    items: items,
    total: total,
    total_centimos: totalCentimos,
    total_texto: total.toFixed(2),
    items_texto: JSON.stringify(lineasTexto),
    detalle_texto: detalleTexto,
    resumen: resumen,
    numArticulos: String(items.length),
    estado: 'pendiente_pago',
  },
}];`,
);
if (jsNuevo === jsViejo) {
  console.log('AVISO: no se pudo parchear el nodo de codigo (revisar a mano)');
} else {
  codigo.parameters.jsCode = jsNuevo;
  cambios.push('"Recalcular precio real": prepara items_texto, detalle_texto y resumen');
}

// ── 4) "Crear sesion de pago Stripe": metadata completo y urls de retorno ──
const stripe = nodo('Crear sesión de pago Stripe');
const params = stripe.parameters.bodyParameters.parameters;
const eliminar = (nombre) => {
  const i = params.findIndex((p) => p.name === nombre);
  if (i >= 0) params.splice(i, 1);
};
const poner = (nombre, valor) => {
  eliminar(nombre);
  params.push({ name: nombre, value: valor });
};

const R = "$('Recalcular precio real').first().json";
const WEB = 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';

poner('metadata[cliente_nombre]', `={{ ${R}.nombre }}`);
poner('metadata[telefono]', `={{ ${R}.cliente_telefono }}`);
poner('metadata[cliente_direccion]', `={{ ${R}.direccion }}`);
poner('metadata[direccion]', `={{ ${R}.direccion }}`);
poner('metadata[total]', `={{ ${R}.total_texto }}`);
poner('metadata[total_centimos]', `={{ ${R}.total_centimos }}`);
poner('metadata[items]', `={{ ${R}.items_texto }}`);
poner('metadata[detalle]', `={{ ${R}.items_texto }}`);
poner('metadata[articulos]', `={{ ${R}.items_texto }}`);
poner('metadata[detalle_texto]', `={{ ${R}.detalle_texto }}`);
poner('metadata[resumen]', `={{ ${R}.resumen }}`);
poner('metadata[numArticulos]', `={{ ${R}.numArticulos }}`);
poner('metadata[tipoEntrega]', `={{ ${R}.tipo }}`);
poner('metadata[modoRecogida]', '={{ $json.tipo }}');
poner('success_url', `${WEB}/?pedido=ok&session_id={CHECKOUT_SESSION_ID}`);
poner('cancel_url', `${WEB}/?pedido=cancelado`);
cambios.push('"Crear sesion de pago Stripe": metadata completo y urls de retorno correctas');

writeFileSync(destino, JSON.stringify(wf, null, 2), 'utf8');
console.log('Workflow corregido guardado en:', destino);
for (const c of cambios) console.log('  +', c);
