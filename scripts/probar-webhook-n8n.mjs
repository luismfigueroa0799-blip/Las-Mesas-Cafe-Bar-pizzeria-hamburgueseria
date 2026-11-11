/**
 * Comprueba el contrato entre la web y el webhook de n8n: envía un pedido de
 * prueba y verifica que la respuesta trae una url de Stripe válida.
 *
 * Uso:  node scripts/probar-webhook-n8n.mjs
 */
const WEBHOOK =
  process.env.N8N_WEBHOOK_URL ||
  'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';

// Contrato EXACTO que espera n8n (verificado contra el webhook real).
// Solo se envia id y cantidad: n8n recalcula los precios con su lista.
const pedido = {
  nombre: 'Luis Test',
  direccion: 'Calle Mayor 24, 3 B, 35018 Las Palmas de Gran Canaria',
  cliente_telefono: '600000000',
  items: [{ id: Number(process.env.PRODUCTO_ID || 1), qty: 1 }],
};

console.log('Webhook:', WEBHOOK);
console.log('Enviando pedido de prueba…\n');

let respuesta;
try {
  respuesta = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido),
    signal: AbortSignal.timeout(45000),
  });
} catch (error) {
  console.error('No se pudo contactar con n8n:', error.message);
  process.exit(1);
}

const texto = await respuesta.text();
console.log('Estado HTTP:', respuesta.status);
console.log('Respuesta cruda:', texto.slice(0, 600));
console.log('');

let cuerpo = null;
try {
  cuerpo = JSON.parse(texto);
} catch {
  console.log('La respuesta no es JSON.');
}

// Buscamos la url de Stripe con el mismo criterio que usa la web.
const candidatas = [
  cuerpo?.checkout_url,
  cuerpo?.url,
  cuerpo?.session?.url,
  cuerpo?.data?.url,
  cuerpo?.body?.url,
  cuerpo?.output,
];
const url = candidatas.find((c) => typeof c === 'string' && c.startsWith('https://'));

if (url) {
  console.log('OK: el webhook devuelve una url de Stripe');
  console.log('   ', url.slice(0, 90) + (url.length > 90 ? '…' : ''));
} else if (respuesta.status === 404 && /not registered/i.test(texto)) {
  console.log('FALLO: el workflow de n8n no está escuchando.');
  console.log('  - Si usas la URL de pruebas (/webhook-test/): pulsa "Execute workflow" en n8n.');
  console.log('  - Si usas la URL de producción (/webhook/): activa el workflow (toggle arriba a la derecha).');
  process.exit(1);
} else {
  console.log('FALLO: la respuesta no contiene una url de Stripe.');
  process.exit(1);
}
