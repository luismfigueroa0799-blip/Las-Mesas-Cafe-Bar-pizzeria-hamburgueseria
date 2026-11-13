import { readFileSync, writeFileSync } from 'node:fs';

// Cambia el nodo "HTTP Request" del aviso a cocina: de hooknotifier a ntfy.sh.
//
// ntfy.sh:
//   POST https://ntfy.sh/<topic>
//   Body en texto plano -> la tablet recibe una notificacion con el pedido.
//
// El body usa referencias al nodo "Generar Codigo de Pedido" y no
// $json.data.object.metadata.* a proposito: si el nodo HTTP va despues del
// INSERT en Neon, $json es la fila de la base de datos y no existe
// data.object.metadata. Con las referencias el texto es EXACTAMENTE el
// mismo y funciona en los dos casos.
const G = "$('Generar Codigo de Pedido').first().json";

const rawBody = [
  '={{',
  `  ${G}.codigo ? "" : ""`,
  '}}',
].join('\n');

// El texto final, tal cual lo quiere el usuario.
const texto = [
  '---------------------------------',
  `Pedido: {{ ${G}.order_code }}`,
  '---------------------------------',
  'Detalles:',
  `{{ ${G}.detalle_texto }}`,
  '---------------------------------',
  `Total: {{ ${G}.total_texto }} €`,
].join('\n');

const bodyExpresion = '=' + texto;

for (const archivo of process.argv.slice(2)) {
  const wf = JSON.parse(readFileSync(archivo, 'utf8'));
  const http = wf.nodes.find((n) => n.name === 'HTTP Request');
  if (!http) {
    console.log(`  ${archivo}: no tiene nodo HTTP Request`);
    continue;
  }

  http.parameters = {
    method: 'POST',
    url: 'https://ntfy.sh/nombre-del-tema',
    sendBody: true,
    contentType: 'raw',
    rawBody: bodyExpresion,
    sendQueryParameters: false,
    sendHeaders: false,
    options: { timeout: 15000 },
  };
  http.onError = 'continueRegularOutput';

  writeFileSync(archivo, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`  ${archivo}: nodo HTTP Request -> ntfy.sh`);
  console.log(`     url      : ${http.parameters.url}`);
  console.log(`     contentType: ${http.parameters.contentType}`);
  console.log(`     onError  : ${http.onError}`);
  console.log(`     body     :\n${texto}`);
}
