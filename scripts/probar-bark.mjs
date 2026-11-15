import { writeFileSync } from 'node:fs';

const url =
  process.env.BARK_URL ?? 'https://api.day.app/gZpwvjWgU8Qedd';

const body = JSON.stringify({
  title: '🚨 NUEVO PEDIDO EN COCINA 🚨',
  body: 'Código: 12345\n\nDetalles:\nteste es un detalle\n\nTotal: 12,50 €',
  level: 'critical',
});

const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

const texto = await r.text();
console.log('HTTP status:', r.status);
console.log('Content-Type:', r.headers.get('content-type'));
console.log('Body:', texto);
console.log('OK:', r.ok);
