// Prueba el nodo HTTP Request tal y como queda en n8n: POST a ntfy.sh con el
// cuerpo en texto plano (raw), sin cabeceras ni query.
const TOPIC = process.argv[2] ?? 'las-mesas-prueba';

// El mismo cuerpo que lleva el nodo, ya evaluado.
const cuerpo = [
  '---------------------------------',
  'Pedido: PED-4K7X',
  '---------------------------------',
  'Detalles:',
  '2 x Café Solo - 1,50 €',
  '1 x La suprema - 6,50 €',
  '---------------------------------',
  'Total: 9,50 €',
].join('\n');

console.log('Cuerpo que se envia:\n' + cuerpo + '\n');

// Como lo manda n8n con contentType "raw": cuerpo plano, sin Content-Type.
const r = await fetch(`https://ntfy.sh/${TOPIC}`, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  body: cuerpo,
});
const texto = await r.text();
console.log('HTTP', r.status);
console.log('Respuesta:', texto.slice(0, 600));

// Y ahora leemos el topic para ver como lo ve la tablet.
await new Promise((res) => setTimeout(res, 1500));
const json = await (
  await fetch(`https://ntfy.sh/${TOPIC}/json?poll=1&since=1m`, {
    headers: { Accept: 'application/json' },
  })
).text();
console.log('\n--- Lo que ve la tablet (json) ---');
for (const linea of json.split('\n').filter(Boolean)) {
  try {
    const m = JSON.parse(linea);
    if (m.event && m.event !== 'open') {
      console.log('topic:', m.topic, '| evento:', m.event, '| mensaje:\n' + m.message);
    }
  } catch {
    /* linea no json */
  }
}
