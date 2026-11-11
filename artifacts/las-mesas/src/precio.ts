/**
 * Convierte un precio escrito en formato español ("9,50 €", "12,00", "1.234,56")
 * en número.
 *
 * OJO: `parseFloat("9,50 €")` devuelve 9 porque parseFloat se detiene en la coma
 * y descarta los céntimos. Eso hacía que el total del carrito fuera menor que
 * la suma real (por ejemplo 0,50 € menos en un plato de 9,50 €).
 */
export function precioANumero(precio: string | number): number {
  if (typeof precio === 'number') {
    return Number.isFinite(precio) ? precio : 0;
  }

  const texto = String(precio).trim();
  if (!texto) return 0;

  const limpio = texto.replace(/[^\d,.-]/g, '');
  if (!limpio) return 0;

  const partes = limpio.split('.');
  const tieneComa = limpio.includes(',');
  const tienePunto = partes.length - 1;

  let normalizado: string;
  if (tieneComa) {
    // Formato español: "1.234,56" -> "1234.56"
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else if (tienePunto > 1) {
    // Miles con punto: "1.234" -> "1234"
    normalizado = limpio.replace(/\./g, '');
  } else {
    // "12.00" o "12" -> tal cual
    normalizado = limpio;
  }

  const valor = parseFloat(normalizado);
  return Number.isFinite(valor) ? valor : 0;
}

/** Convierte un precio en euros a céntimos (entero) para Stripe. */
export function precioACentavos(precio: string | number): number {
  return Math.round(precioANumero(precio) * 100);
}

/** Formatea un número como precio en euros: 9.5 -> "9,50 €" */
export function formatearPrecio(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')} €`;
}
