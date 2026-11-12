import { readFileSync, writeFileSync } from 'node:fs';

// El servicio hooknotifier guarda la notificacion en una columna
// "character varying(255)": si el texto se pasa, responde
// "value too long for type character varying(255)".
//
// El mensaje se deja muy corto (codigo, total y telefono) y sin emojis ni
// saltos de linea, que es lo que mas ocupa.
const G = "$('Generar Codigo de Pedido').first().json";

const body = `={{ ${G}.order_code }} | {{ ${G}.total_texto }} EUR | tel {{ ${G}.telefono }}`;
const object = `Pedido {{ ${G}.order_code }}`;

for (const archivo of process.argv.slice(2)) {
  const wf = JSON.parse(readFileSync(archivo, 'utf8'));
  const http = wf.nodes.find((n) => n.name === 'HTTP Request');
  if (!http) {
    console.log(`  ${archivo}: no tiene nodo HTTP Request`);
    continue;
  }

  for (const p of http.parameters.bodyParameters.parameters) {
    if (p.name === 'body') p.value = body;
    if (p.name === 'object') p.value = object;
    if (p.name === 'priority') p.value = 'high';
  }

  // Content type en formulario y sin Mandar Query Parameters (que si no,
  // n8n anade los datos del evento a la query y hooknotifier los guarda).
  http.parameters.contentType = 'form-urlencoded';
  http.parameters.sendQueryParameters = false;
  http.parameters.sendHeaders = false;
  http.parameters.options = { ...(http.parameters.options ?? {}), timeout: 15000 };
  http.onError = 'continueRegularOutput';

  writeFileSync(archivo, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`  ${archivo}: mensaje muy corto + query/headers desactivados`);
  console.log(`     body   : ${body}`);
  console.log(`     object : ${object}`);
}
