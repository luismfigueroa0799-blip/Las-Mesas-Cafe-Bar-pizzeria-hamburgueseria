import { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren, ReactNode } from 'react';
import { precioANumero } from '@/precio';

// Definir el tipo para un producto del carrito
interface CartProduct {
  id: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
}

// Clave de almacenamiento en el navegador (sobrevive a recargas).
const CLAVE_ALMACEN = 'lm_carrito_lasmesas';

// Contexto del carrito
const CartContext = createContext<{
  cart: CartProduct[];
  addToCart: (product: Omit<CartProduct, 'id' | 'quantity'>) => void;
  removeFromCart: (productId: string) => void;
  total: number;
  clearCart: () => void;
}>({} as any);

/** Lee el carrito guardado en sessionStorage. */
function leerAlmacen(): CartProduct[] {
  try {
    const bruto = window.sessionStorage.getItem(CLAVE_ALMACEN);
    if (!bruto) return [];
    const datos = JSON.parse(bruto);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

// Componente proveedor del contexto
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartProduct[]>(() => leerAlmacen());

  // Guardar el carrito en sessionStorage para que no se pierda al recargar
  // la pagina ni al volver atras desde la pasarela de Stripe.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(cart));
    } catch {
      /* sin almacenamiento: se perdera al recargar */
    }
  }, [cart]);

  // Updater funcional: evita perder articulos si se anaden varios seguidos
  // (si se usara [...cart, ...] el closure estaria desactualizado).
  const addToCart = useCallback(
    (product: Omit<CartProduct, 'id' | 'quantity'>) => {
      setCart((previo) => {
        const existente = previo.find(
          (item) => item.name === product.name && item.image === product.image,
        );
        if (existente) {
          return previo.map((item) =>
            item.name === product.name && item.image === product.image
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        const id = `${product.name.replace(/\s+/g, '-')}-${Date.now()}-${previo.length}`;
        return [...previo, { ...product, id, quantity: 1 }];
      });
    },
    [],
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((previo) => previo.filter((item) => item.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      window.sessionStorage.removeItem(CLAVE_ALMACEN);
    } catch {
      /* nada que borrar */
    }
  }, []);

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
