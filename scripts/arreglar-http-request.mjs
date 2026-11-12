import { readFileSync, writeFileSync } from 'node:fs';

// Aplica los ultimos ajustes al workflow de confirmacion de pago:
//  1) El nodo "HTTP Request" (aviso por voz a hooknotifier) devolvia
//     "Bad request" porque el mensaje con el detalle completo supera el
//     limite de caracteres del servicio. Se acorta.
//  2) Ademas se pone en modo "continuar si falla": el aviso por voz es un
//     extra y no debe parar el flujo (el Telegram y el email ya se han
//     enviado en ese punto).
const G = "$('Generar Codigo de Pedido').first().json";

const cuerpoCorto = [
  '=🚨 NUEVO PEDIDO EN COCINA 🚨',
  '',
  `Código: {{ ${G}.order_code }}`,
  `Cliente: {{ ${G}.cliente_nombre }}`,
  `Teléfono: {{ ${G}.telefono }}`,
  `TOTAL: {{ ${G}.total_texto }} €`,
].join('\n');

for (const archivo of process.argv.slice(2)) {
  const wf = JSON.parse(readFileSync(archivo, 'utf8'));
  const http = wf.nodes.find((n) => n.name === 'HTTP Request');
  if (!http) {
    console.log(`  ${archivo}: no tiene nodo HTTP Request`);
    continue;
  }

  // 1) Mensaje corto (hooknotifier tiene limite de caracteres)
  for (const p of http.parameters.bodyParameters.parameters) {
    if (p.name === 'body') p.value = cuerpoCorto;
    if (p.name === 'object') p.value = '¡NUEVO PEDIDO EN COCINA!';
  }

  // 2) Que el fallo del aviso por voz no pare el flujo
  http.onError = 'continueRegularOutput';

  // 3) Timeout corto: si hooknotifier no responde, que no se eternice
  http.parameters.options = { ...(http.parameters.options ?? {}), timeout: 15000 };

  writeFileSync(archivo, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`  ${archivo}: mensaje acortado + onError=continueRegularOutput`);
}
