import { useState } from 'react';
import { useCart } from '@/CartContext';
import { X } from 'lucide-react';

// Cajón lateral del carrito
const CartSidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { cart, removeFromCart, clearCart, total } = useCart();
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(false);

  if (!open) return null;

  // Ir a la pasarela de pago de Stripe
  async function irAlPago() {
    if (!cart.length) return;
    if (!email || !email.includes('@')) {
      setEstado('Introduce un correo electrónico para recibir la confirmación.');
      return;
    }
    setCargando(true);
    setEstado('Redirigiendo al pago seguro…');
    // ?mesa=N indica que el pedido es para esa mesa del local.
    const mesa = new URLSearchParams(window.location.search).get('mesa') ?? '';
    try {
      const respuesta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          customerEmail: email,
          customerName: email,
          mesa,
          urlOrigen: window.location.href,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo iniciar el pago');
      if (datos.url) {
        window.location.href = datos.url;
        return;
      }
      if (!datos.sessionId) throw new Error('Respuesta de Stripe no válida');
      window.location.href = `https://checkout.stripe.com/c/pay/${datos.sessionId}#session_id=${datos.sessionId}`;
    } catch (error) {
      setEstado(error instanceof Error ? error.message : 'No se pudo iniciar el pago.');
      setCargando(false);
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
              <strong>{total.toFixed(2)} €</strong>
            </div>

            <label className="cart-email">
              <span>Correo para la confirmación</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required />
            </label>

            {estado && <p className="cart-status" role="status">{estado}</p>}

            <button type="button" className="cart-checkout" onClick={irAlPago} disabled={cargando}>
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
