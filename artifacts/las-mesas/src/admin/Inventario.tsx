import { useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { notificarMenuActualizado } from '@/products';
import Login, { borrarToken, leerToken } from '@/admin/Login';
import { supabaseNavegador } from '@/lib/supabase';

/**
 * Panel de inventario (/admin/inventario).
 *
 * Muestra los productos de la tabla `products` de Neon y permite marcar cada
 * uno como "Disponible" o "Agotado" (columna is_available).
 *
 * El acceso es con el usuario staff de Supabase Auth: el navegador manda
 * usuario y contrasena a /api/admin-login, que hace el login en el servidor
 * (la clave de Supabase nunca sale del servidor) y devuelve el token.
 *
 * Al cambiar un producto se avisa a las pestanas abiertas para que la carta
 * publica se refresque sola (en esta SPA no hay revalidateTag, pero el
 * efecto es el mismo).
 */

interface ProductoInventario {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string | null;
  categoria_id: number | null;
  disponible: boolean;
}

function precioTexto(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')} €`;
}

const Inventario: React.FC = () => {
  const [token, setToken] = useState<string>(() => leerToken());
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [importando, setImportando] = useState(false);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'agotados' | 'disponibles'>('todos');

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
        if (r.status === 401 || r.status === 403) {
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

  // Si no hay sesion, al panel se llega desde /login.
  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      const destino = '/admin/inventario';
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?next=' + encodeURIComponent(destino));
      }
    }
  }, [token]);

  function salir() {
    setToken('');
    setProductos([]);
    setError('');
    borrarToken();
    const supabase = supabaseNavegador();
    if (supabase) void supabase.auth.signOut();
    window.location.assign('/login');
  }

  // Marcar / desmarcar como agotado.
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
      setAviso(
        `${datos.nombre ?? producto.nombre}: ${nuevo ? 'disponible' : 'agotado'}`,
      );
      // La carta publica se refresca sola.
      notificarMenuActualizado();
    } catch {
      setError('No se pudo guardar el cambio');
      void cargar(token);
    } finally {
      setGuardando(null);
    }
  }

  // Importar la carta desde Supabase a la tabla products de Neon.
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
      void cargar(token);
    } catch {
      setError('No se pudo importar la carta');
    } finally {
      setImportando(false);
    }
  }

  const visibles = useMemo(() => {
    if (filtro === 'agotados') return productos.filter((p) => !p.disponible);
    if (filtro === 'disponibles') return productos.filter((p) => p.disponible);
    return productos;
  }, [productos, filtro]);

  const agotados = productos.filter((p) => !p.disponible).length;

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

            <label className={producto.disponible ? 'admin-switch' : 'admin-switch admin-switch-off'}>
              <input
                type="checkbox"
                checked={producto.disponible}
                disabled={guardando === producto.id}
                onChange={() => void alternar(producto)}
              />
              <span className="admin-switch-pista" aria-hidden="true" />
              <span className="admin-switch-texto">
                {guardando === producto.id
                  ? '…'
                  : producto.disponible
                    ? 'Disponible'
                    : 'Agotado'}
              </span>
            </label>
          </li>
        ))}
        {!visibles.length && <li className="admin-vacio">No hay productos que mostrar.</li>}
      </ul>
    </div>
  );
};

export default Inventario;
