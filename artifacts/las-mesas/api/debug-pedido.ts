// Endpoint de diagnostico: devuelve EXACTAMENTE el JSON que se envia a n8n.
//
// Sirve para:
//   - Ver las claves y el formato de los datos que llegan a n8n.
//   - Copiar un ejemplo real al n8n para mapear los nodos.
//   - Probar el flujo sin pasar por Stripe.
//
// Uso:
//   GET  /api/debug-pedido                  -> ejemplo con datos de muestra
//   POST /api/debug-pedido  (evento Stripe) -> el payload de ese evento
//
// IMPORTANTE: las serverless functions de Vercel usan el estilo Node (req, res).
type Global = Record<string, any>;

const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  headers?: { get?: (nombre: string) => string | null };
  body?: unknown;
}

interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
}

/** Telefono en formato canonico: solo digitos con prefijo 34. */
function normalizarTelefono(valor: string | undefined): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length === 9) return `34${digitos}`;
  if (digitos.length === 10 && digitos.startsWith('6')) return `34${digitos}`;
  if (digitos.length === 11 && digitos.startsWith('34')) return digitos;
  return digitos;
}

/**
 * Convierte el evento de Stripe en el pedido normalizado que recibe n8n.
 * (Misma funcion que usa /api/webhook.)
 */
function construirPedido(evento: any): Record<string, unknown> {
  const datos = (evento?.data ?? {}) as Record<string, any>;
  const objeto = (datos.object ?? evento?.object ?? {}) as Record<string, any>;
  const detalles = (objeto.customer_details ?? {}) as Record<string, any>;
  const metadata = (objeto.metadata ?? {}) as Record<string, any>;

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

  let articulos: any[] = [];
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
    evento: String(evento?.type ?? 'checkout.session.completed'),
    idPedido: objeto.id ?? '',
    idPago: objeto.payment_intent ?? '',
    fecha: objeto.created
      ? new Date(objeto.created * 1000).toISOString()
      : new Date().toISOString(),
    modoPrueba: evento?.livemode !== true,

    correo: metadata.correo ?? detalles.email ?? objeto.customer_email ?? '',
    nombre: metadata.nombre ?? detalles.name ?? '',
    telefono,
    cliente_telefono: telefono,

    tipoEntrega,
    recogida: tipoEntrega === 'recogida',
    domicilio: tipoEntrega === 'domicilio',
    direccion: direccionCompleta,
    direccionDetalle: direccion,
    modoRecogida:
      metadata.modoRecogida ?? (tipoEntrega === 'recogida' ? 'recogida' : 'domicilio'),
    mesa: metadata.mesa ?? '',

    total: objeto.amount_total ? (objeto.amount_total / 100).toFixed(2) : '',
    subtotal: objeto.amount_subtotal ? (objeto.amount_subtotal / 100).toFixed(2) : '',
    impuestos: objeto.total_tax_amounts?.length
      ? (objeto.total_tax_amounts[0].amount / 100).toFixed(2)
      : '0.00',
    moneda: objeto.currency ?? 'eur',
    metodoPago: objeto.payment_method_types?.[0] ?? '',

    articulos,

    urlOrigen: metadata.urlOrigen ?? '',
    restaurante: 'Las Mesas · Café & Bar',
    telefonoRestaurante: '+34 928 896 097',
    whatsappRestaurante: '346010000000',
  };
}

/** Evento de Stripe de ejemplo. */
function eventoDeEjemplo(): Record<string, unknown> {
  return {
    id: 'evt_1ABCdef',
    type: 'checkout.session.completed',
    livemode: false,
    created: 1762900000,
    data: {
      object: {
        id: 'cs_test_a1B2c3D4e5F6g7H8i9J0',
        object: 'checkout.session',
        payment_intent: 'pi_test_X9Y8Z7W6v5U4',
        amount_total: 1480,
        amount_subtotal: 1480,
        currency: 'eur',
        payment_method_types: ['card'],
        customer_email: 'cliente@ejemplo.com',
        customer_details: {
          email: 'cliente@ejemplo.com',
          name: 'Ana Pérez',
          phone: '600000000',
        },
        metadata: {
          nombre: 'Ana Pérez',
          telefono: '34600000000',
          cliente_telefono: '34600000000',
          correo: 'cliente@ejemplo.com',
          tipoEntrega: 'domicilio',
          recogida: 'false',
          domicilio: 'true',
          direccion: 'Calle Mayor, nº 24, 3º B, 35018, Las Palmas de Gran Canaria',
          calle: 'Calle Mayor',
          numero: '24',
          piso: '3º B',
          codigoPostal: '35018',
          ciudad: 'Las Palmas de Gran Canaria',
          modoRecogida: 'domicilio',
          mesa: '',
          urlOrigen: 'https://lasmesasbarcafet.com/#carta',
          items: JSON.stringify([
            { id: '3', name: 'Burger Pizza', qty: 1, price: '12,00 €' },
            { id: '62', name: 'Tropical', qty: 2, price: '1,40 €' },
          ]),
        },
        shipping: {
          address: {
            line1: 'Calle Mayor, nº 24, 3º B',
            line2: '',
            postal_code: '35018',
            city: 'Las Palmas de Gran Canaria',
            country: 'ES',
          },
        },
      },
    },
  };
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  let evento: unknown = null;
  if (req?.method === 'POST') {
    const body = req.body;
    if (typeof body === 'string') {
      try {
        evento = JSON.parse(body);
      } catch {
        evento = null;
      }
    } else if (body && typeof body === 'object') {
      evento = body;
    }
  }

  if (!evento) evento = eventoDeEjemplo();

  const pedido = construirPedido(evento);
  const articulos = (pedido.articulos ?? []) as any[];

  res.status(200);
  res.json({
    pedido,
    claves: Object.keys(pedido),
    clavesArticulo: Object.keys(articulos[0] ?? {}),
    ejemploArticulo: articulos[0] ?? null,
  });
}
