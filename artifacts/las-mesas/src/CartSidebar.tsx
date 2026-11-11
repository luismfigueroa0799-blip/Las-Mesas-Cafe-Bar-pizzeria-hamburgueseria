import { useMemo, useState } from 'react';
import { useCart } from '@/CartContext';
import { X } from 'lucide-react';
import { formatearPrecio } from '@/precio';

type TipoEntrega = 'recogida' | 'domicilio';

interface DatosCliente {
  nombre: string;
  telefono: string;
  email: string;
  tipoEntrega: TipoEntrega;
  calle: string;
  numero: string;
  piso: string;
  codigoPostal: string;
  ciudad: string;
}

// Expresión simple para teléfono español (+34, 6xx, 9xx, espacios y guiones).
const TELEFONO_VALIDO = /^[+]?[\d\s.-]{9,20}$/;

const vacio: DatosCliente = {
  nombre: '',
  telefono: '',
  email: '',
  tipoEntrega: 'recogida',
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

  // ?mesa=N indica que el pedido es para esa mesa del local.
  const mesa = useMemo(
    () => new URLSearchParams(window.location.search).get('mesa') ?? '',
    [],
  );

  const errores = useMemo(() => {
    const lista: string[] = [];
    if (!datos.nombre.trim()) lista.push('El nombre es obligatorio.');
    if (!datos.telefono.trim()) lista.push('El teléfono es obligatorio.');
    else if (!TELEFONO_VALIDO.test(datos.telefono.trim())) lista.push('Revisa el teléfono.');
    if (!datos.email.trim() || !datos.email.includes('@')) lista.push('El correo no es válido.');
    if (datos.tipoEntrega === 'domicilio') {
      if (!datos.calle.trim()) lista.push('La calle es obligatoria.');
      if (!datos.numero.trim()) lista.push('El número es obligatorio.');
      if (!datos.codigoPostal.trim()) lista.push('El código postal es obligatorio.');
    }
    return lista;
  }, [datos]);

  const listo = cart.length > 0 && errores.length === 0;

  if (!open) return null;

  function actualizar(campo: keyof DatosCliente, valor: string) {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    setEstado('');
  }

  // Ir a la pasarela de pago de Stripe
  async function irAlPago() {
    if (!cart.length) return;
    if (!listo) {
      setEstado('Revisa los campos marcados antes de pagar.');
      return;
    }
    setCargando(true);
    setEstado('Redirigiendo al pago seguro…');

    // Control de tiempo: si el servidor no responde en 20 s no dejamos el
    // boton bloqueado para siempre.
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), 20000);

    try {
      const respuesta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controlador.signal,
        body: JSON.stringify({
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          customerEmail: datos.email.trim(),
          customerName: datos.nombre.trim(),
          telefono: datos.telefono.trim(),
          tipoEntrega: datos.tipoEntrega,
          direccion: {
            calle: datos.calle.trim(),
            numero: datos.numero.trim(),
            piso: datos.piso.trim(),
            codigoPostal: datos.codigoPostal.trim(),
            ciudad: datos.ciudad.trim(),
          },
          mesa,
          urlOrigen: window.location.href,
        }),
      });

      // Leemos el cuerpo como texto: si el servidor devuelve HTML (por ejemplo
      // la pantalla de login de Vercel) el .json() lanzaria una excepcion poco
      // descriptiva.
      const cuerpo = await respuesta.text();

      let respuestaJson: any = null;
      try {
        respuestaJson = JSON.parse(cuerpo);
      } catch {
        respuestaJson = null;
      }

      if (!respuesta.ok) {
        const mensaje =
          respuestaJson?.error?.message ||
          respuestaJson?.error ||
          respuestaJson?.message ||
          `El servidor respondio con el codigo ${respuesta.status}.`;
        throw new Error(mensaje);
      }

      if (!respuestaJson) {
        throw new Error('El servidor no devolvio una respuesta valida.');
      }

      // Stripe devuelve la url de la pasarela de pago. Se usa location.assign
      // (no stripe.redirectToCheckout, que esta obsoleto).
      const urlSesion: string = respuestaJson.url ?? '';
      if (!urlSesion) {
        throw new Error(
          respuestaJson.error || 'No se pudo iniciar el pago, revisa tus datos.',
        );
      }

      window.location.assign(urlSesion);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setEstado('El servidor no ha respondido. Revisa tu conexion e intentalo de nuevo.');
      } else {
        setEstado(
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar el pago, revisa tus datos.',
        );
      }
      setCargando(false);
    } finally {
      window.clearTimeout(temporizador);
    }
  }
  return (
    <>
      <div className="cart-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="cart-drawer" aria-label="Carrito de compra">
        <header className="cart-drawer-head">
          <h2 className="cart-drawer-title">Mi pedido</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar carrito" className="cart-close">
            <X size={20} />
          </button>
        </header>

        {cart.length === 0 ? (
          <p className="cart-empty">Tu carrito está vacío. Añade algo rico desde la carta.</p>
        ) : (
          <>
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

            <div className="cart-total">
              <span>Total</span>
              <strong>{formatearPrecio(total)}</strong>
            </div>

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
                />
              </label>

              <label className="cart-field">
                <span>Teléfono *</span>
                <input
                  type="tel"
                  value={datos.telefono}
                  onChange={(e) => actualizar('telefono', e.target.value)}
                  placeholder="600 00 00 00"
                  autoComplete="tel"
                  required
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
                />
              </label>

              <fieldset className="cart-field cart-radio">
                <legend>Tipo de entrega *</legend>
                <label className={datos.tipoEntrega === 'recogida' ? 'is-active' : ''}>
                  <input
                    type="radio"
                    name="tipoEntrega"
                    value="recogida"
                    checked={datos.tipoEntrega === 'recogida'}
                    onChange={() => actualizar('tipoEntrega', 'recogida')}
                  />
                  <span>Recogida en local</span>
                </label>
                <label className={datos.tipoEntrega === 'domicilio' ? 'is-active' : ''}>
                  <input
                    type="radio"
                    name="tipoEntrega"
                    value="domicilio"
                    checked={datos.tipoEntrega === 'domicilio'}
                    onChange={() => actualizar('tipoEntrega', 'domicilio')}
                  />
                  <span>Envío a domicilio</span>
                </label>
              </fieldset>

              {datos.tipoEntrega === 'domicilio' && (
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

              {mesa && (
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

            {estado && <p className="cart-status" role="status">{estado}</p>}

            <button type="button" className="cart-checkout" onClick={irAlPago} disabled={cargando || !listo}>
              {cargando ? 'Procesando…' : 'Pagar con Stripe'}
            </button>
            <button type="button" className="cart-clear" onClick={clearCart}>Vaciar carrito</button>
          </>
        )}
      </aside>
    </>
  );
};

export default CartSidebar;
