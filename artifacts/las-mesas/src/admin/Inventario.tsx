import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ClipboardList, FileText, LogOut, Moon, Pencil, RefreshCw, Search, Settings, Sun, UtensilsCrossed } from 'lucide-react';
import { Link } from 'wouter';
import { notificarMenuActualizado } from '@/products';
import Login, { borrarToken, leerToken } from '@/admin/Login';
import ProductoEditorForm, { type ProductoEditor } from '@/admin/ProductoEditor';
import HorarioAdmin from '@/admin/HorarioAdmin';
import { supabaseNavegador } from '@/lib/supabase';
import { useTheme } from '@/ThemeContext';

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
  option_group_ids?: string[];
}

function precioTexto(valor: number): string {
  return `${Number(valor || 0).toFixed(2).replace('.', ',')} €`;
}

const Inventario: React.FC = () => {
  const { tema, alternarTema } = useTheme();
  const [token, setToken] = useState<string>(() => leerToken());
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'agotados' | 'disponibles'>('todos');
  const [seccion, setSeccion] = useState<'disponibilidad' | 'carta' | 'horario'>('disponibilidad');
  const [editor, setEditor] = useState<ProductoEditor | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDisponibilidad, setBusquedaDisponibilidad] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [bulkCargando, setBulkCargando] = useState(false);
  const [gruposDisponibles, setGruposDisponibles] = useState<
    Array<{ id: string; name: string; type: string; max: number }>
  >([]);

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

  // Cargar grupos de opciones disponibles desde Neon
  useEffect(() => {
    if (!token) return;
    const r = fetch('/api/admin-opciones', {
      headers: { Authorization: 'Bearer ' + token },
    });
    r.then((res) => res.json()).then((data) => {
      setGruposDisponibles(data.grupos ?? []);
    }).catch(() => setGruposDisponibles([]));
  }, [token]);

  const categorias = useMemo(() => Array.from(new Set(productos.map((p) => p.categoria?.trim()).filter((c): c is string => Boolean(c)))).sort((a, b) => a.localeCompare(b, 'es')), [productos]);

  const visibles = useMemo(() => {
    const texto = busquedaDisponibilidad.trim().toLocaleLowerCase('es');
    return productos.filter((p) => {
      if (filtro === 'agotados' && p.disponible) return false;
      if (filtro === 'disponibles' && !p.disponible) return false;
      if (categoriaFiltro !== 'todas' && (p.categoria ?? '') !== categoriaFiltro) return false;
      if (texto && !`${p.nombre} ${p.descripcion ?? ''}`.toLocaleLowerCase('es').includes(texto)) return false;
      return true;
    });
  }, [productos, filtro, busquedaDisponibilidad, categoriaFiltro]);

  const productosCarta = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productos.filter((p) =>
      (categoriaFiltro === 'todas' || (p.categoria ?? '') === categoriaFiltro) &&
      (!texto || p.nombre.toLocaleLowerCase('es').includes(texto) || String(p.descripcion ?? '').toLocaleLowerCase('es').includes(texto)),
    );
  }, [productos, busqueda, categoriaFiltro]);

  const listaSeleccionable = seccion === 'disponibilidad' ? visibles : productosCarta;

  function alternarSeleccion(id: number) {
    setSeleccionados((actuales) => actuales.includes(id) ? actuales.filter((item) => item !== id) : [...actuales, id]);
  }

  function alternarSeleccionVisibles() {
    const ids = listaSeleccionable.map((p) => p.id);
    const yaEstanTodosSeleccionados = ids.length > 0 && ids.every((id) => seleccionados.includes(id));
    setSeleccionados((actuales) => yaEstanTodosSeleccionados
      ? actuales.filter((id) => !ids.includes(id))
      : Array.from(new Set([...actuales, ...ids])));
  }

  async function cambiarSeleccionados(disponible: boolean) {
    const lista = productos.filter((p) => seleccionados.includes(p.id) && p.disponible !== disponible);
    if (!lista.length) { setSeleccionados([]); return; }
    const accion = disponible ? 'marcar disponibles' : 'marcar agotados';
    if (!window.confirm(`¿Quieres ${accion} ${lista.length} producto${lista.length === 1 ? '' : 's'}?`)) return;
    setBulkCargando(true);
    setError('');
    setAviso('');
    setProductos((actuales) => actuales.map((p) => seleccionados.includes(p.id) ? { ...p, disponible } : p));
    try {
      let fallidos = 0;
      for (let inicio = 0; inicio < lista.length; inicio += 5) {
        const bloque = lista.slice(inicio, inicio + 5);
        const resultados = await Promise.allSettled(bloque.map(async (producto) => {
          const respuesta = await fetch('/api/admin/toggle-availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ id: producto.id, is_available: disponible }),
          });
          const datos = await respuesta.json().catch(() => ({}));
          if (!respuesta.ok) throw new Error(datos?.error ?? `No se pudo actualizar ${producto.nombre}`);
        }));
        fallidos += resultados.filter((resultado) => resultado.status === 'rejected').length;
      }
      if (fallidos) {
        await cargar(token);
        setError(fallidos === 1
          ? 'No se pudo actualizar un producto. Se ha vuelto a cargar el inventario.'
          : `No se pudieron actualizar ${fallidos} productos. Se ha vuelto a cargar el inventario.`);
      } else {
        setAviso(`${lista.length} producto${lista.length === 1 ? '' : 's'} actualizado${lista.length === 1 ? '' : 's'} como ${disponible ? 'disponible' : 'agotado'}${lista.length === 1 ? '' : 's'}.`);
      }
      setSeleccionados([]);
      notificarMenuActualizado();
    } finally {
      setBulkCargando(false);
    }
  }

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

  function controlesSeleccion(lista: ProductoInventario[]) {
    const ids = new Set(lista.map((producto) => producto.id));
    const seleccionVisible = seleccionados.filter((id) => ids.has(id)).length;
    const todos = lista.length > 0 && lista.every((producto) => seleccionados.includes(producto.id));
    return <div className="admin-selection-controls">
      <label className="admin-select-all"><input type="checkbox" checked={todos} disabled={bulkCargando || !lista.length} onChange={() => alternarSeleccionVisibles()} /><span>Seleccionar {lista.length} visibles</span></label>
      {seleccionVisible > 0 && <div className="admin-bulk-actions">
        <strong>{seleccionVisible} seleccionados</strong>
        <button type="button" disabled={bulkCargando} onClick={() => void cambiarSeleccionados(false)}>{bulkCargando ? 'Guardando…' : 'Marcar agotados'}</button>
        <button type="button" disabled={bulkCargando} onClick={() => void cambiarSeleccionados(true)}>Marcar disponibles</button>
        <button type="button" className="admin-bulk-clear" disabled={bulkCargando} onClick={() => setSeleccionados([])}>Quitar selección</button>
      </div>}
    </div>;
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
      option_group_ids: producto.option_group_ids ?? [],
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
      option_group_ids: [],
    });
  }

  if (!token) {
    return <Login destino="/admin/inventario" />;
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div className="admin-logo">
          <img className="logo-3d" src="/images/logo.png" alt="Las Mesas Café & Bar" />
          <span className="admin-eyebrow">
            <UtensilsCrossed size={16} /> Las Mesas
          </span>
          <h1>Inventario</h1>
          <p className="admin-sub">
            {productos.length} productos · {agotados} agotados
          </p>
        </div>
        <div className="admin-acciones">
          <Link className="admin-boton admin-boton-claro" href="/admin/cocina">
            <ClipboardList size={16} /> Cocina
          </Link>
          <Link className="admin-boton admin-boton-claro" href="/admin/barra">
            <FileText size={16} /> Barra
          </Link>
          <button
            type="button"
            className="admin-boton admin-boton-claro"
            onClick={() => void importar()}
            disabled={importando}
          >
            <UtensilsCrossed size={16} /> {importando ? 'Importando…' : 'Importar carta'}
          </button>
          <Link className="admin-boton admin-boton-claro" href="/admin/opciones">
            <Settings size={16} /> Opciones
          </Link>
          <button
            type="button"
            className="admin-theme-toggle"
            onClick={alternarTema}
            aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-pressed={tema === 'dark'}
            title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
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
          onClick={() => { setSeleccionados([]); setSeccion('disponibilidad'); }}
        >
          Disponibilidad
        </button>
        <button
          type="button"
          className={seccion === 'carta' ? 'admin-pestana admin-pestana-activa' : 'admin-pestana'}
          onClick={() => { setSeleccionados([]); setSeccion('carta'); }}
        >
          Editar carta ({productos.length})
        </button>
        <button
          type="button"
          className={seccion === 'horario' ? 'admin-pestana admin-pestana-activa' : 'admin-pestana'}
          onClick={() => { setSeleccionados([]); setSeccion('horario'); }}
        >
          <CalendarClock size={15} /> Horario
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
                onClick={() => { setSeleccionados([]); setFiltro(valor); }}
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="admin-inventory-tools">
            <label className="admin-inventory-search"><Search size={17} aria-hidden="true" /><input type="search" value={busquedaDisponibilidad} onChange={(e) => { setBusquedaDisponibilidad(e.target.value); setSeleccionados([]); }} placeholder="Buscar producto…" aria-label="Buscar en disponibilidad" /></label>
            <select className="admin-category-select" value={categoriaFiltro} onChange={(e) => { setCategoriaFiltro(e.target.value); setSeleccionados([]); }} aria-label="Filtrar disponibilidad por categoría">
              <option value="todas">Todas las categorías</option>{categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </div>
          {controlesSeleccion(visibles)}

          <ul className="admin-lista">
            {visibles.map((producto) => (
              <li key={producto.id} className="admin-item">
                <label className="admin-item-select"><input type="checkbox" checked={seleccionados.includes(producto.id)} onChange={() => alternarSeleccion(producto.id)} aria-label={`Seleccionar ${producto.nombre}`} /><span /></label>
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
              onChange={(e) => { setBusqueda(e.target.value); setSeleccionados([]); }}
              placeholder="Buscar producto…"
              data-testid="input-buscar-producto"
            />
            <select className="admin-category-select" value={categoriaFiltro} onChange={(e) => { setCategoriaFiltro(e.target.value); setSeleccionados([]); }} aria-label="Filtrar carta por categoría">
              <option value="todas">Todas las categorías</option>{categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
            <button
              type="button"
              className="admin-boton"
              onClick={nuevoProducto}
              data-testid="button-nuevo-producto"
            >
              + Añadir Nuevo Producto
            </button>
          </div>
          {controlesSeleccion(productosCarta)}

          <ul className="admin-lista">
            {productosCarta.map((producto) => (
              <li key={producto.id} className="admin-item">
                <label className="admin-item-select"><input type="checkbox" checked={seleccionados.includes(producto.id)} onChange={() => alternarSeleccion(producto.id)} aria-label={`Seleccionar ${producto.nombre}`} /><span /></label>
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

      {seccion === 'horario' && <HorarioAdmin token={token} />}

      {editor && (
        <ProductoEditorForm
          producto={editor}
          token={token}
          gruposDisponibles={gruposDisponibles}
          onGuardar={(datos) => guardarProducto(datos)}
          onBorrar={(id) => borrarProducto(id)}
          onCerrar={() => setEditor(null)}
        />
      )}
    </div>
  );
};

export default Inventario;
