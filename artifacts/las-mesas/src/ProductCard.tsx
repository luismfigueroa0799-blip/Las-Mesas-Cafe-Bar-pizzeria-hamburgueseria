import { useState } from 'react';
import { iniciales } from '@/products';

// Tipo de producto (compatible con la tabla de Neon).
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  allergens?: string;
  /** Ruta de la foto (columna image_url). null = sin fotografía propia. */
  image_url?: string | null;
  category?: string;
  category_slug?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: { name: string; price: string; image: string }) => void;
  selectedSize?: 'mini' | 'normal';
  showSizeSelector?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  selectedSize = 'normal',
  showSizeSelector = false,
}) => {
  const [size, setSize] = useState(selectedSize);
  const foto = product.image_url ?? null;

  return (
    <article className="product-card">
      {/* Foto del producto. Si no hay image_url se muestra un monograma elegante
          en lugar de una imagen que no corresponde al plato. */}
      <div className="product-card-media w-full">
        {foto ? (
          <img
            src={foto}
            alt={product.name}
            className="h-full w-full object-cover"
            width="400"
            height="300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="product-card-placeholder" aria-hidden="true">
            <span className="product-card-mono">{iniciales(product.name)}</span>
            <span className="product-card-cat">{product.category ?? 'Las Mesas'}</span>
          </div>
        )}
        {product.allergens && (
          <span className="product-card-allergens" title="Alérgenos">
            {product.allergens}
          </span>
        )}
      </div>

      <div className="product-card-body min-w-0">
        <h3 className="product-card-name break-words">{product.name}</h3>

        {product.description && <p className="product-card-desc">{product.description}</p>}

        {showSizeSelector && (
          <div className="product-card-sizes">
            <span className="product-card-sizes-label">Tamaño</span>
            <div className="product-card-sizes-options">
              {(['mini', 'normal'] as const).map((valor) => (
                <label key={valor} className={size === valor ? 'is-active' : ''}>
                  <input
                    type="radio"
                    name="size"
                    value={valor}
                    checked={size === valor}
                    onChange={(e) => setSize(e.target.value as 'mini' | 'normal')}
                  />
                  <span>{valor === 'mini' ? 'Mini' : 'Normal'}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <p className="product-card-price">{product.price}</p>
      </div>

      <div className="product-card-foot">
        <button
          type="button"
          className="w-full"
          onClick={() =>
            onAddToCart({
              name: product.name,
              price: product.price,
              image: foto ?? '',
            })
          }
          data-testid={`button-add-${product.id}`}
        >
          Añadir al carrito
        </button>
      </div>
    </article>
  );
};

export default ProductCard;
