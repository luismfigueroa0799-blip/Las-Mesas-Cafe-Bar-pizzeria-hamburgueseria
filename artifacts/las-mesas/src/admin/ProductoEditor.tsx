import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { CATEGORIES } from '@/products';

/**
 * Formulario de edicion de un producto de la carta (tabla products de
 * Neon).
 *
 * Sirve para crear un producto nuevo (vacio) y para editar uno existente.
 * Los campos son: nombre, descripcion, precio, imagen y categoria.
 *
 * La imagen se sube desde el dispositivo (galeria o camara del movil) a
 * Vercel Blob: se elige el fichero, se reduce en el navegador y se sube.
 * La url que devuelve el servidor es la que se guarda en image_url.
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

/** Ancho maximo de la imagen que se sube (se reduce en el navegador). */
const ANCHO_MAXIMO = 1600;
/** Peso de la imagen ya reducida. */
const CALIDAD = 0.88;

const vacio = (): ProductoEditor => ({
  id: null,
  nombre: '',
  descripcion: '',
  precio: 0,
  imagen: null,
  categoria_id: CATEGORIES[0]?.id ?? null,
  disponible: true,
});

/**
 * Lee la imagen del dispositivo y la reduce para que pese poco (las fotos de
 * movil pueden pesar 5 MB) y para que la carta cargue rapido.
 */
async function reducirImagen(fichero: File): Promise<{ base64: string; previa: string }> {
  const url = URL.createObjectURL(fichero);
  try {
    const img = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const imagen = new Image();
      imagen.onload = () => resolver(imagen);
      imagen.onerror = () => rechazar(new Error('No se ha podido leer la imagen'));
      imagen.src = url;
    });

    const escala = Math.min(1, ANCHO_MAXIMO / (img.naturalWidth || ANCHO_MAXIMO));
    const ancho = Math.max(1, Math.round((img.naturalWidth || ANCHO_MAXIMO) * escala));
    const alto = Math.max(1, Math.round((img.naturalHeight || ANCHO_MAXIMO) * escala));

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('El navegador no deja preparar la imagen');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);

    const dataUrl = lienzo.toDataURL('image/jpeg', CALIDAD);
    return { base64: dataUrl, previa: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ProductoEditorForm: React.FC<Props> = ({ producto, token, onGuardar, onBorrar, onCerrar }) => {
  const [datos, setDatos] = useState<ProductoEditor>(producto ?? vacio());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [previa, setPrevia] = useState<string>('');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const inputFichero = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDatos(producto ?? vacio());
    setPrevia(producto?.imagen ?? '');
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

  /** Elegir imagen del dispositivo, reducirla y subirla al almacen. */
  async function elegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0];
    if (!fichero) return;
    setSubiendo(true);
    setError('');
    try {
      const { base64, previa: vista } = await reducirImagen(fichero);
      setPrevia(vista);

      const r = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ nombre: fichero.name, contenido: base64 }),
      });
      const texto = await r.text();
      let respuesta: any = null;
      try {
        respuesta = JSON.parse(texto);
      } catch {
        /* respuesta no json */
      }
      if (!r.ok) {
        throw new Error(respuesta?.error ?? 'No se pudo subir la imagen');
      }
      setDatos((previo) => ({ ...previo, imagen: respuesta.url }));
      setPrevia(respuesta.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubiendo(false);
      if (inputFichero.current) inputFichero.current.value = '';
    }
  }

  /** Quitar la imagen del producto (de la ficha, no del almacen). */
  function quitarImagen() {
    setDatos((previo) => ({ ...previo, imagen: null }));
    setPrevia('');
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (subiendo) {
      setError('Espera a que termine de subir la imagen');
      return;
    }
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

          {/* ---- Imagen: del dispositivo (galeria o camara) ---- */}
          <div className="admin-field">
            <span>Imagen</span>

            <div className="admin-imagen-zona">
              {previa ? (
                <div className="admin-imagen-previa">
                  <img src={previa} alt="Vista previa de la imagen" />
                  <button
                    type="button"
                    className="admin-imagen-quitar"
                    onClick={quitarImagen}
                    aria-label="Quitar la imagen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <div className="admin-imagen-vacia">
                  <ImagePlus size={26} />
                  <span>Sin imagen</span>
                </div>
              )}

              <div className="admin-imagen-acciones">
                <input
                  id="input-producto-imagen"
                  ref={inputFichero}
                  type="file"
                  accept="image/*"
                  className="admin-input-fichero"
                  onChange={(e) => void elegirImagen(e)}
                  data-testid="input-producto-imagen"
                />
                <label
                  htmlFor="input-producto-imagen"
                  className="admin-boton admin-boton-claro admin-boton-fichero"
                  onClick={(e) => {
                    // El label ya abre el input, pero lo assuremos: si el
                    // navegador no lo hace, lo abrimos nosotros.
                    e.preventDefault();
                    inputFichero.current?.click();
                  }}
                >
                  {subiendo ? (
                    <>
                      <Loader2 size={16} className="admin-girando" /> Subiendo…
                    </>
                  ) : (
                    <>
                      <ImagePlus size={16} /> {previa ? 'Cambiar imagen' : 'Subir imagen'}
                    </>
                  )}
                </label>
                <small className="admin-pista">
                  Se elige desde la galeria o la camara del movil. La imagen se
                  reduce y se guarda en el almacen de Vercel.
                </small>
              </div>
            </div>
          </div>

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
              <button type="submit" className="admin-boton" disabled={guardando || subiendo}>
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
