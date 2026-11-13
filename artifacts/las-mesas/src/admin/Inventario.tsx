import { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, RefreshCw, UtensilsCrossed } from 'lucide-react';

/**
 * Panel de inventario: la carta de la web se lee de la tabla `products` de
 * Neon y aqui se marca que productos estan AGOTADOS.
 *
 * El acceso es con el usuario "staff" de Supabase Auth: el navegador manda
 * usuario y contrasena a /api/admin-login, que hace el login en el servidor
 * (la clave de Supabase nunca sale del servidor) y devuelve el token.
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

const CLAVE_TOKEN = 'lm_admin_token';

function precioTexto(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')} €`;
}

const Inventario: React.FC = () => {
  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(CLAVE_TOKEN) ?? '';
    } catch {
      return '';
    }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'agotados' | 'disponibles'>('todos');

  // Cargar el inventario
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
          try {
            sessionStorage.removeItem(CLAVE_TOKEN);
          } catch {
            /* sin sessionStorage */
          }
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
    if (token) void cargar(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entrar
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setError('');
    try {
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? 'No se pudo iniciar sesión');
        return;
      }
      setToken(String(datos.token ?? ''));
      try {
        sessionStorage.setItem(CLAVE_TOKEN, String(datos.token ?? ''));
      } catch {
        /* sin sessionStorage */
      }
      void cargar(String(datos.token ?? ''));
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setEntrando(false);
    }
  }

  function salir() {
    setToken('');
    setProductos([]);
    setError('');
    try {
      sessionStorage.removeItem(CLAVE_TOKEN);
    } catch {
      /* sin sessionStorage */
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
        setAviso(datos?.error ?? 'No se pudo importar la carta');
        return;
      }
      setAviso(
        `Carta importada: ${datos.insertados} nuevos y ${datos.actualizados} actualizados (${datos.total} en total).`,
      );
      void cargar(token);
    } catch {
      setAviso('No se pudo importar la carta');
    } finally {
      setImportando(false);
    }
  }

  // Marcar / desmarcar como agotado
  async function alternar(producto: ProductoInventario) {
    const nuevo = !producto.disponible;
    setGuardando(producto.id);
    setProductos((lista) =>
      lista.map((p) => (p.id === producto.id ? { ...p, disponible: nuevo } : p)),
    );
    try {
      const r = await fetch('/api/admin-productos', {
        method: 'PATCH',
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
    } catch {
      setError('No se pudo guardar el cambio');
      void cargar(token);
    } finally {
      setGuardando(null);
    }
  }

  const visibles = useMemo(() => {
    if (filtro === 'agotados') return productos.filter((p) => !p.disponible);
    if (filtro === 'disponibles') return productos.filter((p) => p.disponible);
    return productos;
  }, [productos, filtro]);

  const agotados = productos.filter((p) => !p.disponible).length;

  // ── Login ──
  if (!token) {
    return (
      <div className="admin-login">
        <form className="admin-card" onSubmit={entrar}>
          <span className="admin-eyebrow">
            <UtensilsCrossed size={16} /> Las Mesas
          </span>
          <h1>Inventario</h1>
          <p className="admin-sub">Entra con tu usuario de staff para marcar los productos agotados.</p>

          <label className="admin-field">
            <span>Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@lasmesas.com"
              autoComplete="username"
              required
            />
          </label>
          <label className="admin-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="admin-error">{error}</p>}

          <button type="submit" className="admin-boton" disabled={entrando}>
            <LogIn size={16} /> {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  // ── Inventario ──
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
          <button type="button" className="admin-boton admin-boton-claro" onClick={() => void importar()} disabled={importando}>
            <UtensilsCrossed size={16} /> {importando ? 'Importando…' : 'Importar carta'}
          </button>
          <button type="button" className="admin-boton admin-boton-claro" onClick={() => void cargar(token)} disabled={cargando}>
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
