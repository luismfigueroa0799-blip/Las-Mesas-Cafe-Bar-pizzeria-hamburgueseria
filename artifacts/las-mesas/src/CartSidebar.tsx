import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/CartContext';
import { X } from 'lucide-react';
import { formatearPrecio, precioANumero } from '@/precio';
import { normalizarTelefono, telefonoValido } from '@/telefono';
import { extraerUrlStripe } from '@/stripe-url';

type TipoEntrega = 'recogida' | 'domicilio' | 'mesa';

// Local: C. Pintor Antonio Padrón, 59, 35018 Las Palmas de Gran Canaria
const LOCAL_LAT = 28.0991469;
const LOCAL_LON = -15.4976894;
const RADIO_MAX_KM = 8;
const PRECIO_POR_KM = 0.5;

// Distancia en km entre dos puntos (fórmula de Haversine)
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const cAng = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * cAng;
}

interface SugerenciaDireccion {
  calle: string;
  poblacion: string;
  codigoPostal: string;
  etiqueta: string;
}

interface DatosCliente {
  nombre: string;
  telefono: string;
  email: string;
  tipoEntrega: TipoEntrega;
  mesa: string;
  calle: string;
  numero: string;
  piso: string;
  codigoPostal: string;
  ciudad: string;
}

// Correo: obligatorio y con dominio real (algo@dominio.tld).
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const vacio: DatosCliente = {
  nombre: '',
  telefono: '',
  email: '',
  tipoEntrega: 'recogida',
  mesa: '',
  calle: '',
  numero: '',
  piso: '',
  codigoPostal: '',
  ciudad: '',
};

const CartSidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { cart, removeFromCart, clearCart, total } = useCart();
  const [datos, setDatos] = useState<DatosCliente>(vacio);
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [buscandoDir, setBuscandoDir] = useState(false);
  const ultimaCalleElegida = useRef('');
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  const [ubicacionError, setUbicacionError] = useState('');

  // ?mesa=N indica que el pedido es para esa mesa del local (QR de mesa).
  // Solo se admite entre 1 y 8 (las 8 mesas del local).
  const mesaUrl = useMemo(() => {
    const valor = new URLSearchParams(window.location.search).get('mesa');
    const numero = Number(valor ?? '');
    if (valor !== null && Number.isInteger(numero) && numero >= 1 && numero <= 8) {
      return String(numero);
    }
    return '';
  }, []);
  const mesa = mesaUrl || datos.mesa || '';
  const tipoEntregaActiva: TipoEntrega = mesaUrl ? 'mesa' : datos.tipoEntrega;

  const errores = useMemo(() => {
    const lista: string[] = [];
    if (!datos.nombre.trim() && tipoEntregaActiva !== 'mesa') lista.push('El nombre es obligatorio.');
    // El telefono es opcional, salvo para entrega a domicilio, donde el
    // servidor de pedidos lo necesita para preparar el reparto.
    if (datos.telefono.trim() && !telefonoValido(datos.telefono.trim())) {
      lista.push('Revisa el teléfono: debe tener entre 9 y 20 dígitos.');
    } else if (!datos.telefono.trim() && tipoEntregaActiva === 'domicilio') {
      lista.push('Para entrega a domicilio hace falta el teléfono.');
    }
    // El correo es obligatorio y tiene que incluir el dominio.
    if (!datos.email.trim() && tipoEntregaActiva !== 'mesa') {
      lista.push('El correo electrónico es obligatorio.');
    } else if (!EMAIL_VALIDO.test(datos.email.trim()) && tipoEntregaActiva !== 'mesa') {
      lista.push('El correo no es válido: usa el formato nombre@dominio.com.');
    }
    if (tipoEntregaActiva === 'domicilio') {
      if (!datos.calle.trim()) lista.push('La calle es obligatoria.');
      if (!datos.numero.trim()) lista.push('El número es obligatorio.');
      if (!datos.codigoPostal.trim()) lista.push('El código postal es obligatorio.');
    }
    return lista;
  }, [datos]);

  // Autocompletado de calles: buscar en Nominatim al escribir en el campo Calle.
  useEffect(() => {
    if (tipoEntregaActiva !== 'domicilio' || datos.calle.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    if (datos.calle.trim() === ultimaCalleElegida.current) {
      setSugerencias([]);
      return;
    }
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setBuscandoDir(true);
      try {
        const partes = [datos.calle.trim()];
        if (/^\d{5}$/.test(datos.codigoPostal.trim())) partes.push(datos.codigoPostal.trim());
        if (datos.ciudad.trim()) partes.push(datos.ciudad.trim());
        partes.push('Spain');
        const url = 'https://nominatim.openstreetmap.org/search?q=' +
          encodeURIComponent(partes.join(', ')) +
          '&format=jsonv2&addressdetails=1&limit=8' +
          '&viewbox=-15.52,28.18,-15.38,28.05&bounded=1';
        const respuesta = await fetch(url, { signal: controlador.signal });
        const crudo = await respuesta.json();
        const vistos = new Set<string>();
        const sugerido: SugerenciaDireccion[] = [];
        if (Array.isArray(crudo)) {
          for (const item of crudo) {
            const addr = item.address || {};
            const calle = String(addr.road || addr.pedestrian || addr.footway || '').trim();
            if (!calle) continue;
            const poblacion = String(addr.city || addr.town || addr.village || addr.municipality || addr.county || '').trim();
            const cpItem = String(addr.postcode || '').trim();
            const etiqueta = [calle, cpItem, poblacion].filter(Boolean).join(', ');
            const clave = calle.toLowerCase();
            if (vistos.has(clave)) continue;
            vistos.add(clave);
            sugerido.push({ calle, poblacion, codigoPostal: cpItem, etiqueta });
          }
        }
        setSugerencias(sugerido);
      } catch {
        setSugerencias([]);
      } finally {
        setBuscandoDir(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [datos.calle, datos.codigoPostal, datos.ciudad, tipoEntregaActiva]);

  // Pedir la ubicación automáticamente al abrir el carrito si es a domicilio.
  useEffect(() => {
    if (!open || tipoEntregaActiva !== 'domicilio' || distanciaKm !== null) return;
    if (!navigator.geolocation) {
      setUbicacionError('Tu navegador no permite obtener la ubicación.');
      return;
    }
    setPidiendoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = calcularDistanciaKm(LOCAL_LAT, LOCAL_LON, pos.coords.latitude, pos.coords.longitude);
        setDistanciaKm(Math.round(d * 10) / 10);
        setUbicacionError('');
        setPidiendoUbicacion(false);
      },
      () => {
        setUbicacionError('No se pudo obtener tu ubicación. Activa el permiso o escribe la dirección.');
        setPidiendoUbicacion(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [open, tipoEntregaActiva, distanciaKm]);

  const alElegirDireccion = (s: SugerenciaDireccion) => {
    ultimaCalleElegida.current = s.calle;
    setDatos((previo) => ({
      ...previo,
      calle: s.calle || previo.calle,
      ciudad: s.poblacion || previo.ciudad,
      codigoPostal: s.codigoPostal || previo.codigoPostal,
    }));
    setSugerencias([]);
    setEstado('');
  };

  const fueraDeRadio = tipoEntregaActiva === 'domicilio' && distanciaKm !== null && distanciaKm > RADIO_MAX_KM;
  const costoEnvio =
    tipoEntregaActiva === 'domicilio' && distanciaKm !== null && !fueraDeRadio
      ? Math.round(distanciaKm * PRECIO_POR_KM * 100) / 100
      : 0;

  const listo = cart.length > 0 && errores.length === 0 && !fueraDeRadio && !pidiendoUbicacion;

  if (!open) return null;

  function actualizar(campo: keyof DatosCliente, valor: string) {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    setEstado('');
  }

  // Ir a la pasarela de pago de Stripe.
  //
  // Patron (igual que el sitio estatico que ya funciona): se pide la sesion
    // a nuestra API, que tiene la STRIPE_SECRET_KEY y devuelve la url
    // de la sesion de pago de Stripe.
    // Esta web es autonoma: no comparte backend con la app de hamburgueseria.
  async function irAlPago() {
    if (!cart.length) return;
    if (!listo) {
      // Se listan los campos concretos que faltan para que se sepa qué corregir.
      setEstado(
        errores.length
          ? `Falta completar: ${errores.join(' ')}`
          : 'Revisa los campos marcados antes de pagar.',
      );
      return;
    }
    setCargando(true);
    setEstado('Redirigiendo al pago seguro…');

    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), 20000);

    // Los productos y el total se calculan ANTES de llamar a la API y se
    // mandan ya calculados en el cuerpo de la peticion.
    //
    // IMPORTANTE: el carrito NO se vacia aqui. Se vacia en la pagina de
    // confirmacion, cuando Stripe ya ha confirmado el pago. Si se vaciara
    // antes, el pedido se enviaria sin productos y con total 0.
    const articulos = cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    const total = articulos.reduce(
      (suma, item) => suma + precioANumero(item.price) * item.quantity,
      0,
    );

    const direccionCompleta =
      datos.tipoEntrega === 'domicilio'
        ? [
            datos.calle.trim(),
            datos.numero.trim(),
            datos.piso.trim(),
            datos.codigoPostal.trim(),
            datos.ciudad.trim(),
          ]
            .filter(Boolean)
            .join(', ')
        : '';

    // Esta web es autonoma: la sesion de pago la crea nuestra propia API.
    // (La app de hamburgueseria/pizzeria usa su propio webhook de n8n,
    //  que es un proyecto aparte y no se comparte.)
    const esMesaPorQR = !!mesaUrl;
    const rutas: Array<{ etiqueta: string; url: string; body: unknown }> = [];
    rutas.push({
      etiqueta: esMesaPorQR ? '/api/checkout-mesa' : '/api/checkout',
      url: esMesaPorQR ? '/api/checkout-mesa' : '/api/checkout',
      body: {
        items: articulos,
        customerEmail: datos.email.trim(),
        customerName: datos.nombre.trim(),
        telefono: normalizarTelefono(datos.telefono.trim()),
        tipoEntrega: esMesaPorQR ? 'mesa' : tipoEntregaActiva,
        total: (total + costoEnvio).toFixed(2),
        costoEnvio: costoEnvio.toFixed(2),
        distanciaKm: distanciaKm === null ? null : distanciaKm,
        direccion: esMesaPorQR
          ? ''
          : {
              calle: datos.calle.trim(),
              numero: datos.numero.trim(),
              piso: datos.piso.trim(),
              codigoPostal: datos.codigoPostal.trim(),
              ciudad: datos.ciudad.trim(),
            },
        mesa: esMesaPorQR ? mesaUrl : mesa,
        urlOrigen: window.location.href,
      },
    });

    const fallos: string[] = [];

    try {
      for (const ruta of rutas) {
        try {
          const respuesta = await fetch(ruta.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controlador.signal,
            body: JSON.stringify(ruta.body),
          });

          const texto = await respuesta.text();
          let datosRespuesta: any = null;
          try {
            datosRespuesta = JSON.parse(texto);
          } catch {
            datosRespuesta = null;
          }

          if (!respuesta.ok) {
            const base =
              datosRespuesta?.error?.message ||
              datosRespuesta?.error ||
              datosRespuesta?.message ||
              `HTTP ${respuesta.status}`;
            // El detalle es el motivo real del fallo (lo devuelve la API).
            const detalle = datosRespuesta?.detalle || datosRespuesta?.stripe || '';
            fallos.push(detalle ? `${base}: ${detalle}` : base);
            continue;
          }

          const urlSesion = extraerUrlStripe(datosRespuesta);
          if (!urlSesion) {
            fallos.push(
              `${ruta.etiqueta}: la respuesta no trae la url de Stripe. ` +
                "Contenido recibido: " + texto.slice(0, 220),
            );
            continue;
          }

          window.location.assign(urlSesion);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          fallos.push(`${ruta.etiqueta}: ${(error as Error)?.message ?? 'error'}`);
        }
      }

      // Se muestra el error real que devuelve el servidor, no un mensaje
      // generico: asi se puede saber que ha fallado exactamente.
      setEstado(
        fallos.length
          ? fallos.join(' | ')
          : 'No se pudo iniciar el pago. Revisa tus datos e intentalo de nuevo.',
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setEstado('El servidor no ha respondido. Revisa tu conexion e intentalo de nuevo.');
      } else {
        setEstado(
          fallos.length
            ? fallos.join(' | ')
            : 'No se pudo iniciar el pago, revisa tus datos.',
        );
      }
    } finally {
      setCargando(false);
      window.clearTimeout(temporizador);
    }
  }
  return (
    <>
      <div className="cart-overlay" onClick={onClose} aria-hidden="true" />
      {/* El ancho lo lleva el CSS: 100% en movil y 410px a partir de 600px. */}
      <aside className="cart-drawer" aria-label="Carrito de compra">
        <header className="cart-drawer-head shrink-0">
          <h2 className="cart-drawer-title">Mi pedido</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar carrito" className="cart-close">
            <X size={20} />
          </button>
        </header>

        {cart.length === 0 ? (
          <div className="cart-drawer-body">
            <p className="cart-empty">Tu carrito está vacío. Añade algo rico desde la carta.</p>
          </div>
        ) : (
          <>
            {/* El contenido scrollea solo, para que el botón de pago y el
                total se vean siempre sin tener que bajar. */}
            <div className="cart-drawer-body flex-1 min-h-0 overflow-y-auto">
              <ul className="cart-items">
                {cart.map((item) => (
                  <li key={item.id} className="cart-item">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="cart-item-img" width="56" height="56" loading="lazy" />
                    ) : (
                      <span className="cart-item-img cart-item-mono" aria-hidden="true">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="cart-item-info">
                      <strong>{item.name}</strong>
                      <span>{item.quantity} × {item.price}</span>
                    </div>
                    <button type="button" className="cart-item-remove" onClick={() => removeFromCart(item.id)} aria-label={`Quitar ${item.name}`}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              {costoEnvio > 0 && (
                <div className="cart-total" style={{ fontWeight: 'normal', fontSize: '0.9em' }}>
                  <span>Envío a domicilio ({distanciaKm} km)</span>
                  <strong>{formatearPrecio(costoEnvio)}</strong>
                </div>
              )}
              {pidiendoUbicacion && tipoEntregaActiva === 'domicilio' && (
                <p className="cart-mesa" style={{ borderLeftColor: '#d4af37' }}>📍 Obteniendo tu ubicación…</p>
              )}
              {ubicacionError && tipoEntregaActiva === 'domicilio' && (
                <p className="cart-mesa" style={{ borderLeftColor: '#c0392b' }}>{ubicacionError}</p>
              )}
              {distanciaKm !== null && distanciaKm <= RADIO_MAX_KM && tipoEntregaActiva === 'domicilio' && (
                <p className="cart-mesa">📍 A {distanciaKm} km del local — envío disponible</p>
              )}
              {fueraDeRadio && (
                <p className="cart-mesa" style={{ borderLeftColor: '#c0392b' }}>
                  Lo sentimos, estás a {distanciaKm} km del local. Solo hacemos entregas hasta {RADIO_MAX_KM} km.
                </p>
              )}
              <div className="cart-total">
                <span>Total</span>
                <strong>{formatearPrecio(total + costoEnvio)}</strong>
              </div>

              {!mesaUrl && (
                <>
                  {/* ---- Datos de entrega ---- */}
                  <div className="cart-form">
                <span className="cart-form-title">Datos de entrega</span>

                <label className="cart-field">
                  <span>Nombre completo *</span>
                  <input
                    type="text"
                    value={datos.nombre}
                    onChange={(e) => actualizar('nombre', e.target.value)}
                    placeholder="Nombre y apellidos"
                    autoComplete="name"
                    required
                    aria-invalid={!datos.nombre.trim()}
                  />
                </label>

                <label className="cart-field">
                  <span>Teléfono <em>(opcional)</em></span>
                  <input
                    type="tel"
                    value={datos.telefono}
                    onChange={(e) => actualizar('telefono', e.target.value)}
                    placeholder="600 00 00 00"
                    autoComplete="tel"
                    aria-invalid={Boolean(datos.telefono.trim()) && !telefonoValido(datos.telefono.trim())}
                  />
                </label>

                <label className="cart-field">
                  <span>Correo electrónico *</span>
                  <input
                    type="email"
                    value={datos.email}
                    onChange={(e) => actualizar('email', e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(datos.email.trim()) && !EMAIL_VALIDO.test(datos.email.trim())}
                  />
                </label>

                {mesaUrl ? (
                  <p className="cart-mesa">Pedido para la mesa {mesa}. Te lo llevamos a esa mesa.</p>
                ) : (
                  <label className="cart-field">
                    <span>Tipo de entrega *</span>
                    <select
                      value={datos.tipoEntrega === 'mesa' && datos.mesa ? 'mesa:' + datos.mesa : datos.tipoEntrega}
                      onChange={(e) => {
                        const valor = e.target.value;
                        if (valor.startsWith('mesa:')) {
                          const numero = valor.slice(4);
                          setDatos((previo) => ({ ...previo, tipoEntrega: 'mesa', mesa: numero }));
                        } else {
                          setDatos((previo) => ({ ...previo, tipoEntrega: valor as TipoEntrega, mesa: '' }));
                        }
                        setEstado('');
                      }}
                      data-testid="select-tipo-entrega"
                    >
                      {Array.from({ length: 8 }, (_, indice) => indice + 1).map((numero) => (
                        <option key={numero} value={'mesa:' + numero}>Mesa {numero}</option>
                      ))}
                      <option value="domicilio">Envío a domicilio</option>
                      <option value="recogida">Recogida en local</option>
                    </select>
                  </label>
                )}

                {tipoEntregaActiva === 'domicilio' && (
                  <div className="cart-address">
                    <label className="cart-field cart-field-wide">
                      <span>Calle *</span>
                      <input
                        type="text"
                        value={datos.calle}
                        onChange={(e) => actualizar('calle', e.target.value)}
                        placeholder="Nombre de la calle"
                        autoComplete="address-line1"
                        required
                      />
                    </label>
                    {(sugerencias.length > 0 || buscandoDir) && (
                      <div style={{ marginTop: '-6px', marginBottom: '10px' }}>
                        {buscandoDir && (
                          <div style={{ fontSize: '12px', opacity: 0.7, padding: '4px 0' }}>Buscando calles…</div>
                        )}
                        {!buscandoDir && sugerencias.map((s, idx) => (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => alElegirDireccion(s)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              marginBottom: '4px',
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '6px',
                              color: 'inherit',
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            {s.etiqueta}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="cart-field">
                      <span>Número *</span>
                      <input
                        type="text"
                        value={datos.numero}
                        onChange={(e) => actualizar('numero', e.target.value)}
                        placeholder="24"
                        autoComplete="address-line2"
                        required
                      />
                    </label>
                    <label className="cart-field">
                      <span>Piso / puerta</span>
                      <input
                        type="text"
                        value={datos.piso}
                        onChange={(e) => actualizar('piso', e.target.value)}
                        placeholder="3º B"
                      />
                    </label>
                    <label className="cart-field">
                      <span>Código postal *</span>
                      <input
                        type="text"
                        value={datos.codigoPostal}
                        onChange={(e) => actualizar('codigoPostal', e.target.value)}
                        placeholder="35018"
                        autoComplete="postal-code"
                        required
                      />
                    </label>
                    <label className="cart-field">
                      <span>Población</span>
                      <input
                        type="text"
                        value={datos.ciudad}
                        onChange={(e) => actualizar('ciudad', e.target.value)}
                        placeholder="Las Palmas de Gran Canaria"
                        autoComplete="address-level2"
                      />
                    </label>
                  </div>
                )}

                {mesa && !mesaUrl && (
                  <p className="cart-mesa">Pedido para la mesa {mesa}.</p>
                )}

                {errores.length > 0 && (
                  <ul className="cart-errors" role="alert">
                    {errores.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
                </>
              )}
              {estado && <p className="cart-status" role="status">{estado}</p>}
            </div>

            {/* ---- Pie fijo: el total y el pago siempre a mano ---- */}
            <div className="cart-drawer-foot">
              <button type="button" className="cart-checkout w-full" onClick={irAlPago} disabled={cargando || !listo}>
                {cargando ? 'Procesando…' : 'Pagar con Stripe'}
              </button>
              <button type="button" className="cart-clear w-full" onClick={clearCart}>Vaciar carrito</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

export default CartSidebar;
