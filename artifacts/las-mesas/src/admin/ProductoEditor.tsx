import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { CATEGORIES } from '@/products';

/**
 * Formulario de edicion de un producto de la carta (tabla products de
 * Neon).
 *
 * Sirve para crear un producto nuevo (vacio) y para editar uno existente.
 * Los campos son: nombre, descripcion, precio, url de la imagen y categoria.
 */

export interface ProductoEditor {
  id: number | null;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string | null;
  categoria_id: number | null;
  disponible: boolean;
}

interface Props {
  producto: ProductoEditor | null;
  token: string;
  onGuardar: (datos: ProductoEditor) => Promise<void>;
  onBorrar: (id: number) => Promise<void>;
  onCerrar: () => void;
}

const vacio = (): ProductoEditor => ({
  id: null,
  nombre: '',
  descripcion: '',
  precio: 0,
  imagen: null,
  categoria_id: CATEGORIES[0]?.id ?? null,
  disponible: true,
});

const ProductoEditorForm: React.FC<Props> = ({ producto, token, onGuardar, onBorrar, onCerrar }) => {
  const [datos, setDatos] = useState<ProductoEditor>(producto ?? vacio());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  useEffect(() => {
    setDatos(producto ?? vacio());
    setError('');
    setConfirmarBorrado(false);
  }, [producto]);

  // Cerrar con la tecla Escape
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  function cambiar(campo: keyof ProductoEditor, valor: string | number | boolean | null) {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    setError('');
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await onGuardar(datos);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!datos.id) return;
    setBorrando(true);
    setError('');
    try {
      await onBorrar(datos.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setConfirmarBorrado(false);
    } finally {
      setBorrando(false);
    }
  }

  const esNuevo = datos.id === null;

  return (
    <div className="admin-modal-fondo" onClick={onCerrar} role="presentation">
      <div
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={esNuevo ? 'Nuevo producto' : 'Editar producto'}
      >
        <header className="admin-modal-cabecera">
          <h2>{esNuevo ? 'Nuevo producto' : 'Editar producto'}</h2>
          <button type="button" className="cart-close" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <form className="admin-modal-cuerpo" onSubmit={guardar}>
          <label className="admin-field">
            <span>Nombre *</span>
            <input
              type="text"
              value={datos.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              placeholder="La suprema"
              required
              autoFocus
              data-testid="input-producto-nombre"
            />
          </label>

          <label className="admin-field">
            <span>Descripción</span>
            <textarea
              value={datos.descripcion}
              onChange={(e) => cambiar('descripcion', e.target.value)}
              placeholder="Queso, huevo, bacon, tomate natural..."
              rows={3}
              data-testid="input-producto-descripcion"
            />
          </label>

          <div className="admin-dos-campos">
            <label className="admin-field">
              <span>Precio (€) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={String(datos.precio)}
                onChange={(e) => cambiar('precio', Number(e.target.value))}
                placeholder="6.50"
                required
                data-testid="input-producto-precio"
              />
            </label>

            <label className="admin-field">
              <span>Categoría</span>
              <select
                value={datos.categoria_id === null ? '' : String(datos.categoria_id)}
                onChange={(e) =>
                  cambiar('categoria_id', e.target.value === '' ? null : Number(e.target.value))
                }
                data-testid="select-producto-categoria"
              >
                <option value="">— Sin categoría —</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id ?? c.slug} value={c.id ?? ''}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="admin-field">
            <span>URL de la imagen</span>
            <div className="admin-con-imagen">
              <input
                type="url"
                value={datos.imagen ?? ''}
                onChange={(e) => cambiar('imagen', e.target.value)}
                placeholder="/assets/producto.jpg  o  https://…"
                data-testid="input-producto-imagen"
              />
              {datos.imagen && (
                <a
                  className="admin-ver-imagen"
                  href={datos.imagen}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver
                </a>
              )}
            </div>
            <small className="admin-pista">
              Usa una ruta de /assets/ o una URL completa. Si lo dejas vacío, se
              mantiene la imagen que tenga el producto en la carta.
            </small>
          </label>

          <label className="admin-check">
            <input
              type="checkbox"
              checked={datos.disponible}
              onChange={(e) => cambiar('disponible', e.target.checked)}
            />
            <span>Disponible (si lo quitas, sale como AGOTADO en la carta)</span>
          </label>

          {error && <p className="admin-error">{error}</p>}

          <footer className="admin-modal-pie">
            {!esNuevo && (
              <button
                type="button"
                className="admin-boton admin-boton-peligro"
                onClick={() => setConfirmarBorrado(true)}
                disabled={borrando}
              >
                <Trash2 size={16} /> {borrando ? 'Borrando…' : 'Borrar'}
              </button>
            )}

            {confirmarBorrado && (
              <span className="admin-confirmar">
                ¿Seguro?
                <button
                  type="button"
                  className="admin-boton admin-boton-peligro"
                  onClick={() => void borrar()}
                  disabled={borrando}
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  className="admin-boton admin-boton-claro"
                  onClick={() => setConfirmarBorrado(false)}
                >
                  Cancelar
                </button>
              </span>
            )}

            <div className="admin-modal-acciones">
              <button type="button" className="admin-boton admin-boton-claro" onClick={onCerrar}>
                Cancelar
              </button>
              <button type="submit" className="admin-boton" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ProductoEditorForm;
