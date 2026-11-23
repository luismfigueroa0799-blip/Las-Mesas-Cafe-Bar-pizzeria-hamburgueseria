import { useEffect, useRef, useState } from 'react';
import { Gift, LoaderCircle, X } from 'lucide-react';
import { useCart } from '@/CartContext';
import { formatearPrecio } from '@/precio';
import { EVENTO_CONSENTIMIENTO, leerConsentimiento } from '@/privacidad-consentimiento';

type Sector = { id: string; name: string; image?: string | null; weight: number; premiable?: boolean; sinPremio?: boolean; color?: string };
type Premio = { id: string; name: string; price: number; image?: string | null };

const CLIENTE_KEY = 'lm_ruleta_cliente_v1';
const RULETA_SESION_VISTA_KEY = 'lm_ruleta_vista_sesion_v1';
function idCliente(): string {
  let id = window.localStorage.getItem(CLIENTE_KEY);
  if (!id) {
    id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(CLIENTE_KEY, id);
  }
  return id;
}

export default function RuletaPremio({ onAbrirCarrito }: { onAbrirCarrito: () => void }) {
  const { addToCart } = useCart();
  const [abierta, setAbierta] = useState(false);
  const [girando, setGirando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [premio, setPremio] = useState<Premio | null>(null);
  const [error, setError] = useState('');
  const [mensajeResultado, setMensajeResultado] = useState('');
  const [rotacion, setRotacion] = useState(0);
  const [resultado, setResultado] = useState<'ganador' | 'sin-premio' | null>(null);
  const [reintentoPreparacion, setReintentoPreparacion] = useState(0);
  const temporizador = useRef<number | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const abrirSiConsentido = () => {
      if (!leerConsentimiento()?.ruleta) return;
      // sessionStorage evita reabrirla al recargar durante la misma sesión.
      try {
        if (window.sessionStorage.getItem(RULETA_SESION_VISTA_KEY) === '1') return;
      } catch { /* se puede seguir usando la ruleta en esta sesión */ }
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try { window.sessionStorage.setItem(RULETA_SESION_VISTA_KEY, '1'); } catch { /* almacenamiento opcional */ }
        setAbierta(true);
      }, 700);
    };
    abrirSiConsentido();
    window.addEventListener(EVENTO_CONSENTIMIENTO, abrirSiConsentido);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener(EVENTO_CONSENTIMIENTO, abrirSiConsentido);
    };
  }, []);

  useEffect(() => () => { if (temporizador.current) window.clearTimeout(temporizador.current); }, []);

  useEffect(() => {
    if (!abierta) return;
    let cancelado = false;
    setPreparando(true);
    setError('');
    setSessionId('');
    setSectores([]);
    fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preparar-ruleta', clientId: idCliente() }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo preparar la ruleta.');
      const lista: Sector[] = Array.isArray(data.sectores) ? data.sectores : [];
      if (!data.sessionId || lista.length !== 10
        || lista.filter((sector) => sector.premiable).length !== 9
        || lista.filter((sector) => sector.sinPremio).length !== 1
        || lista.some((sector) => Math.abs(Number(sector.weight) - 0.1) > 0.000001)) {
        throw new Error('No se pudo preparar la ruleta. Recarga la página.');
      }
      if (!cancelado) {
        setSectores(lista);
        setSessionId(data.sessionId);
      }
    }).catch((e) => {
      if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo preparar la ruleta.');
    }).finally(() => {
      if (!cancelado) setPreparando(false);
    });
    return () => { cancelado = true; };
  }, [abierta, reintentoPreparacion]);

  function cerrar() {
    if (girando) return;
    try { window.sessionStorage.setItem(RULETA_SESION_VISTA_KEY, '1'); } catch { /* almacenamiento opcional */ }
    setAbierta(false);
  }

  async function girar() {
    if (girando || preparando || !sessionId) return;
    setGirando(true);
    setError('');
    setMensajeResultado('');
    try {
      const response = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ruleta', clientId: idCliente(), sessionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo iniciar la ruleta.');
      const lista: Sector[] = Array.isArray(data.sectores) ? data.sectores : [];
      const gano = data.ganador === true;
      const regalo: Premio | null = gano ? data.premio : null;
      if (!lista.length || !Number.isInteger(Number(data.indiceResultado)) || (gano && (!regalo?.id || !data.token))) {
        throw new Error('La ruleta no devolvió un resultado válido.');
      }
      setSectores(lista);
      setPremio(regalo);
      const indice = Math.min(lista.length - 1, Math.max(0, Number(data.indiceResultado)));
      const totalPeso = lista.reduce((sum, sector) => sum + Math.max(0, Number(sector.weight) || 0), 0) || lista.length;
      let pesoAntes = 0;
      for (let i = 0; i < indice; i += 1) pesoAntes += Math.max(0, Number(lista[i].weight) || 1);
      const pesoSector = Math.max(0, Number(lista[indice].weight) || 1);
      const centro = ((pesoAntes + pesoSector / 2) / totalPeso) * 360;
      const destino = 360 - centro;
      setRotacion((prev) => prev + 360 * 6 + ((destino - (prev % 360) + 360) % 360));
      temporizador.current = window.setTimeout(() => {
        if (gano && regalo) {
          addToCart({
            id: regalo.id,
            name: regalo.name,
            price: formatearPrecio(regalo.price),
            image: regalo.image || '',
            opciones: [],
            nota: '',
            isPrize: true,
            prizeToken: data.token,
          });
        }
        if (!gano) {
          setMensajeResultado('Esta vez no te ha tocado. ¡Gracias por jugar!');
        }
        setGirando(false);
        setResultado(gano ? 'ganador' : 'sin-premio');
        temporizador.current = window.setTimeout(() => {
          try { window.sessionStorage.setItem(RULETA_SESION_VISTA_KEY, '1'); } catch { /* almacenamiento opcional */ }
          setAbierta(false);
          if (gano) onAbrirCarrito();
        }, gano ? 1400 : 2300);
      }, 5750);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la ruleta. Inténtalo de nuevo.');
      setGirando(false);
    }
  }

  if (!abierta) return null;
  let acumulado = 0;
  const totalPesoRuleta = sectores.reduce((sum, sector) => sum + (Number(sector.weight) || 0), 0);
  const sectoresVisibles = sectores.map((sector, i) => {
    const peso = Math.max(0, Number(sector.weight) || 0);
    const inicio = acumulado;
    acumulado += totalPesoRuleta
      ? peso / totalPesoRuleta * 360
      : 360 / sectores.length;
    return { ...sector, inicio, fin: acumulado, centro: (inicio + acumulado) / 2, indice: i };
  });
  const colores = sectores.length
    ? `repeating-conic-gradient(from -0.5deg,rgba(55,43,20,.88) 0deg .7deg,transparent .7deg 36deg),conic-gradient(${sectoresVisibles.map((sector) => `${sector.color || (sector.premiable ? '#d5ad36' : '#26231d')} ${sector.inicio}deg ${sector.fin}deg`).join(',')})`
    : 'conic-gradient(#d5ad36, #f2ead8, #d5ad36)';

  return (
    <div className="ruleta-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !girando) cerrar(); }}>
      <section className="ruleta-modal" role="dialog" aria-modal="true" aria-labelledby="ruleta-titulo">
        <button className="ruleta-cerrar" type="button" onClick={cerrar} aria-label="Cerrar ruleta" disabled={girando}><X size={20} /></button>
        <span className="ruleta-eyebrow"><Gift size={16} /> Un regalo para ti</span>
        <h2 id="ruleta-titulo">¡Gira y gana!</h2>
        <p className="ruleta-intro">Prueba suerte con refrescos y tragos de nuestra carta.</p>
        <div className="ruleta-rueda-wrap">
          <span className="ruleta-puntero" aria-hidden="true" />
          <div className="ruleta-rueda" style={{ background: colores, transform: `rotate(${rotacion}deg)` }}>
            {sectoresVisibles.map((sector, i) => (
              <span key={`${sector.id}-${i}`} className={`ruleta-sector-label${sector.premiable ? ' ruleta-sector-premio' : sector.sinPremio ? ' ruleta-sector-perdedor' : ''}`} style={{ transform: `rotate(${sector.centro}deg) translateY(-39cqw) rotate(90deg)` }}>
                {(sector.premiable || sector.sinPremio) && sector.name}
              </span>
            ))}
            <span className="ruleta-centro"><Gift size={24} /></span>
          </div>
        </div>
        {resultado === 'ganador' && premio ? (
          <div className="ruleta-ganador" role="status">🎉 ¡Has ganado {premio.name}! Ya está en tu carrito gratis.</div>
        ) : resultado === 'sin-premio' ? (
          <div className="ruleta-ganador" role="status">{mensajeResultado}</div>
        ) : (
          <>
            <button type="button" className="ruleta-boton" onClick={preparando ? undefined : error ? () => setReintentoPreparacion((n) => n + 1) : girar} disabled={girando || preparando || (!sessionId && !error)}>
              {girando || preparando ? <><LoaderCircle size={18} className="ruleta-cargando" /> {preparando ? 'Preparando la ruleta…' : 'Girando…'}</> : error ? 'Volver a intentar' : 'Girar la ruleta'}
            </button>
            {error && <p className="ruleta-error" role="alert">{error}</p>}
            {!girando && <button type="button" className="ruleta-despues" onClick={cerrar}>Ahora no</button>}
          </>
        )}
      </section>
    </div>
  );
}
