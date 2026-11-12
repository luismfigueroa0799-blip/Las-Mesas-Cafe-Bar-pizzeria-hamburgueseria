// Cliente minimo de Supabase via su API REST (sin dependencias npm).
//
// Se usa desde las API Routes para:
//   - Crear la fila en la tabla `pedidos` antes de abrir la pasarela de
//     Stripe, de modo que el flujo de n8n la encuentre y notifique el pedido
//     con el detalle y el total correctos.
//   - Actualizar el estado a 'pendiente_confirmacion' cuando se confirma el
//     pago.
//
// Variables de entorno:
//   SUPABASE_URL               (ej. https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY  (necesaria para escribir: la tabla `pedidos`
//                               tiene RLS y no admite la clave publica)

type Global = Record<string, any>;

const g = globalThis as unknown as Global;

export interface LineaPedido {
  id: string;
  nombre: string;
  unit: number;
  qty: number;
  subtotal: number;
}

export interface PedidoNuevo {
  id: string;
  mesa_id: number | null;
  tipo: 'mesa' | 'domicilio';
  items: LineaPedido[];
  total: number;
  estado: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  direccion: string | null;
  stripe_session_id?: string | null;
}

function config(): { url: string; key: string } | null {
  const env = (g.process?.env ?? {}) as Record<string, string | undefined>;
  const url = (env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return { url, key };
}

/** ¿Está configurado el acceso de escritura a Supabase? */
export function supabaseDisponible(): boolean {
  return config() !== null;
}

/** Genera un UUID v4 (el id de la tabla `pedidos` es de tipo uuid). */
export function generarUuid(): string {
  const c = g.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function peticion(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<{ ok: boolean; status: number; datos: any }> {
  const cfg = config();
  if (!cfg) return { ok: false, status: 0, datos: null };

  try {
    const respuesta = await g.fetch(`${cfg.url}/rest/v1/${ruta}`, {
      method: metodo,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });

    const texto = await respuesta.text();
    let datos: any = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = texto;
    }
    return { ok: respuesta.ok, status: respuesta.status, datos };
  } catch (error) {
    const c = g.console;
    if (c && typeof c.error === 'function') c.error('[supabase] error:', error);
    return { ok: false, status: 0, datos: null };
  }
}

/**
 * Inserta el pedido en la tabla `pedidos`.
 * Si Supabase no está configurado devuelve null y el flujo de n8n será el que
 * cree la fila.
 */
export async function crearPedido(pedido: PedidoNuevo): Promise<string | null> {
  if (!supabaseDisponible()) return null;

  const resultado = await peticion('pedidos', 'POST', {
    id: pedido.id,
    mesa_id: pedido.mesa_id,
    tipo: pedido.tipo,
    items: pedido.items,
    total: pedido.total,
    estado: pedido.estado,
    cliente_nombre: pedido.cliente_nombre,
    cliente_telefono: pedido.cliente_telefono,
    direccion: pedido.direccion,
    stripe_session_id: pedido.stripe_session_id ?? null,
  });

  if (!resultado.ok) {
    const c = g.console;
    if (c && typeof c.error === 'function') {
      c.error('[supabase] no se pudo crear el pedido:', resultado.datos);
    }
    return null;
  }
  return pedido.id;
}

/** Guarda el id de sesión de Stripe en el pedido. */
export async function guardarSessionId(pedidoId: string, sessionId: string): Promise<void> {
  if (!supabaseDisponible()) return;
  await peticion(`pedidos?id=eq.${pedidoId}`, 'PATCH', {
    stripe_session_id: sessionId,
  });
}

/** Marca el pedido como pagado (a la espera de confirmación del personal). */
export async function marcarPagado(
  pedidoId: string,
  paymentIntent?: string | null,
): Promise<void> {
  if (!supabaseDisponible()) return;
  await peticion(`pedidos?id=eq.${pedidoId}`, 'PATCH', {
    estado: 'pendiente_confirmacion',
    stripe_payment_intent: paymentIntent ?? null,
    pagado_at: new Date().toISOString(),
  });
}
