import { useState } from 'react';

// Tipo para un producto
interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  image: string; // Ruta relativa al asset
  allergens?: string;
  categories?: string[];
}

// Componente de tarjeta de producto
const ProductCard: React.FC<{
  product: Product;
  onAddToCart: (product: Omit<Product, 'id'>) => void;
  selectedSize?: 'mini' | 'normal';
  showSizeSelector?: boolean;
}> = ({
  product,
  onAddToCart,
  selectedSize = 'normal',
  showSizeSelector = false,
}) => {
  const [size, setSize] = useState(selectedSize);

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSize(e.target.value as 'mini' | 'normal');
  };

  return (
    <article className="product-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-medium transition-shadow duration-200 cursor-pointer">
      {/* Imagen del producto - Usamos img en lugar de next/image para compatibilidad */}
      <div className="relative aspect-w-1 aspect-h-1 w-full">
        <img
          src={`/assets/${product.image}`}
          alt={product.name}
          width={400}
          height={300}
          className="object-cover w-full h-full transition-opacity duration-300"
          loading="lazy"
        />
        {/* Badge de alérgenos si existen */}
        {product.allergens && (
          <div className="absolute top-2 left-2 bg-red-100 text-red-800 text-xs font-semibold rounded px-2 py-1">
            {product.allergens}
          </div>
        )}
      </div>

      {/* Información del producto */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif text-lg font-medium text-gray-900 line-clamp-2 mb-2">
          {product.name}
        </h3>

        {product.description && (
          <p className="font-serif text-sm text-gray-600 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        {/* Selector de tamaño (si está habilitado) */}
        {showSizeSelector && (
          <div className="mt-2 flex items-center space-x-2">
            <label className="font-serif text-xs text-gray-500">Tamaño:</label>
            <div className="flex space-x-1">
              <label
                key="mini"
                className="relative flex-1 py-2 px-1 rounded border border-gray-300 bg-white text-center text-xs font-medium hover:border-dorado transition-colors"
                >
                <input
                  type="radio"
                  name="size"
                  value="mini"
                  checked={size === 'mini'}
                  onChange={handleSizeChange}
                  className="opacity-0 pointer-events-none"
                />
                <span className="text-[9px]">Mini</span>
                </label>
              <label
                key="normal"
                className="relative flex-1 py-2 px-1 rounded border border-gray-300 bg-white text-center text-xs font-medium hover:border-dorado transition-colors"
                >
                <input
                  type="radio"
                  name="size"
                  value="normal"
                  checked={size === 'normal'}
                  onChange={handleSizeChange}
                  className="opacity-0 pointer-events-none"
                />
                <span className="text-[9px]">Normal</span>
                </label>
            </div>
          </div>
        )}

        {/* Precio */}
        <p className="mt-2 font-serif font-bold text-xl text-dorado text-center">
          {product.price}
        </p>
      </div>

      {/* Botón de agregar al carrito */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => onAddToCart({
            ...product,
            price: product.price,
            image: product.image,
          })}
          className="w-full bg-dorado text-negro font-semibold py-2 rounded text-transform-uppercase hover:bg-dorado-claro transition-colors"
        >
          Añadir al carrito
        </button>
      </div>
    </article>
  );
};

export default ProductCard;