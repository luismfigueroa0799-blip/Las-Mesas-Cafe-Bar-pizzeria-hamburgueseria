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
  addToCart: (product: Omit<CartProduct, 'id' | 'quantity'> & { id?: string }) => void;
  removeFromCart: (productId: string) => void;
  total: number;
  clearCart: () => void;
}>({} as any);

/** Un id de producto debe existir (es el id de la tabla `productos`). */
function idValido(id: unknown): boolean {
  const texto = String(id ?? '').trim();
  return /^d+$/.test(texto);
}

/**
 * Lee el carrito guardado en sessionStorage.
 * Se descartan los articulos cuyo id no es valido: si no, el navegador
 * arrastraria ids de una version antigua de la carta y el servidor los
 * rechazaria con "El carrito tiene articulos no validos".
 */
function leerAlmacen(): CartProduct[] {
  try {
    const bruto = window.sessionStorage.getItem(CLAVE_ALMACEN);
    if (!bruto) return [];
    const datos = JSON.parse(bruto);
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (item: CartProduct) => item && item.name && idValido(item.id) && Number(item.quantity) > 0,
    );
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
    (product: Omit<CartProduct, 'id' | 'quantity'> & { id?: string }) => {
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
        if (!idValido(product.id)) {
          // El id del producto es el de la tabla `productos` de Supabase.
          console.warn('[carrito] producto sin id de base de datos:', product.name);
        }
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
