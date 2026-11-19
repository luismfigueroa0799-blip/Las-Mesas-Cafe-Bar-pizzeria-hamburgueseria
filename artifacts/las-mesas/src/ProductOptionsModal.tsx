import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { formatearPrecio, precioANumero } from '@/precio';
import type { Product, OptionGroup } from '@/products';
import type { CartOpcion } from '@/CartContext';
import { useI18n } from '@/I18nContext';

interface Props {
  product: Omit<Product, 'image_url' | 'category' | 'category_slug'> & {
    image_url?: string | null;
    category?: string;
    category_slug?: string;
  };
  onClose: () => void;
  onAdd: (opciones: CartOpcion[], nota: string, quantity: number) => void;
}

/** Ventana de personalización de un producto (estilo Glovo). */
const ProductOptionsModal: React.FC<Props> = ({ product, onClose, onAdd }) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [nota, setNota] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  const grupos = useMemo(
    () => (product.optionGroups ?? []).filter((g) => g.options.some((o) => o.available)),
    [product.optionGroups],
  );

  // Foco al abrir, Escape y bloqueo de scroll
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const precioBase = precioANumero(product.price);
  const elegidas: CartOpcion[] = [];
  for (const grp of grupos) {
    for (const id of seleccion[grp.id] ?? []) {
      const op = grp.options.find((o) => o.id === id && o.available);
      if (op) {
        elegidas.push({
          groupId: grp.id,
          groupName: grp.name,
          optionId: op.id,
          optionName: op.name,
          extraPrice: op.extraPrice,
        });
      }
    }
  }
  const total = (precioBase + elegidas.reduce((s, o) => s + o.extraPrice, 0)) * quantity;

  const alternar = (grp: OptionGroup, opId: string) => {
    setError('');
    setSeleccion((prev) => {
      const actuales = prev[grp.id] ?? [];
      if (grp.type === 'elegir') return { ...prev, [grp.id]: [opId] };
      return {
        ...prev,
        [grp.id]: actuales.includes(opId)
          ? actuales.filter((x) => x !== opId)
          : [...actuales, opId],
      };
    });
  };

  const puedenAñadir = useMemo(() => {
    for (const grp of grupos) {
      const n = (seleccion[grp.id] ?? []).length;
      if (grp.required && n < grp.min) return false;
      if (n > grp.max) return false;
    }
    return true;
  }, [grupos, seleccion]);

  const confirmar = () => {
    for (const grp of grupos) {
      const n = (seleccion[grp.id] ?? []).length;
      if (grp.required && n < grp.min) {
        setError(
          (grp.type === 'elegir' ? t('opciones.elige') : t('opciones.minimo')) +
            ' ' +
            grp.name +
            ' (mín. ' +
            grp.min +
            ')',
        );
        return;
      }
      if (n > grp.max) {
        setError(t('opciones.maximo') + ' ' + grp.name + ' (máx. ' + grp.max + ')');
        return;
      }
    }
    onAdd(elegidas, nota.trim().slice(0, 140), quantity);
  };

  return (
    <>
      <div className="opt-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="opt-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('opciones.personaliza') + ' ' + product.name}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="opt-cabecera">
          <h2>{product.name}</h2>
          <button type="button" className="opt-cerrar" onClick={onClose} aria-label={t('opciones.cerrar')}>
            <X size={22} />
          </button>
        </div>

        <div className="opt-cuerpo">
          {product.image_url && (
            <img className="opt-foto" src={product.image_url} alt={product.name} />
          )}
          {product.description && <p className="opt-desc">{product.description}</p>}
          <p className="opt-base">{t('opciones.base')}: <strong>{formatearPrecio(precioBase)}</strong></p>

          {grupos.map((grp) => {
            const actuales = seleccion[grp.id] ?? [];
            return (
              <section className="opt-grupo" key={grp.id}>
                <div className="opt-grupo-titulo">
                  <h3>{grp.name}</h3>
                  <span className="opt-grupo-badge">
                    {grp.type === 'elegir' ? t('opciones.elegir') : grp.type === 'quitar' ? t('opciones.quitar') : t('opciones.extra')}
                    {grp.required ? ' · ' + t('opciones.obligatorio') : ''}
                    {' · ' + t('opciones.max') + ' ' + grp.max}
                  </span>
                </div>
                <div className="opt-lista">
                  {grp.options.filter((o) => o.available).map((op) => {
                    const marcado = actuales.includes(op.id);
                    return (
                      <label key={op.id} className={marcado ? 'opt-opcion is-on' : 'opt-opcion'}>
                        <input
                          type={grp.type === 'elegir' ? 'radio' : 'checkbox'}
                          name={'grp-' + grp.id}
                          checked={marcado}
                          onChange={() => alternar(grp, op.id)}
                          aria-label={op.name}
                        />
                        <span className="opt-nombre">{op.name}</span>
                        <span className="opt-precio">
                          {op.extraPrice > 0 ? '+' + formatearPrecio(op.extraPrice) : t('opciones.gratis')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <label className="opt-nota">
            <span>{t('opciones.nota')}</span>
            <input
              type="text"
              maxLength={140}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder={t('opciones.nota.ph')}
            />
            <small>{nota.length}/140</small>
          </label>

          {error && <p className="opt-error" role="alert">{error}</p>}
        </div>

        <div className="opt-pie">
          <div className="opt-cantidad">
            <button type="button" onClick={() => setQuantity((n) => Math.max(1, n - 1))} aria-label={t('opciones.menos')}>
              <Minus size={18} />
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((n) => n + 1)} aria-label={t('opciones.mas')}>
              <Plus size={18} />
            </button>
          </div>
          <button type="button" className="opt-anadir" onClick={confirmar} disabled={!puedenAñadir}>
            {t('opciones.anadir')} · {formatearPrecio(total)}
          </button>
        </div>
      </div>
    </>
  );
};

export default ProductOptionsModal;
