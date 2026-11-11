"use client";

import { useContext } from 'react';
import { useCart } from '@/CartContext';

interface CartItem {
  id: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
}

export const useCartItems = () => {
  const { cart, removeFromCart, clearCart, total } = useCart();
  const cartItems = cart.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    image: item.image,
    quantity: item.quantity,
  })) as CartItem[];

  return {
    cartItems,
    addToCart: () => {}, // Se usará desde el producto
    removeFromCart,
    clearCart,
    total,
  };
};

export const CartSidebar: React.FC = () => {
  const { cartItems, removeFromCart, clearCart, total } = useCartItems();

  return (
    <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 r-0 md:r-0 z-50 flex flex-col overflow-y-auto">
      {/* Header del carrito */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-serif text-xl font-medium text-gray-900">Mi Carrito</h2>
        <button
          onClick={clearCart}
          className="text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Vaciar carrito"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M6 4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6zM6 4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6z" />
          </svg>
        </button>
      </div>

      {/* Lista de items */}
      {cartItems.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p className="text-lg">Tu carrito está vacío</p>
        </div>
      ) : (
        <div className="p-4 flex-1 space-y-3">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start space-x-3"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-10 h-10 object-rounded flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.quantity} x {item.price}</p>
              </div>
              <button
                onClick={() => removeFromCart(item.id)}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
                aria-label="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="pt-3 border-t border-gray-100 flex justify-between">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="font-serif font-bold text-dorado">€{total.toFixed(2)}</span>
          </div>
          <button
            onClick={() => window.alert('Proceder al pago')
            }
            className="w-full bg-dorado text-negro font-semibold py-2 rounded text-transform-uppercase hover:bg-dorado-claro transition-colors mt-3"
          >
            Pagar
          </button>
        </div>
      )}
    </div>
  );
};