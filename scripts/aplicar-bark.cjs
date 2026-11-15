const fs = require('fs');
const base = 'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/docs/n8n/';
const BARK_URL = 'https://api.day.app/gZpwvjWgU8Qedd';

const archivos = [
  'n8n-confirmacion-pago-stripe.json',
  'n8n-confirmacion-pago-stripe-sin-insert.json',
];

for (const f of archivos) {
  const j = JSON.parse(fs.readFileSync(base + f, 'utf8'));
  let cambiado = false;
  for (const n of j.nodes || []) {
    if (n.type !== 'n8n-nodes-base.httpRequest') continue;
    const antes = JSON.stringify(n.parameters);
    // Para Bark: el body es JSON (titulo, texto, nivel).
    n.parameters.method = 'POST';
    n.parameters.url = BARK_URL;
    n.parameters.sendBody = true;
    n.parameters.contentType = 'json';
    n.parameters.jsonBody = {
      title: '🚨 NUEVO PEDIDO EN COCINA 🚨',
      body:
        'Código: {{ $(\'Generar Codigo de Pedido\').first().json.order_code }}\n' +
        'Cliente: {{ $(\'Generar Codigo de Pedido\').first().json.cliente_nombre }}\n' +
        'Teléfono: {{ $(\'Generar Codigo de Pedido\').first().json.telefono }}\n' +
        'Dirección: {{ $(\'Generar Codigo de Pedido\').first().json.direccion }}\n' +
        '-------------------------\n' +
        'DETALLE:\n' +
        '{{ $(\'Generar Codigo de Pedido\').first().json.detalle_texto }}\n' +
        '-------------------------\n' +
        'TOTAL: {{ $(\'Generar Codigo de Pedido\').first().json.total_texto }} €',
      level: 'critical',
    };
    n.parameters.sendQueryParameters = false;
    n.parameters.sendHeaders = false;
    n.parameters.options = { timeout: 15000 };
    const despues = JSON.stringify(n.parameters);
    if (antes !== despues) {
      console.log(f + ' -> HTTP Request actualizado para Bark');
      cambiado = true;
    }
  }
  j.name = 'Pedidos: confirmación de pago Stripe → Bark';
  if (cambiado) {
    fs.writeFileSync(
      'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/artifacts/las-mesas/docs/n8n/' + f,
      JSON.stringify(j, null, 2),
      'utf8',
    );
    console.log('  -> Guardado en docs/n8n/' + f);
  } else {
    console.log(f + ' -> NO cambiado (ya apunta a Bark?)');
  }
}
