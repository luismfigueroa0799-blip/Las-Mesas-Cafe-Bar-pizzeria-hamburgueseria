// Mira si un topic de ntfy ha recibido mensajes y cuales.
// GET https://ntfy.sh/<topic>/json?poll=1&since=24h
const topics = process.argv.slice(2);
if (!topics.length) topics.push('nombre-del-tema', 'las-mesas', 'las-mesas-pedidos', 'las-mesas-prueba');

for (const topic of topics) {
  const url = `https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=24h`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const texto = await r.text();
    const lineas = texto.split('\n').filter(Boolean);
    const mensajes = [];
    for (const l of lineas) {
      try {
        const m = JSON.parse(l);
        if (m.event === 'message') mensajes.push(m);
      } catch {
        /* linea no json */
      }
    }
    console.log(`\n=== /${topic} ===`);
    console.log(`  HTTP ${r.status} | lineas: ${lineas.length} | mensajes: ${mensajes.length}`);
    if (!lineas.length) {
      console.log('  (respuesta vacia: ese topic no existe o no tiene mensajes)');
    }
    for (const m of mensajes.slice(-3)) {
      console.log(`  - ${new Date((m.time || 0) * 1000).toLocaleString('es-ES')} :: ${JSON.stringify(m.message).slice(0, 150)}`);
    }
  } catch (e) {
    console.log(`\n=== /${topic} === ERROR: ${e.message}`);
  }
}
