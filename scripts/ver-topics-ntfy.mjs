const r = await fetch('https://ntfy.sh/json?poll=1&since=24h');
const texto = await r.text();
const lineas = texto.split('\n').filter(Boolean);
const topics = new Map();
for (const l of lineas) {
  try {
    const m = JSON.parse(l);
    const t = m.topic ?? '(sin topic)';
    if (!topics.has(t)) topics.set(t, []);
    topics.get(t).push(m);
  } catch {
    console.log('  (linea no json):', l.slice(0, 100));
  }
}
console.log('\n=== TOPICS con mensajes en las ultimas 24h ===');
for (const [t, ms] of topics) {
  const conMensaje = ms.filter((m) => m.event === 'message');
  console.log(`  ${t}: ${ms.length} eventos (${conMensaje.length} mensajes)`);
  const ultimo = conMensaje[conMensaje.length - 1];
  if (ultimo) {
    console.log('     ultimo:', JSON.stringify(ultimo.message).slice(0, 220));
    console.log('     fecha  :', ultimo.time ? new Date(ultimo.time * 1000).toLocaleString('es-ES') : '?');
  }
}
