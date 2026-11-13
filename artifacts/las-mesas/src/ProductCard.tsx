import { useState } from 'react';
import { iniciales } from '@/products';
import { AvailabilityBadge } from '@/AvailabilityBadge';

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
  /** false = producto agotado (lo marca el panel /admin/inventario). */
  disponible?: boolean;
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
  // Agotado: el panel de inventario (/admin/inventario) lo marca.
  const disponible = product.disponible !== false;

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
        {/* Producto agotado: se avisa en la carta y no se puede pedir. */}
        <AvailabilityBadge disponible={disponible} />
      </div>

      <div className="product-card-body min-w-0">
        <h3 className="product-card-name break-words text-lg">{product.name}</h3>

        {product.description && (
          <p className="product-card-desc text-xs">{product.description}</p>
        )}

        {showSizeSelector && (
          <div className="product-card-sizes">
            <span className="product-card-sizes-label">Tamaño:</span>
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

        {/* Precio y boton en la misma fila, como en la carta de referencia. */}
        <div className="product-card-buy">
          <p className="product-card-price text-lg">{product.price}</p>
          <button
            type="button"
            className="product-card-add"
            disabled={!disponible}
            onClick={() =>
              onAddToCart({
                name: product.name,
                price: product.price,
                image: foto ?? '',
              })
            }
            data-testid={`button-add-${product.id}`}
          >
            {disponible ? (
              <>
                <span aria-hidden="true">+</span> Añadir
              </>
            ) : (
              'Agotado'
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
