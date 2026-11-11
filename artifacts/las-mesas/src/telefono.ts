/**
 * Normalización de teléfono.
 *
 * El webhook de n8n (`crear-pedido-domicilio`) espera el campo
 * `cliente_telefono` y acepta varios formatos (600000000, +34600000000,
 * "600 00 00 00"…). Para no depender de cómo lo escriba la persona, se
 * normaliza siempre al formato canónico: SOLO DÍGITOS, con el prefijo
 * internacional 34 y sin espacios ni guiones.
 *
 *   "600 00 00 00"        -> "34600000000"
 *   "+34 600 00 00 00"    -> "34600000000"
 *   "600000000"           -> "34600000000"
 *   "928 89 60 97"        -> "34928896097"
 */

const PREFIJO_ES = '34';

/** Deja solo los dígitos de un texto. */
export function soloDigitos(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null) return '';
  return String(valor).replace(/\D/g, '');
}

/**
 * Devuelve el teléfono en formato E.164 sin "+" (solo dígitos), con el
 * prefijo 34 si parece un teléfono español.
 *
 * Si el número no es válido devuelve la cadena de dígitos sin prefijo, para
 * no perder información.
 */
export function normalizarTelefono(valor: string | number | undefined | null): string {
  const digitos = soloDigitos(valor);
  if (!digitos) return '';

  // 9 dígitos: teléfono español sin prefijo.
  if (digitos.length === 9) return PREFIJO_ES + digitos;

  // 10 u 11 dígitos: puede venir con el 34 delante o sin él.
  if (digitos.length === 10 && digitos.startsWith('6')) {
    return PREFIJO_ES + digitos;
  }
  if (digitos.length === 11 && digitos.startsWith('34')) {
    return digitos;
  }

  return digitos;
}

/** Comprueba que un teléfono tiene entre 9 y 15 dígitos. */
export function telefonoValido(valor: string | number | undefined | null): boolean {
  const digitos = soloDigitos(valor);
  return digitos.length >= 9 && digitos.length <= 15;
}
