import { createContext, useContext, useEffect, useState } from 'react';

type Tema = 'light' | 'dark';

interface ThemeCtx {
  tema: Tema;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  tema: 'light',
  alternarTema: () => {},
});

const CLAVE_TEMA = 'lm_tema';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_TEMA);
      return guardado === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === 'dark') raiz.classList.add('dark');
    else raiz.classList.remove('dark');
    try {
      window.localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [tema]);

  const alternarTema = () => setTema((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
