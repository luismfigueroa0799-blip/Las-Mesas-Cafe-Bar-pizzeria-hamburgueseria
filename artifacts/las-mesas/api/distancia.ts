// Calcula la distancia por carretera desde la dirección del cliente hasta el local
// usando Google Distance Matrix API. La clave de Google se lee de una variable
// de entorno de Vercel (GOOGLE_MAPS_API_KEY), nunca se expone al navegador.
type Global = Record<string, any>;
const g = globalThis as unknown as Global;

interface Req { method?: string; body?: unknown; }
interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
}

const ORIGEN_LOCAL = 'Pintor Antonio Padrón, 59, 35018 Las Mesas Bajas, Las Palmas de Gran Canaria, Spain';

interface Cuerpo {
  calle?: string;
  numero?: string;
  codigoPostal?: string;
  ciudad?: string;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if ((req.method ?? '').toUpperCase() !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = String((process.env as Record<string, string | undefined>).GOOGLE_MAPS_API_KEY ?? '').trim();
  if (!apiKey) {
    res.status(200).json({ km: null, error: 'Google Maps no está configurado en el servidor.' });
    return;
  }

  const body = (req.body ?? {}) as Cuerpo;
  const destino = [body.calle, body.numero, body.codigoPostal, body.ciudad]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(', ');

  if (destino.length < 6) {
    res.status(200).json({ km: null });
    return;
  }

  try {
    const url =
      'https://maps.googleapis.com/maps/api/distancematrix/json' +
      '?origins=' + encodeURIComponent(destino) +
      '&destinations=' + encodeURIComponent(ORIGEN_LOCAL) +
      '&units=metric&language=es&region=es' +
      '&key=' + encodeURIComponent(apiKey);

    const respuesta = await g.fetch(url);
    const datos = await respuesta.json();

    const elemento =
      datos?.rows?.[0]?.elements?.[0];
    if (!elemento || elemento.status !== 'OK') {
      res.status(200).json({ km: null, error: 'No se pudo calcular la distancia. Revisa la dirección.' });
      return;
    }

    const metros = Number(elemento.distance?.value ?? 0);
    const km = Math.round((metros / 1000) * 10) / 10;
    res.status(200).json({ km, duracion: elemento.duration?.text ?? '' });
  } catch (error) {
    console.log('[distancia] ERROR', error);
    res.status(200).json({ km: null, error: 'No se pudo calcular la distancia.' });
  }
}
