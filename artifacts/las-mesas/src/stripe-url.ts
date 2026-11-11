/**
 * Extrae la url de la pasarela de pago de Stripe de la respuesta del webhook.
 *
 * El flujo de n8n puede devolver la url con distinta forma según cómo esté
 * configurado el nodo "Respond to Webhook", así que se aceptan todas estas:
 *
 *   { "url": "https://checkout.stripe.com/..." }
 *   { "session": { "url": "..." } }
 *   { "data": { "url": "..." } }
 *   { "body": { "url": "..." } }
 *   { "checkout_url": "..." }
 *   { "output": "https://checkout.stripe.com/..." }   (string plano)
 *
 * También se acepta que la url venga como texto suelto en la respuesta.
 */
export function extraerUrlStripe(respuesta: unknown): string {
  if (!respuesta) return '';

  if (typeof respuesta === 'string') {
    const directa = respuesta.match(/https:\/\/checkout\.stripe\.com\/[^\s"']+/);
    return directa ? directa[0] : '';
  }

  if (typeof respuesta !== 'object') return '';

  const r = respuesta as Record<string, any>;

  const candidatas: unknown[] = [
    r.url,
    r.checkout_url,
    r.checkoutUrl,
    r.session?.url,
    r.data?.url,
    r.body?.url,
    r.data?.session?.url,
    r.output?.url,
    r.output,
    r.result?.url,
    r.checkout?.url,
  ];

  for (const candidata of candidatas) {
    if (typeof candidata === 'string' && /^https:\/\//.test(candidata)) {
      return candidata;
    }
  }

  // Último recurso: buscar una url de Stripe dentro del JSON.
  try {
    const texto = JSON.stringify(respuesta);
    const encontrada = texto.match(/https:\/\/checkout\.stripe\.com\/[^"\\\s]+/);
    if (encontrada) return encontrada[0];
  } catch {
    /* sin datos serializables */
  }

  return '';
}
