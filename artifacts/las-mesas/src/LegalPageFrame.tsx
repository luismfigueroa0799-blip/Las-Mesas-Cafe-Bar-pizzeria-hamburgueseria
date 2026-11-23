import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';

export const CONTACTO_LEGAL = {
  email: 'lasmesascafeteriabar@gmail.com',
  telefono: '+34 928 896 097',
  titular: 'Marcial Alexis Jimenez Aleman',
  nif: '045369294T',
  domicilio: 'C. Pepe Rey, n.º 38, planta 1, Las Palmas de Gran Canaria, Las Palmas',
};

export function LegalPageFrame({
  eyebrow,
  title,
  accent,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="legal-page">
      <div className="shell legal-shell">
        <Link href="/" className="legal-back"><ArrowLeft size={16} aria-hidden="true" /> Volver a Las Mesas</Link>
        <header className="legal-heading">
          <p className="eyebrow"><span className="gold-dot" /> {eyebrow}</p>
          <h1>{title} <em>{accent}</em></h1>
          <p>{description}</p>
          <p className="legal-updated">Última actualización: 23 de noviembre de 2026</p>
        </header>
        <section className="legal-holder" aria-label="Datos del titular">
          <div><span className="footer-label">Titular del sitio</span><h2>{CONTACTO_LEGAL.titular}</h2><p>NIF: {CONTACTO_LEGAL.nif}</p></div>
          <div className="legal-contact-lines">
            <a href={`mailto:${CONTACTO_LEGAL.email}`}><Mail size={16} aria-hidden="true" />{CONTACTO_LEGAL.email}</a>
            <a href="tel:+34928896097"><Phone size={16} aria-hidden="true" />{CONTACTO_LEGAL.telefono}</a>
            <p><MapPin size={16} aria-hidden="true" /><span>{CONTACTO_LEGAL.domicilio}</span></p>
          </div>
        </section>
        <div className="legal-content">{children}</div>
      </div>
    </article>
  );
}
