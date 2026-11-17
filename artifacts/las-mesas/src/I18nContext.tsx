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
    'hero.cafebar': 'Café · Bar · Billar',
    'hero.baja': 'BAJA UN POCO',
    'casa.titulo': 'Un punto de encuentro en el barrio',
    'casa.desc': 'En Las Mesas el plan no tiene que complicarse: algo rico para picar, una charla sin prisa y, si apetece, una partida de billar.',
    'casa.plan': 'Una mesa para cada plan',
    'casa.billar': 'Una partida',
    'casa.compartir': 'Algo para compartir',
    'cita.titulo': 'La mejor jugada',
    'cita.sub': 'es compartir la mesa.',
    'billard.titulo': 'Un plan con pausa',
    'billard.desc': 'La conversación se mueve alrededor de la mesa. Entre plato y plato, una partida convierte una cena cualquiera en un buen recuerdo.',
    'footer.lema': 'Comer. Encontrarse. Jugar un rato.',
    'footer.direccion': 'Dirección',
    'footer.horario': 'Horario',
    'footer.contacto': 'Contacto',
    'footer.redes': 'Redes y reseñas',
    'footer.llamanos': 'Llámanos',
    'pedido.confirmado.desc': 'Te hemos enviado la confirmación por correo. Tu código de pedido es',
    'pedido.cancelado.desc': 'No se ha realizado ningún cobro. Tu carrito sigue intacto.',
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
    'hero.cafebar': 'Coffee · Bar · Pool',
    'hero.baja': 'TAKE IT EASY',
    'casa.titulo': 'A meeting point in the neighbourhood',
    'casa.desc': 'At Las Mesas things stay simple: something tasty to nibble on, an unhurried chat and, if you fancy, a game of pool.',
    'casa.plan': 'A table for every plan',
    'casa.billar': 'A game',
    'casa.compartir': 'Something to share',
    'cita.titulo': 'The best move',
    'cita.sub': 'is sharing the table.',
    'billard.titulo': 'A plan with a pause',
    'billard.desc': 'Conversation revolves around the table. Between courses, a game turns any dinner into a good memory.',
    'footer.lema': 'Eat. Meet. Play a while.',
    'footer.direccion': 'Address',
    'footer.horario': 'Opening hours',
    'footer.contacto': 'Contact',
    'footer.redes': 'Social & reviews',
    'footer.llamanos': 'Call us',
    'pedido.confirmado.desc': 'We have emailed your confirmation. Your order code is',
    'pedido.cancelado.desc': 'No charge was made. Your cart is still intact.',
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
    'hero.cafebar': 'Café · Bar · Billard',
    'hero.baja': 'DESCENDS UN PEU',
    'casa.titulo': 'Un lieu de rencontre dans le quartier',
    'casa.desc': 'Aux Mesas, pas de compliquation : quelque chose de bon à grignoter, une conversation sans presse et, si ça vous dit, une partie de billard.',
    'casa.plan': 'Une table pour chaque envie',
    'casa.billar': 'Une partie',
    'casa.compartir': 'Quelque chose à partager',
    'cita.titulo': 'Le meilleur coup',
    'cita.sub': 'est de partager la table.',
    'billard.titulo': 'Un plan avec une pause',
    'billard.desc': 'La conversation tourne autour de la table. entre les plats, une partie transforme un dîner ordinaire en un bon souvenir.',
    'footer.lema': 'Manger. Se retrouver. Jouer un peu.',
    'footer.direccion': 'Adresse',
    'footer.horario': 'Horaires',
    'footer.contacto': 'Contact',
    'footer.redes': 'Réseaux et avis',
    'footer.llamanos': 'Appelez-nous',
    'pedido.confirmado.desc': 'Nous vous avons envoyé la confirmation par e-mail. Votre code de commande est',
    'pedido.cancelado.desc': 'Aucun prélèvement effectué. Votre panier est intact.',
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
