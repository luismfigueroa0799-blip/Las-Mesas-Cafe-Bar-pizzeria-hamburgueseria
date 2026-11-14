// Sube una imagen de producto a Vercel Blob y devuelve su url publica.
//
//   POST /api/admin/upload
//   { "nombre": "foto.jpg", "contenido": "<base64 sin el prefijo data:...>" }
//
// La imagen la optimiza Vercel (webp y ancho maximo) para que la carta
// cargue rapido en el movil.
//
// Solo puede entrar el usuario staff: se valida el token contra Supabase Auth
// y se comprueba el rol 'staff'.
//
// Variables de entorno:
//   BLOB_READ_WRITE_TOKEN   token del Blob store (Vercel -> Storage)
//   SUPABASE_URL / SUPABASE_SECRET_KEY   para validar al usuario
//   STAFF_EMAILS            correos con acceso (o rol 'staff' en app_metadata)
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
  send(cuerpo: unknown): void;
}

/** Margen de ejecución de la función. */
export const maxDuration = 30;

/** Tamaño máximo de la imagen que se acepta (4 MB). */
const TAMANO_MAXIMO = 4 * 1024 * 1024;

function entorno(): Record<string, string | undefined> {
  return (g.process?.env ?? {}) as Record<string, string | undefined>;
}

const SUPABASE_URL_POR_DEFECTO = 'https://fohxajfpnriusuybdteu.supabase.co';

function urlSupabase(): string {
  const configurada = String(entorno().SUPABASE_URL ?? '').trim();
  if (/^https?:\/\/[^\s]+$/.test(configurada)) return configurada.replace(/\/+$/, '');
  return SUPABASE_URL_POR_DEFECTO;
}

function claveSupabase(): string {
  const env = entorno();
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

function correosStaff(): string[] {
  return String(entorno().STAFF_EMAILS ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function esStaff(usuario: any): boolean {
  const email = String(usuario?.email ?? '').trim().toLowerCase();
  if (!email) return false;
  const lista = correosStaff();
  if (lista.length && lista.includes(email)) return true;
  const roles = [
    usuario?.raw_app_meta_data?.role,
    usuario?.app_metadata?.role,
    usuario?.user_metadata?.role,
  ];
  return roles.some((r) => String(r ?? '').toLowerCase() === 'staff');
}

function valorCabecera(req: Req, nombre: string): string {
  const cabeceras: any = req?.headers;
  if (!cabeceras) return '';
  if (typeof cabeceras.get === 'function') return String(cabeceras.get(nombre) ?? '');
  const valor = cabeceras[nombre];
  return Array.isArray(valor) ? String(valor[0] ?? '') : String(valor ?? '');
}

function responder(res: Res, cuerpo: unknown, estado = 200): void {
  res.status(estado);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json(cuerpo);
}

function leerCuerpo(req: Req): Record<string, any> {
  const body = req?.body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return (body ?? {}) as Record<string, any>;
}

/** Nombre de fichero seguro para el almacen. */
function nombreSeguro(nombre: string): string {
  const base = String(nombre ?? 'imagen')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'imagen';
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (!req?.method || req.method !== 'POST') {
    responder(res, { error: 'Método no permitido' }, 405);
    return;
  }

  // ── 1) Solo el staff ──
  const token = valorCabecera(req, 'authorization');
  if (!token) {
    responder(res, { error: 'Necesitas iniciar sesión' }, 401);
    return;
  }
  const key = claveSupabase();
  let usuario: any = null;
  try {
    const r = await g.fetch(urlSupabase() + '/auth/v1/user', {
      headers: { apikey: key, Authorization: 'Bearer ' + token.replace(/^Bearer\s+/i, '') },
    });
    if (r.ok) usuario = await r.json();
  } catch {
    /* sin usuario */
  }
  if (!usuario) {
    responder(res, { error: 'La sesión ha caducado: vuelve a entrar' }, 401);
    return;
  }
  if (!esStaff(usuario)) {
    responder(res, { error: 'Acceso denegado: esta cuenta no es staff' }, 403);
    return;
  }

  // ── 3) El fichero ──
  const body = leerCuerpo(req);
  const nombre = String(body.nombre ?? 'imagen.jpg');
  const contenido = String(body.contenido ?? '');

  if (!contenido) {
    responder(res, { error: 'No se ha recibido la imagen' }, 400);
    return;
  }

  // Viene en base64 (el prefijo data:... se quita).
  const base64 = contenido.includes(',') ? contenido.slice(contenido.indexOf(',') + 1) : contenido;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    responder(res, { error: 'La imagen no se ha podido leer' }, 400);
    return;
  }

  if (!buffer.length) {
    responder(res, { error: 'El archivo de la imagen esta vacio' }, 400);
    return;
  }
  if (buffer.length > TAMANO_MAXIMO) {
    responder(res, { error: 'La imagen es demasiado grande (maximo 4 MB)' }, 413);
    return;
  }
  // Solo imagenes: se mira la firma del archivo (no el nombre).
  const esImagen =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; // jpeg
  const esPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e; // png
  const esWebp =
    buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  const esGif = buffer.slice(0, 3).toString('ascii') === 'GIF';
  if (!esImagen && !esPng && !esWebp && !esGif) {
    responder(res, { error: 'El archivo no es una imagen' }, 415);
    return;
  }

  // ── 4) El almacen ──
  const blobToken = String(entorno().BLOB_READ_WRITE_TOKEN ?? '').trim();
  if (!blobToken) {
    responder(
      res,
      {
        error:
          'El almacen de imagenes no esta configurado. Crea un Blob store en ' +
          'Vercel (Storage) y añade la variable BLOB_READ_WRITE_TOKEN.',
      },
      503,
    );
    return;
  }

  // ── 5) Subir a Vercel Blob ──
  try {
    const { putImage } = await import('@vercel/blob');
    const resultado = await putImage(
      `productos/${nombreSeguro(nombre)}.img`,
      buffer,
      {
        access: 'public',
        token: blobToken,
        addRandomSuffix: true,
        // Vercel optimiza la imagen (webp) y la deja como maximo de 1400 px.
        optimizeImage: { width: 1400, quality: 85 },
      },
    );
    responder(res, { ok: true, url: resultado.url, nombre: nombreSeguro(nombre) });
  } catch (error) {
    g.console?.error?.('[upload] no se pudo subir la imagen:', error);
    responder(res, { error: 'No se pudo subir la imagen al almacen' }, 502);
  }
}
