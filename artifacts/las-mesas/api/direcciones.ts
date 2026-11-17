// Consulta de direcciones por código postal usando Nominatim (OpenStreetMap).
// API pública, sin clave. Devuelve calles/poblaciones para un CP español.
type Global = Record<string, any>;
const g = globalThis as unknown as Global;

interface Req { method?: string; query?: Record<string, string | string[] | undefined>; }
interface Res {
  status(codigo: number): Res;
  json(cuerpo: unknown): void;
  setHeader(clave: string, valor: string): void;
  end(cuerpo?: unknown): void;
}

interface Sugerencia {
  calle: string;
  poblacion: string;
  etiqueta: string;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if ((req.method ?? '').toUpperCase() !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const cp = String(req.query?.cp ?? '').trim();
  if (!/^\d{5}$/.test(cp)) {
    res.status(200).json({ sugerencias: [] as Sugerencia[] });
    return;
  }

  try {
    const url =
      'https://nominatim.openstreetmap.org/search?postalcode=' +
      encodeURIComponent(cp) +
      '&country=Spain&format=jsonv2&addressdetails=1&limit=15';

    const respuesta = await g.fetch(url, {
      headers: {
        'User-Agent': 'LasMesasPedidos/1.0 (contacto@lasmesas.es)',
        'Accept-Language': 'es',
      },
    });
    const datos = await respuesta.json();

    const vistos = new Set<string>();
    const sugerencias: Sugerencia[] = [];
    if (Array.isArray(datos)) {
      for (const item of datos) {
        const addr = item.address || {};
        const calle = String(addr.road || addr.pedestrian || addr.footway || '').trim();
        const poblacion = String(
          addr.city || addr.town || addr.village || addr.municipality || addr.county || ''
        ).trim();
        if (!calle && !poblacion) continue;
        const etiqueta = [calle, poblacion].filter(Boolean).join(', ');
        const clave = etiqueta.toLowerCase();
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        sugerencias.push({ calle, poblacion, etiqueta });
      }
    }

    res.status(200).json({ sugerencias });
  } catch (error) {
    console.log('[direcciones] ERROR', error);
    res.status(200).json({ sugerencias: [] as Sugerencia[] });
  }
}
