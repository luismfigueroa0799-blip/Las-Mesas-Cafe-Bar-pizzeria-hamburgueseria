/**
 * Etiqueta de producto agotado.
 *
 * La muestra el panel de inventario: cuando `is_available` es false en la
 * tabla products de Neon, el producto aparece en la carta con esta etiqueta y
 * no se puede pedir.
 */
export const AvailabilityBadge: React.FC<{ disponible?: boolean; className?: string }> = ({
  disponible = true,
  className = '',
}) => {
  if (disponible) return null;
  return (
    <span className={`product-card-agotado ${className}`.trim()} title="Producto agotado">
      Agotado
    </span>
  );
};

export default AvailabilityBadge;
