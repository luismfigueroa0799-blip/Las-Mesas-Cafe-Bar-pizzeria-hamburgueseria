import { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren, ReactNode } from 'react';
import { precioANumero } from '@/precio';

// Definir el tipo para un producto del carrito
export interface CartOpcion {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  extraPrice: number;
}

export interface CartProduct {
  /** Clave única de esta configuración (producto + opciones + nota). */
  key: string;
  id: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
  opciones: CartOpcion[];
  nota: string;
  isPrize?: boolean;
  prizeToken?: string;
}

// Clave de almacenamiento en el navegador (sobrevive a recargas).
const CLAVE_ALMACEN = 'lm_carrito_lasmesas';

// Contexto del carrito
const CartContext = createContext<{
  cart: CartProduct[];
  addToCart: (product: Omit<CartProduct, 'id' | 'quantity' | 'key' | 'opciones' | 'nota'> & {
    id?: string;
    opciones?: CartOpcion[];
    nota?: string;
    isPrize?: boolean;
    prizeToken?: string;
  }) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  total: number;
  clearCart: () => void;
}>({} as any);

/** Un id de producto debe existir (es el id de la tabla `productos`). */
function idValido(id: unknown): boolean {
  const texto = String(id ?? '').trim();
  return /^\d+$/.test(texto);
}

/**
 * Lee el carrito guardado en localStorage.
 * Se descartan los articulos cuyo id no es valido: si no, el navegador
 * arrastraria ids de una version antigua de la carta y el servidor los
 * rechazaria con "El carrito tiene articulos no validos".
 */
function leerAlmacen(): CartProduct[] {
  try {
    const bruto = window.localStorage.getItem(CLAVE_ALMACEN);
    if (!bruto) return [];
    const datos = JSON.parse(bruto);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter(
        (item: CartProduct) => item && item.name && idValido(item.id) && Number(item.quantity) > 0,
      )
      .map((item: CartProduct) => ({
        ...item,
        key: item.key || String(item.id) + '|' + JSON.stringify(item.opciones ?? []) + '|' + (item.nota ?? ''),
        opciones: Array.isArray(item.opciones) ? item.opciones : [],
        nota: String(item.nota ?? '').slice(0, 140),
      }));
  } catch {
    return [];
  }
}

// Componente proveedor del contexto
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartProduct[]>(() => leerAlmacen());

  // Guardar el carrito en localStorage para que no se pierda al recargar
  // la pagina ni al volver atras desde la pasarela de Stripe.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(cart));
    } catch {
      /* sin almacenamiento: se perdera al recargar */
    }
  }, [cart]);

  // Updater funcional: evita perder articulos si se anaden varios seguidos
  // (si se usara [...cart, ...] el closure estaria desactualizado).
  const addToCart = useCallback(
    (product: Omit<CartProduct, 'id' | 'quantity' | 'key' | 'opciones' | 'nota'> & {
      id?: string;
      opciones?: CartOpcion[];
      nota?: string;
      isPrize?: boolean;
      prizeToken?: string;
    }) => {
      const id = String(product.id || product.name);
      const opciones = product.opciones ?? [];
      const nota = String(product.nota ?? '').slice(0, 140);
      const key = id + '|' + JSON.stringify(opciones) + '|' + nota + (product.isPrize ? '|premio|' + String(product.prizeToken ?? '') : '');
      setCart((previo) => {
        const existente = previo.find((item) => item.key === key);
        if (existente) {
          return previo.map((item) =>
            item.key === key
              ? { ...item, quantity: product.isPrize ? 1 : item.quantity + 1, ...(product.isPrize ? { prizeToken: product.prizeToken } : {}) }
              : item,
          );
        }
        return [
          ...previo,
          {
            ...product,
            id,
            key,
            opciones,
            nota,
            quantity: 1,
          } as CartProduct,
        ];
      });
    },
    [],
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((previo) => previo.filter((item) => item.key !== key));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setCart((previo) =>
      quantity <= 0
        ? previo.filter((item) => item.key !== key)
        : previo.map((item) => (item.key === key ? { ...item, quantity } : item)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      window.localStorage.removeItem(CLAVE_ALMACEN);
    } catch { /* nada que borrar */ }
  }, []);

  // OJO: se usa precioANumero (no parseFloat) porque los precios estan en
  // formato espanol ('9,50 EUR') y parseFloat descartaria los centimos.
  const total = cart.reduce(
    (sum, item) =>
      sum +
      (item.isPrize ? 0 : precioANumero(item.price) + (item.opciones ?? []).reduce((s, o) => s + o.extraPrice, 0)) *
        item.quantity,
    0,
  );

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, total, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useCart = () => useContext(CartContext);
