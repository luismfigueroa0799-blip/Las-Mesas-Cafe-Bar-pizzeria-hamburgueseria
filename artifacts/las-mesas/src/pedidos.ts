/**
 * Configuración de pedidos online.
 *
 * PATRÓN (copiado del sitio estático que ya funciona en producción):
 * el navegador NO crea la sesión de Stripe por su cuenta. Llama por POST al
 * webhook de n8n, que es quien tiene la clave secreta de Stripe, y n8n
 * responde { "url": "https://checkout.stripe.com/..." }. El navegador redirige
 * a esa url.
 *
 * Ventajas frente a hacerlo en el navegador:
 *  - La clave secreta de Stripe nunca sale de n8n.
 *  - No hacen falta serverless functions ni variables de entorno en Vercel.
 *  - El flujo no depende del Root Directory, del alias de producción ni de
 *    la autenticación de Vercel.
 *
 * ── LAS DOS URLs DEL MISMO FLUJO ────────────────────────────────────────
 *
 *   PRUEBAS    .../webhook-test/<id>/webhook
 *              Solo responde UNA llamada, y hay que pulsar antes
 *              "Execute workflow" en el canvas de n8n.
 *
 *   PRODUCCIÓN .../webhook/<id>/webhook
 *              Siempre disponible, pero el workflow debe estar ACTIVO
 *              (toggle arriba a la derecha en el editor de n8n).
 *
 * Por defecto se usa la de PRODUCCIÓN. Para hacer una prueba puntual con la
 * de pruebas, pon USAR_WEBHOOK_DE_PRUEBAS = true.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Identificador del flujo de n8n. */
const WORKFLOW_ID = '6c8d3a58-72e0-4cce-a773-ddd1382fddbd';

const WEBHOOK_PRODUCCION = 'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';
const WEBHOOK_PRUEBAS = 'https://barcafeteria.app.n8n.cloud/webhook-test/crear-pedido-domicilio';

/**
 * Ponlo en true solo si vas a probar y no quieres pasar por producción.
 * Recuerda que en modo pruebas hay que pulsar "Execute workflow" en n8n.
 */
export const USAR_WEBHOOK_DE_PRUEBAS = false;

export const PEDIDOS = {
  activo: true,
  /**
   * URL del webhook de n8n que crea la sesión de pago y devuelve { url }.
   * Orden de prioridad:
   *   1. Variable de entorno VITE_N8N_WEBHOOK_URL (configurable en Vercel).
   *   2. El flag USAR_WEBHOOK_DE_PRUEBAS.
   *   3. La URL de producción.
   */
  webhook:
    (import.meta.env?.VITE_N8N_WEBHOOK_URL as string | undefined) ||
    (USAR_WEBHOOK_DE_PRUEBAS ? WEBHOOK_PRUEBAS : WEBHOOK_PRODUCCION),

  /** URL de producción (el workflow debe estar activo en n8n). */
  webhookProduccion: WEBHOOK_PRODUCCION,

  /** URL de pruebas (acepta una llamada tras pulsar "Execute workflow"). */
  webhookPruebas: WEBHOOK_PRUEBAS,
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

/** Cuerpo que espera el webhook de n8n (mismo contrato que el sitio estático). */
export interface CuerpoPedido {
  tipo: 'mesa' | 'recoger' | 'domicilio';
  mesa: string;
  nombre: string;
  telefono: string;
  notas: string;
  items: Array<{ nombre: string; cantidad: number; precio: number }>;
  total: number;
  // Campos extra por si el flujo de n8n los necesita.
  email?: string;
  direccion?: string;
  codigoPostal?: string;
  ciudad?: string;
}
