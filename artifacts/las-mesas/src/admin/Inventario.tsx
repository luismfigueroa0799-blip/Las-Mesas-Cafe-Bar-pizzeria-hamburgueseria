import { useEffect, useMemo, useState } from 'react';
import { LogOut, Pencil, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { notificarMenuActualizado } from '@/products';
import Login, { borrarToken, leerToken } from '@/admin/Login';
import ProductoEditorForm, { type ProductoEditor } from '@/admin/ProductoEditor';
import { supabaseNavegador } from '@/lib/supabase';

/**
 * Panel de inventario (/admin/inventario).
 *
 * Dos secciones:
 *   - Disponibilidad: marcar cada producto como Disponible o Agotado.
 *   - Editar carta: crear y modificar los productos de la tabla products de
 *     Neon (nombre, descripcion, precio, imagen y categoria).
 *
 * El acceso es con el usuario staff de Supabase Auth: el navegador manda
 * usuario y contrasena a /api/admin-login, que hace el login en el servidor
 * (la clave secreta nunca sale del servidor) y devuelve el token.
 */

interface ProductoInventario {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string | null;
  categoria_id: number | null;
  /** Nombre de la categoria (lo resuelve la API). */
  categoria?: string | null;
  disponible: boolean;
}

function precioTexto(valor: number): string {
  return `${Number(valor || 0).toFixed(2).replace('.', ',')} €`;
}

const Inventario: React.FC = () => {
  const [token, setToken] = useState<string>(() => leerToken());
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'agotados' | 'disponibles'>('todos');
  const [seccion, setSeccion] = useState<'disponibilidad' | 'carta'>('disponibilidad');
  const [editor, setEditor] = useState<ProductoEditor | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = async (tokenActivo: string) => {
    if (!tokenActivo) return;
    setCargando(true);
    try {
      const r = await fetch('/api/admin-productos', {
        headers: { Authorization: 'Bearer ' + tokenActivo },
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? 'No se pudo cargar el inventario');
        if (r.status === 401) {
          setToken('');
          borrarToken();
        }
        return;
      }
      setProductos(Array.isArray(datos) ? datos : []);
      setError('');
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (token) {
      void cargar(token);
      return;
    }
    // Si la sesion se inicio con Supabase en el navegador, el token esta en
    // la sesion de Supabase (no en nuestro sessionStorage).
    const supabase = supabaseNavegador();
    if (!supabase) return;
    let vigente = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return;
      const access = data.session?.access_token ?? '';
      if (access) {
        setToken(access);
        void cargar(access);
      }
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibles = useMemo(() => {
    if (filtro === 'agotados') return productos.filter((p) => !p.disponible);
    if (filtro === 'disponibles') return productos.filter((p) => p.disponible);
    return productos;
  }, [productos, filtro]);

  const productosCarta = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(texto) ||
        String(p.descripcion ?? '').toLowerCase().includes(texto),
    );
  }, [productos, busqueda]);

  const agotados = productos.filter((p) => !p.disponible).length;

  function salir() {
    setToken('');
    setProductos([]);
    setError('');
    borrarToken();
    const supabase = supabaseNavegador();
    if (supabase) void supabase.auth.signOut();
    window.location.assign('/login');
  }

  /** Marcar / desmarcar como agotado. */
  async function alternar(producto: ProductoInventario) {
    const nuevo = !producto.disponible;
    setGuardando(producto.id);
    setProductos((lista) =>
      lista.map((p) => (p.id === producto.id ? { ...p, disponible: nuevo } : p)),
    );
    try {
      const r = await fetch('/api/admin/toggle-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id: producto.id, is_available: nuevo }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? 'No se pudo guardar el cambio');
        void cargar(token);
        return;
      }
      setError('');
      // La carta abierta se refresca sola.
      notificarMenuActualizado();
    } catch {
      setError('No se pudo guardar el cambio');
      void cargar(token);
    } finally {
      setGuardando(null);
    }
  }

  /** Importar la carta desde Supabase a la tabla products de Neon. */
  async function importar() {
    setImportando(true);
    setAviso('');
    try {
      const r = await fetch('/api/admin-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ accion: 'importar' }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? 'No se pudo importar la carta');
        return;
      }
      setAviso(
        `Carta importada: ${datos.insertados} nuevos y ${datos.actualizados} actualizados (${datos.total} en total).`,
      );
      await cargar(token);
      notificarMenuActualizado();
    } catch {
      setError('No se pudo importar la carta');
    } finally {
      setImportando(false);
    }
  }

  /** Guardar un producto (nuevo o editado). */
  async function guardarProducto(datos: ProductoEditor) {
    const r = await fetch('/api/admin-productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        accion: 'guardar',
        id: datos.id,
        name: datos.nombre,
        description: datos.descripcion,
        price: datos.precio,
        image_url: datos.imagen,
        category_id: datos.categoria_id,
        is_available: datos.disponible,
      }),
    });
    const texto = await r.text();
    let respuesta: any = null;
    try {
      respuesta = JSON.parse(texto);
    } catch {
      /* respuesta no json */
    }
    if (!r.ok) {
      throw new Error(respuesta?.error ?? 'No se pudo guardar el producto');
    }
    setEditor(null);
    setAviso(
      respuesta?.creado
        ? `Producto "${respuesta?.producto?.name}" creado.`
        : `Producto "${respuesta?.producto?.name}" guardado.`,
    );
    await cargar(token);
    notificarMenuActualizado();
  }

  /** Borrar un producto. */
  async function borrarProducto(id: number) {
    const r = await fetch('/api/admin-productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ accion: 'borrar', id }),
    });
    const texto = await r.text();
    let respuesta: any = null;
    try {
      respuesta = JSON.parse(texto);
    } catch {
      /* respuesta no json */
    }
    if (!r.ok) {
      throw new Error(respuesta?.error ?? 'No se pudo borrar el producto');
    }
    setEditor(null);
    setAviso('Producto borrado.');
    await cargar(token);
    notificarMenuActualizado();
  }

  /** Abrir el editor con los datos de un producto. */
  function editarProducto(producto: ProductoInventario) {
    setEditor({
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: Number(producto.precio ?? 0),
      imagen: producto.imagen ?? null,
      categoria_id: producto.categoria_id ?? null,
      disponible: producto.disponible !== false,
    });
  }

  /** Abrir el editor vacio para crear un producto nuevo. */
  function nuevoProducto() {
    setEditor({
      id: null,
      nombre: '',
      descripcion: '',
      precio: 0,
      imagen: null,
      categoria_id: null,
      disponible: true,
    });
  }

  if (!token) {
    return <Login destino="/admin/inventario" />;
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <span className="admin-eyebrow">
            <UtensilsCrossed size={16} /> Las Mesas
          </span>
          <h1>Inventario</h1>
          <p className="admin-sub">
            {productos.length} productos · {agotados} agotados
          </p>
        </div>
        <div className="admin-acciones">
          <button
            type="button"
            className="admin-boton admin-boton-claro"
            onClick={() => void importar()}
            disabled={importando}
          >
            <UtensilsCrossed size={16} /> {importando ? 'Importando…' : 'Importar carta'}
          </button>
          <button
            type="button"
            className="admin-boton admin-boton-claro"
            onClick={() => void cargar(token)}
            disabled={cargando}
          >
            <RefreshCw size={16} /> {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
          <button type="button" className="admin-boton admin-boton-claro" onClick={salir}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {aviso && <p className="admin-ok">{aviso}</p>}

      <div className="admin-pestanas">
        <button
          type="button"
          className={
            seccion === 'disponibilidad' ? 'admin-pestana admin-pestana-activa' : 'admin-pestana'
          }
          onClick={() => setSeccion('disponibilidad')}
        >
          Disponibilidad
        </button>
        <button
          type="button"
          className={seccion === 'carta' ? 'admin-pestana admin-pestana-activa' : 'admin-pestana'}
          onClick={() => setSeccion('carta')}
        >
          Editar carta ({productos.length})
        </button>
      </div>

      {seccion === 'disponibilidad' && (
        <>
          <div className="admin-filtros">
            {(
              [
                ['todos', `Todos (${productos.length})`],
                ['disponibles', `Disponibles (${productos.length - agotados})`],
                ['agotados', `Agotados (${agotados})`],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                className={filtro === valor ? 'admin-ficha admin-ficha-activa' : 'admin-ficha'}
                onClick={() => setFiltro(valor)}
              >
                {texto}
              </button>
            ))}
          </div>

          <ul className="admin-lista">
            {visibles.map((producto) => (
              <li key={producto.id} className="admin-item">
                {producto.imagen ? (
                  <img className="admin-item-img" src={producto.imagen} alt="" loading="lazy" />
                ) : (
                  <span className="admin-item-img admin-item-sin" aria-hidden="true">
                    {producto.nombre.slice(0, 2).toUpperCase()}
                  </span>
                )}

                <div className="admin-item-info">
                  <strong>{producto.nombre}</strong>
                  {producto.descripcion && <p>{producto.descripcion}</p>}
                  <span className="admin-item-precio">{precioTexto(producto.precio)}</span>
                </div>

                <label
                  className={producto.disponible ? 'admin-switch' : 'admin-switch admin-switch-off'}
                >
                  <input
                    type="checkbox"
                    checked={producto.disponible}
                    disabled={guardando === producto.id}
                    onChange={() => void alternar(producto)}
                  />
                  <span className="admin-switch-pista" aria-hidden="true" />
                  <span className="admin-switch-texto">
                    {guardando === producto.id ? '…' : producto.disponible ? 'Disponible' : 'Agotado'}
                  </span>
                </label>
              </li>
            ))}
            {!visibles.length && <li className="admin-vacio">No hay productos que mostrar.</li>}
          </ul>
        </>
      )}

      {seccion === 'carta' && (
        <>
          <div className="admin-barra-carta">
            <input
              className="admin-buscar"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              data-testid="input-buscar-producto"
            />
            <button
              type="button"
              className="admin-boton"
              onClick={nuevoProducto}
              data-testid="button-nuevo-producto"
            >
              + Añadir Nuevo Producto
            </button>
          </div>

          <ul className="admin-lista">
            {productosCarta.map((producto) => (
              <li key={producto.id} className="admin-item">
                {producto.imagen ? (
                  <img className="admin-item-img" src={producto.imagen} alt="" loading="lazy" />
                ) : (
                  <span className="admin-item-img admin-item-sin" aria-hidden="true">
                    {producto.nombre.slice(0, 2).toUpperCase()}
                  </span>
                )}

                <div className="admin-item-info">
                  <strong>{producto.nombre}</strong>
                  {producto.descripcion && <p>{producto.descripcion}</p>}
                  <span className="admin-item-precio">{precioTexto(producto.precio)}</span>
                  <span className="admin-item-etiquetas">
                    <em className={producto.disponible ? 'etiqueta-ok' : 'etiqueta-agotado'}>
                      {producto.disponible ? 'Disponible' : 'Agotado'}
                    </em>
                    {producto.categoria && <em className="etiqueta-categoria">{producto.categoria}</em>}
                  </span>
                </div>

                <button
                  type="button"
                  className="admin-boton admin-boton-claro admin-editar"
                  onClick={() => editarProducto(producto)}
                  data-testid={`button-editar-${producto.id}`}
                >
                  <Pencil size={15} /> Editar
                </button>
              </li>
            ))}
            {!productosCarta.length && (
              <li className="admin-vacio">No hay productos que mostrar.</li>
            )}
          </ul>
        </>
      )}

      {editor && (
        <ProductoEditorForm
          producto={editor}
          token={token}
          onGuardar={(datos) => guardarProducto(datos)}
          onBorrar={(id) => borrarProducto(id)}
          onCerrar={() => setEditor(null)}
        />
      )}
    </div>
  );
};

export default Inventario;
