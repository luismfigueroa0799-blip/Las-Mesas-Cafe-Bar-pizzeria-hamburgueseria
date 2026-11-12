// Construcción del pedido que se envía a n8n.
// Compartido por /api/webhook (envío real) y /api/debug-pedido (diagnóstico).

export interface ItemPedido {
  id: string;
  name: string;
  qty: number;
  price: string;
}

/**
 * Telefono en formato canonico: solo digitos con prefijo 34 (p.ej. 34600000000).
 */
export function normalizarTelefono(valor: string | undefined): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 9) return `34${digitos}`;
  if (digitos.length === 10 && digitos.startsWith('6')) return `34${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('34')) return digitos;
  return digitos;
}

/**
 * Convierte el evento de Stripe en el pedido normalizado que recibe n8n.
 *
 * Estructura exacta (los nombres son los que hay que mapear en n8n):
 *
 *   {
 *     evento:      string   // "checkout.session.completed"
 *     idPedido:    string   // id de la sesión de Stripe
 *     idPago:      string   // id del payment_intent
 *     fecha:       string   // ISO 8601
 *     modoPrueba:  boolean
 *
 *     correo:      string
 *     nombre:      string
 *     telefono:    string   // "34600000000" (solo dígitos con prefijo 34)
 *     cliente_telefono: string  // mismo valor que telefono
 *
 *     tipoEntrega: string   // "recogida" | "domicilio"
 *     recogida:    boolean
 *     domicilio:   boolean
 *     direccion:   string   // dirección en una línea
 *     direccionDetalle: {
 *       calle, numero, piso, codigoPostal, ciudad, pais
 *     }
 *     modoRecogida: string  // "recogida" | "domicilio" | "mesa"
 *     mesa:        string
 *
 *     total:       string   // "14.80"  (Euros con punto decimal)
 *     subtotal:    string
 *     impuestos:   string
 *     moneda:      string   // "eur"
 *     metodoPago:  string   // "card"
 *
 *     articulos:   ItemPedido[]   // { id, name, qty, price }
 *                              //   price es el texto de la carta ("12,00 €")
 *
 *     urlOrigen:   string
 *     restaurante:  string
 *     telefonoRestaurante:  string
 *     whatsappRestaurante:  string
 *   }
 */
export function construirPedido(evento: any): Record<string, unknown> {
  const datos = (evento?.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento?.object ?? {}) as Record<string, any>;
  const detalles = (objeto.customer_details ?? {}) as Record<string, any>;
  const metadata = (objeto.metadata ?? {}) as Record<string, any>;

  // Dirección: si Stripe la recogió de forma nativa (envío a domicilio) tiene
  // prioridad sobre la que rellenó el cliente en el carrito.
  const envio = (objeto.shipping ?? null) as Record<string, any> | null;
  const direccionStripe = envio?.address
    ? {
        calle: [envio.address.line1, envio.address.line2].filter(Boolean).join(', '),
        codigoPostal: envio.address.postal_code ?? '',
        ciudad: envio.address.city ?? '',
        pais: envio.address.country ?? '',
      }
    : null;

  const direccion = {
    calle: metadata.calle ?? direccionStripe?.calle ?? '',
    numero: metadata.numero ?? '',
    piso: metadata.piso ?? '',
    codigoPostal: metadata.codigoPostal ?? direccionStripe?.codigoPostal ?? '',
    ciudad: metadata.ciudad ?? direccionStripe?.ciudad ?? '',
    pais: direccionStripe?.pais ?? 'ES',
  };
  const direccionCompleta =
    metadata.direccion ||
    [
      direccion.calle,
      direccion.numero,
      direccion.piso,
      direccion.codigoPostal,
      direccion.ciudad,
    ]
      .filter(Boolean)
      .join(', ');

  let articulos: ItemPedido[] = [];
  try {
    articulos = metadata.items ? JSON.parse(metadata.items) : [];
  } catch {
    articulos = [];
  }

  const tipoEntrega = metadata.tipoEntrega ?? (envio ? 'domicilio' : 'recogida');
  const telefono = normalizarTelefono(
    metadata.cliente_telefono ?? metadata.telefono ?? detalles.phone ?? '',
  );

  return {
    // Identificación
    evento: String(evento?.type ?? 'checkout.session.completed'),
    idPedido: objeto.id ?? '',
    idPago: objeto.payment_intent ?? '',
    fecha: objeto.created
      ? new Date(objeto.created * 1000).toISOString()
      : new Date().toISOString(),
    modoPrueba: evento?.livemode !== true,

    // Cliente
    correo: metadata.correo ?? detalles.email ?? objeto.customer_email ?? '',
    nombre: metadata.nombre ?? detalles.name ?? '',
    telefono,
    cliente_telefono: telefono,

    // Entrega
    tipoEntrega,
    recogida: tipoEntrega === 'recogida',
    domicilio: tipoEntrega === 'domicilio',
    direccion: direccionCompleta,
    direccionDetalle: direccion,
    modoRecogida:
      metadata.modoRecogida ?? (tipoEntrega === 'recogida' ? 'recogida' : 'domicilio'),
    mesa: metadata.mesa ?? '',

    // Dinero
    total: objeto.amount_total ? (objeto.amount_total / 100).toFixed(2) : '',
    subtotal: objeto.amount_subtotal ? (objeto.amount_subtotal / 100).toFixed(2) : '',
    impuestos: objeto.total_tax_amounts?.length
      ? (objeto.total_tax_amounts[0].amount / 100).toFixed(2)
      : '0.00',
    moneda: objeto.currency ?? 'eur',
    metodoPago: objeto.payment_method_types?.[0] ?? '',

    // Artículos
    articulos,

    // Contexto
    urlOrigen: metadata.urlOrigen ?? '',
    restaurante: 'Las Mesas · Café & Bar',
    telefonoRestaurante: '+34 928 896 097',
    whatsappRestaurante: '346010000000',
  };
}
