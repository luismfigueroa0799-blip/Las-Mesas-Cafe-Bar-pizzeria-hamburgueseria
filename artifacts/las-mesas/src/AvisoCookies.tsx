import { useEffect, useState } from 'react';
import { Cookie, Settings2, X } from 'lucide-react';
import { Link } from 'wouter';
import { guardarConsentimiento, leerConsentimiento } from '@/privacidad-consentimiento';

export default function AvisoCookies() {
  const [visible, setVisible] = useState(false);
  const [configurar, setConfigurar] = useState(false);
  const [ruleta, setRuleta] = useState(false);

  useEffect(() => {
    const abrir = () => {
      const guardado = leerConsentimiento();
      setRuleta(guardado?.ruleta ?? false);
      setVisible(true);
      setConfigurar(true);
    };
    const actual = leerConsentimiento();
    if (!actual) setVisible(true);
    else setRuleta(actual.ruleta);
    window.addEventListener('lm:abrir-preferencias-privacidad', abrir);
    return () => window.removeEventListener('lm:abrir-preferencias-privacidad', abrir);
  }, []);

  function guardar(valor: boolean) {
    guardarConsentimiento(valor);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
      <div className="cookie-consent-copy">
        <p className="cookie-consent-eyebrow"><Cookie size={16} aria-hidden="true" /> Tu privacidad importa</p>
        <h2 id="cookie-consent-title">Tú eliges.</h2>
        <p id="cookie-consent-description">Usamos almacenamiento necesario para que funcionen la web y el carrito. Si aceptas, guardaremos además un identificador aleatorio para que la ruleta recuerde tu participación. Puedes cambiar tu elección cuando quieras.</p>
        <p className="cookie-consent-links"><Link href="/politica-de-cookies" onClick={() => setVisible(false)}>Política de cookies</Link><span aria-hidden="true">·</span><Link href="/privacidad" onClick={() => setVisible(false)}>Privacidad</Link></p>
        {configurar && <label className="cookie-consent-option"><input type="checkbox" checked={ruleta} onChange={(event) => setRuleta(event.target.checked)} /><span><strong>Recordar participación en la ruleta</strong><small>Identificador aleatorio guardado en este dispositivo. Necesario para limitar los premios por visitante.</small></span></label>}
      </div>
      <div className="cookie-consent-actions">
        {configurar ? <button className="cookie-button cookie-button-primary" onClick={() => guardar(ruleta)}>Guardar selección</button> : <button className="cookie-button cookie-button-primary" onClick={() => guardar(true)}>Aceptar todas</button>}
        <button className="cookie-button" onClick={() => guardar(false)}>Solo necesarias</button>
        {!configurar && <button className="cookie-button cookie-button-text" onClick={() => setConfigurar(true)}><Settings2 size={15} aria-hidden="true" /> Configurar</button>}
        {configurar && <button className="cookie-button cookie-button-text" onClick={() => setConfigurar(false)}><X size={15} aria-hidden="true" /> Volver</button>}
      </div>
    </section>
  );
}
