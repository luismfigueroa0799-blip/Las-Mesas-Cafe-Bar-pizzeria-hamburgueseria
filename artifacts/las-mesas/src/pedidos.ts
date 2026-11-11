/**
 * Configuración de los pedidos online de la web oficial.
 *
 * IMPORTANTE: esta web (web oficial) es AUTÓNOMA. No comparte base de datos
 * ni webhooks de creación de pedido con la app de hamburguesería/pizzería.
 *
 * El flujo es:
 *   1. El navegador llama a NUESTRA API (/api/checkout), que tiene la
 *      STRIPE_SECRET_KEY y crea la sesión de pago de Stripe.
 *   2. El cliente paga en la pasarela de Stripe.
 *   3. Stripe notifica directamente a n8n (trigger "Pago completado en
 *      Stripe"), que avisa por Telegram y email al restaurante. Para eso no
 *      hace falta nada de esta web.
 *   4. Al volver, la web confirma el pago consultando /api/pedido.
 *
 * Variables de entorno (Vercel):
 *   STRIPE_SECRET_KEY                  clave secreta de Stripe (servidor)
 *   NEXT_PUBLIC_URL                    url base de la web
 *   N8N_WEBHOOK_URL                    opcional: webhook de n8n al que
 *                                      reenviar el pedido (por si se quiere
 *                                      notificar desde aquí en vez de usar el
 *                                      trigger de Stripe).
 */
export const PEDIDOS = {
  activo: true,

  /**
   * Webhook de n8n para_NOTIFICAR el pedido (después del pago).
   * Vacío = no se notifica desde la web (n8n ya recibe el evento de Stripe).
   */
  webhook:
    (import.meta.env?.VITE_N8N_NOTIFICAR_URL as string | undefined) || '',
};

/** Precio en euros a partir del texto de la carta ("12,00 €" -> 12). */
export function precioANumeroTexto(precio: string | number): number {
  if (typeof precio === 'number') return Number.isFinite(precio) ? precio : 0;
  const limpio = String(precio).replace(/[^\d,.-]/g, '');
  if (!limpio) return 0;
  const puntos = limpio.split('.').length - 1;
  let normalizado: string;
  if (limpio.includes(',')) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else if (puntos > 1) {
    normalizado = limpio.replace(/\./g, '');
  } else {
    normalizado = limpio;
  }
  const valor = parseFloat(normalizado);
  return Number.isFinite(valor) ? valor : 0;
}
