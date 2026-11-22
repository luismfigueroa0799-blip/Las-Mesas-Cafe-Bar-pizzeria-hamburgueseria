// Creación de sesión de pago para pedidos de MESA (QR de mesa).
//
// Flujo:
//   1. Esta API valida que haya mesa (1-9) y envía los datos al webhook de n8n
//      `crear-pedido-mesa`, que:
//        - recalcula precios contra Neon (`products`),
//        - inserta el pedido en Neon (`pedidos`) con tipo_entrega='mesa' y mesa,
//        - crea la sesión de Stripe con metadata de mesa,
//        - devuelve { ok, pedido_id, total_cents, checkout_url }.
//   2. El navegador redirige al checkout_url.
//
// Variables de entorno:
//   N8N_WEBHOOK_MESA_URL  → webhook de n8n para pedidos de mesa (crear-pedido-mesa)
//
// Estilo Node (req, res) de serverless functions de Vercel.

type Global = Record<string, any>;
const g = globalThis as unknown as Global;

interface Req {
  method?: string;
  url?: string;
  headers?:
    | { get?: (nombre: string) => string | null }
    | Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
  send(cuerpo: unknown): void;
}

interface ItemCarrito {
  id: string;
  name?: string;
  price?: string;
  image?: string;
  quantity: number;
}

const N8N_WEBHOOK_MESA_POR_DEFECTO =
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app/api/crear-pedido-mesa';

function leerCuerpo(req: Req): any {
  return req.body;
}

function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado).json(cuerpo);
}

function log(mensaje: string, datos?: unknown): void {
  // eslint-disable-next-line no-console
  console.log(`[checkout-mesa] ${mensaje}`, datos ?? '');
}

function urlWebhookN8n(produccion: boolean): string {
  const env = process.env as Record<string, string | undefined>;
  const configurada = env.N8N_WEBHOOK_MESA_URL ?? '';
  if (configurada) return configurada;
  return N8N_WEBHOOK_MESA_POR_DEFECTO.replace(
    /\/$/, ''
  );
}

let poolHorario: any = null;
async function pedidoPermitidoPorHorario(): Promise<boolean> {
  const horarioInicial = { semanal: [
    [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }],
    [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '18:00', fin: '23:00' }],
    [{ inicio: '18:00', fin: '23:00' }], [{ inicio: '12:00', fin: '15:00' }, { inicio: '18:00', fin: '23:00' }],
    [{ inicio: '12:00', fin: '17:00' }],
  ], festivos: [] as any[] };
  try {
    const env = (g.process?.env ?? {}) as Record<string, string | undefined>;
    const connection = String(env.DATABASE_URL ?? env.NEON_DATABASE_URL ?? '').trim();
    if (connection && !poolHorario) {
      const pg: any = await import('pg'); const Pool = pg?.default?.Pool ?? pg?.Pool;
      if (Pool) poolHorario = new Pool({ connectionString: connection, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, ssl: connection.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false } });
    }
    const filas = poolHorario ? await poolHorario.query('select config from public.business_hours where id=$1', ['local']).then((r: any) => r.rows ?? []).catch(() => []) : [];
    const horario = filas[0]?.config ?? horarioInicial;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Atlantic/Canary', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const dia = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as Record<string, number>)[values.weekday] ?? 0;
    const fecha = `${values.year}-${values.month}-${values.day}`;
    const festivo = Array.isArray(horario.festivos) ? horario.festivos.find((item: any) => item.fecha === fecha) : undefined;
    if (festivo?.cerrado) return false;
    const tramos = festivo ? festivo.tramos ?? [] : horario.semanal?.[dia] ?? [];
    const minutos = Number(values.hour) * 60 + Number(values.minute);
    return tramos.some((tramo: any) => {
      const inicio = Number(String(tramo.inicio).slice(0, 2)) * 60 + Number(String(tramo.inicio).slice(3, 5));
      const fin = Number(String(tramo.fin).slice(0, 2)) * 60 + Number(String(tramo.fin).slice(3, 5));
      return minutos >= inicio && minutos < fin;
    });
  } catch (error) {
    log('No se pudo consultar el horario guardado; se mantiene el horario habitual.', error);
    return true;
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if ((req.method ?? '').toUpperCase() !== 'POST') {
    return responder(res, { error: 'Método no permitido' }, 405);
  }

  let body: any;
  try {
    body = leerCuerpo(req);
  } catch {
    return responder(res, { error: 'Cuerpo de la petición no válido' }, 400);
  }

  const {
    items,
    customerName,
    customerEmail,
    telefono,
    tipoEntrega,
    total,
    direccion,
    mesa,
    urlOrigen,
  } = body ?? {};

  // Validar mesa entre 1 y 9
  const mesaNum = Number(mesa);
  if (!Number.isInteger(mesaNum) || mesaNum < 1 || mesaNum > 9) {
    return responder(
      res,
      { error: 'Mesa inválida: debe ser un número del 1 al 9' },
      400
    );
  }

  if (!(await pedidoPermitidoPorHorario())) {
    return responder(res, { error: 'El local está cerrado en este momento y no se pueden enviar pedidos por mesa.' }, 403);
  }

  // Validar items
  if (!Array.isArray(items) || items.length === 0) {
    return responder(res, { error: 'El carrito está vacío' }, 400);
  }

  // El flujo de mesa de n8n vuelve a cobrar los precios completos. Si hay un
  // premio, usamos el checkout propio que valida el token y fija su línea a 0 €.
  if (items.some((item: any) => item?.isPrize === true)) {
    const checkout = await import('./checkout.js');
    await checkout.default(req, res);
    return;
  }

  const webhook = urlWebhookN8n(true);
  if (!webhook) {
    log('N8N_WEBHOOK_MESA_URL no está configurada');
    return responder(
      res,
      { error: 'El servidor de pedidos no está configurado' },
      503
    );
  }

  log('[checkout-mesa] ENVIANDO A N8N', {
    mesa: mesaNum,
    total,
    cliente: customerName,
  });

  try {
    const respuesta = await g.fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        customerName,
        customerEmail,
        telefono,
        tipoEntrega: 'mesa',
        total: Number(total).toFixed(2),
        direccion: direccion ?? '',
        mesa: String(mesaNum),
        urlOrigen: urlOrigen ?? '',
      }),
    });

    const texto = await respuesta.text();
    let datosRespuesta: any = null;
    try {
      datosRespuesta = JSON.parse(texto);
    } catch {
      datosRespuesta = null;
    }

    if (!respuesta.ok) {
      const motivo =
        datosRespuesta?.error ??
        datosRespuesta?.mensaje ??
        datosRespuesta?.detail ??
        texto.slice(0, 220) ??
        `HTTP ${respuesta.status}`;
      log('[checkout-mesa] N8N respondió con error', motivo);
      return responder(res, { error: motivo }, respuesta.status);
    }

    log('[checkout-mesa] RESPUESTA DE N8N', {
      ok: datosRespuesta?.ok,
      pedido_id: datosRespuesta?.pedido_id,
      checkout_url: datosRespuesta?.checkout_url,
    });

    return responder(res, datosRespuesta ?? { ok: true }, 200);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return responder(
        res,
        { error: 'El servidor no ha respondido. Revisa tu conexión.' },
        504
      );
    }
    log('[checkout-mesa] EXCEPCIÓN', error);
    return responder(
      res,
      { error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' },
      500
    );
  }
}

