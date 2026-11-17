import { createContext, useContext, useEffect, useState } from 'react';

export type Idioma = 'es' | 'en' | 'fr';

interface I18nCtx {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  t: (clave: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  idioma: 'es',
  cambiarIdioma: () => {},
  t: (k) => k,
});

const CLAVE_IDIOMA = 'lm_idioma';

// Traducciones de los textos estáticos principales.
const DICCIONARIOS: Record<Idioma, Record<string, string>> = {
  es: {
    'nav.casa': 'La casa', 'nav.local': 'El local', 'nav.carta': 'La carta',
    'nav.celebraciones': 'Celebraciones', 'nav.visitamos': 'Visítanos',
    'nav.reserva': 'Reserva tu mesa',
    'hero.leyenda': 'Las noches', 'hero.leyenda2': 'se alargan', 'hero.leyenda3': 'en buena compañía.',
    'hero.desc': 'Una mesa para comer, otra para jugar y siempre un motivo para quedarse un rato más.',
    'hero.reserva': 'Reserva tu mesa', 'hero.carta': 'Descubre la carta',
    'carta.titulo': 'La carta', 'carta.desc': 'De un bocado rápido a una pizza para el centro. Aquí empieza el plan.',
    'carta.descargar': 'Descargar carta completa', 'carta.enMesa': 'En la mesa',
    'carta.alergenos': 'Alérgenos', 'carta.todos': 'Todos',
    'carrito.titulo': 'Mi pedido', 'carrito.vacio': 'Tu carrito está vacío. Añade algo rico desde la carta.',
    'carrito.total': 'Total', 'carrito.pagar': 'Pagar con Stripe', 'carrito.vaciar': 'Vaciar carrito',
    'carrito.datos': 'Datos de entrega', 'carrito.nombre': 'Nombre completo',
    'carrito.telefono': 'Teléfono', 'carrito.email': 'Correo electrónico',
    'carrito.tipoEntrega': 'Tipo de entrega', 'carrito.recogida': 'Recogida en local',
    'carrito.domicilio': 'Envío a domicilio', 'carrito.mesa': 'Mesa',
    'carrito.calle': 'Calle', 'carrito.numero': 'Número', 'carrito.piso': 'Piso / puerta',
    'carrito.cp': 'Código postal', 'carrito.poblacion': 'Población',
    'carrito.anyadir': 'Añadir', 'carrito.distancia': 'Distancia al local',
    'error.nombre': 'El nombre es obligatorio.', 'error.email': 'El correo electrónico es obligatorio.',
    'error.telefono': 'Para entrega a domicilio hace falta el teléfono.',
    'error.calle': 'La calle es obligatoria.', 'error.numero': 'El número es obligatorio.',
    'error.cp': 'El código postal es obligatorio.',
    'pedido.confirmado': '¡Pedido confirmado!', 'pedido.cancelado': 'Pedido cancelado',
    'footer.condiciones': 'Condiciones de envío:',
  },
  en: {
    'nav.casa': 'Our story', 'nav.local': 'The venue', 'nav.carta': 'Menu',
    'nav.celebraciones': 'Celebrations', 'nav.visitamos': 'Visit us',
    'nav.reserva': 'Book a table',
    'hero.leyenda': 'Evenings', 'hero.leyenda2': 'get longer', 'hero.leyenda3': 'in good company.',
    'hero.desc': 'One table for eating, another for playing, and always a reason to stay a little longer.',
    'hero.reserva': 'Book a table', 'hero.carta': 'Explore the menu',
    'carta.titulo': 'The menu', 'carta.desc': 'From a quick bite to a pizza to share. The plan starts here.',
    'carta.descargar': 'Download full menu', 'carta.enMesa': 'At the table',
    'carta.alergenos': 'Allergens', 'carta.todos': 'All',
    'carrito.titulo': 'My order', 'carrito.vacio': 'Your cart is empty. Add something tasty from the menu.',
    'carrito.total': 'Total', 'carrito.pagar': 'Pay with Stripe', 'carrito.vaciar': 'Clear cart',
    'carrito.datos': 'Delivery details', 'carrito.nombre': 'Full name',
    'carrito.telefono': 'Phone', 'carrito.email': 'Email address',
    'carrito.tipoEntrega': 'Delivery type', 'carrito.recogida': 'Pick up in store',
    'carrito.domicilio': 'Home delivery', 'carrito.mesa': 'Table',
    'carrito.calle': 'Street', 'carrito.numero': 'Number', 'carrito.piso': 'Floor / door',
    'carrito.cp': 'Postal code', 'carrito.poblacion': 'City',
    'carrito.anyadir': 'Add', 'carrito.distancia': 'Distance to venue',
    'error.nombre': 'Name is required.', 'error.email': 'Email is required.',
    'error.telefono': 'Phone is required for home delivery.',
    'error.calle': 'Street is required.', 'error.numero': 'Number is required.',
    'error.cp': 'Postal code is required.',
    'pedido.confirmado': 'Order confirmed!', 'pedido.cancelado': 'Order cancelled',
    'footer.condiciones': 'Delivery terms:',
  },
  fr: {
    'nav.casa': 'Notre histoire', 'nav.local': 'Le lieu', 'nav.carta': 'La carte',
    'nav.celebraciones': 'Célébrations', 'nav.visitamos': 'Nous trouver',
    'nav.reserva': 'Réserver une table',
    'hero.leyenda': 'Les soirées', 'hero.leyenda2': 's’allongent', 'hero.leyenda3': 'en bonne compagnie.',
    'hero.desc': 'Une table pour manger, une autre pour jouer et toujours une raison de rester un peu plus longtemps.',
    'hero.reserva': 'Réserver une table', 'hero.carta': 'Découvrir la carte',
    'carta.titulo': 'La carte', 'carta.desc': 'D’une bouchée rapide à une pizza à partager. Le plan commence ici.',
    'carta.descargar': 'Télécharger la carte', 'carta.enMesa': 'À table',
    'carta.alergenos': 'Allergènes', 'carta.todos': 'Tous',
    'carrito.titulo': 'Ma commande', 'carrito.vacio': 'Votre panier est vide. Ajoutez quelque chose de délicieux.',
    'carrito.total': 'Total', 'carrito.pagar': 'Payer avec Stripe', 'carrito.vaciar': 'Vider le panier',
    'carrito.datos': 'Coordonnées de livraison', 'carrito.nombre': 'Nom complet',
    'carrito.telefono': 'Téléphone', 'carrito.email': 'Adresse e-mail',
    'carrito.tipoEntrega': 'Type de livraison', 'carrito.recogida': 'Retrait sur place',
    'carrito.domicilio': 'Livraison à domicile', 'carrito.mesa': 'Table',
    'carrito.calle': 'Rue', 'carrito.numero': 'Numéro', 'carrito.piso': 'Étage / porte',
    'carrito.cp': 'Code postal', 'carrito.poblacion': 'Ville',
    'carrito.anyadir': 'Ajouter', 'carrito.distancia': 'Distance du lieu',
    'error.nombre': 'Le nom est obligatoire.', 'error.email': 'L’e-mail est obligatoire.',
    'error.telefono': 'Le téléphone est nécessaire pour la livraison.',
    'error.calle': 'La rue est obligatoire.', 'error.numero': 'Le numéro est obligatoire.',
    'error.cp': 'Le code postal est obligatoire.',
    'pedido.confirmado': 'Commande confirmée !', 'pedido.cancelado': 'Commande annulée',
    'footer.condiciones': 'Conditions de livraison :',
  },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_IDIOMA);
      return guardado === 'en' || guardado === 'fr' ? guardado : 'es';
    } catch {
      return 'es';
    }
  });

  useEffect(() => {
    document.documentElement.lang = idioma;
    try {
      window.localStorage.setItem(CLAVE_IDIOMA, idioma);
    } catch { /* no disponible */ }
  }, [idioma]);

  const t = (clave: string) => DICCIONARIOS[idioma][clave] ?? DICCIONARIOS.es[clave] ?? clave;
  const cambiarIdioma = (i: Idioma) => setIdioma(i);

  return (
    <I18nContext.Provider value={{ idioma, cambiarIdioma, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
