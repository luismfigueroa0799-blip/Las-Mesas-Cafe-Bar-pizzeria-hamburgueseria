import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { CartProvider } from '@/CartContext';
import { ThemeProvider } from '@/ThemeContext';
import { I18nProvider } from '@/I18nContext';

import './index.css';
import './admin.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <ThemeProvider>
      <I18nProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </I18nProvider>
    </ThemeProvider>
  </ErrorBoundary>,
);
