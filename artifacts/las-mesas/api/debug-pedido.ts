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

import { construirPedido } from './_shared/pedido';

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

/** Evento de Stripe de ejemplo (como lo manda checkout.session.completed). */
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
          urlOrigen: 'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app/#carta',
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

  res.status(200);
  res.json({
    // El payload EXACTO que se envia a n8n:
    pedido,
    // Lista plana de claves para mapear en n8n:
    claves: Object.keys(pedido),
    clavesArticulo: Object.keys((pedido.articulos as any[])?.[0] ?? {}),
    // Recordatorio del formato de los articulos:
    ejemploArticulo: (pedido.articulos as any[])?.[0] ?? null,
  });
}
