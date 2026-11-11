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
 * Rellena `webhook` con la URL del flujo de n8n que crea la sesión de pago.
 * Mientras esté vacía, el carrito sigue funcionando y se usa la ruta
 * alternativa /api/checkout (si está desplegada).
 */
export const PEDIDOS = {
  activo: true,
  /** URL del webhook de n8n que crea la sesión de pago y devuelve { url }. */
  webhook: '',
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
  recargarEn?: string;
}
