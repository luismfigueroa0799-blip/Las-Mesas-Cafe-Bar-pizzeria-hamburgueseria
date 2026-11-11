import { createContext, useContext, useState, PropsWithChildren, ReactNode } from 'react';

// Definir el tipo para un producto del carrito
interface CartProduct {
  id: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
  selectedSize?: 'mini' | 'normal';
}

// Contexto del carrito
const CartContext = createContext<{
  cart: CartProduct[];
  addToCart: (product: Omit<CartProduct, 'id' | 'quantity'>) => void;
  removeFromCart: (productId: string) => void;
  total: number;
  clearCart: () => void;
}>({} as any);

export const CartContextProvider = CartContext.Provider;

// Hook personalizado para usar el contexto
export const useCart = () => useContext(CartContext);

// Componente del proveedor
const CartProvider: React.FC<PropsWithChildren<ReactNode>> = ({ children }) => {
  const [cart, setCart] = useState<CartProduct[]>([]);

  const addToCart = (product: Omit<CartProduct, 'id' | 'quantity'>) => {
    const existing = cart.find((item) => item.name === product.name && item.image === product.image);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.name === product.name && item.image === product.image
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, id: `${product.name}-${Date.now()}`, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, total, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

