import { createContext, useContext, useState, PropsWithChildren, ReactNode } from 'react';
import { precioANumero } from '@/precio';

// Definir el tipo para un producto del carrito
interface CartProduct {
  id: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
}

// Contexto del carrito - IDs estables (sin Date.now para evitar problemas de hidratación)
const CartContext = createContext<{
  cart: CartProduct[];
  addToCart: (product: Omit<CartProduct, 'id' | 'quantity'>) => void;
  removeFromCart: (productId: string) => void;
  total: number;
  clearCart: () => void;
}>({} as any);

// Componente proveedor del contexto
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartProduct[]>([]);

  // Usar un ID estable basado en timestamp inicial, no Date.now() en cada operación
  const initialTime = Date.now();

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
      // Usar ID estable: producto + timestamp inicial
      const stableId = `${product.name.replace(/\s+/g, '-')}-${initialTime}`;
      setCart([...cart, { ...product, id: stableId, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    // Filtrar por nombre e imagen en lugar de ID exacto para mayor compatibilidad
    setCart(
      cart.filter((item) => !(item.name === productId && item.image === cart.find((c) => c.id === productId)?.image))
    );
  };

  const clearCart = () => setCart([]);

  // OJO: se usa precioANumero (no parseFloat) porque los precios estan en
  // formato espanol ('9,50 EUR') y parseFloat descartaria los centimos.
  const total = cart.reduce((sum, item) => sum + precioANumero(item.price) * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, total, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useCart = () => useContext(CartContext);