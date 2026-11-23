import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'wouter';

const EMAIL = 'lasmesascafeteriabar@gmail.com';
const TELEFONO = '+34 928 896 097';

const secciones = [
  { id: 'pedidos', titulo: '1. Pedidos y disponibilidad', texto: 'La carta muestra los productos, sus precios y, cuando corresponde, las opciones disponibles. La disponibilidad puede variar. El pedido queda recibido cuando la web muestra la confirmación del pago; si el establecimiento no puede prepararlo, contactará con el cliente para ofrecer una solución y devolverá el importe cobrado cuando corresponda.' },
  { id: 'precios', titulo: '2. Precios y pago', texto: 'Los precios se muestran en euros. Antes de pagar, el resumen del carrito indica el importe total aplicable al pedido. El pago en línea se procesa mediante Stripe; Las Mesas no almacena los datos completos de la tarjeta.' },
  { id: 'entrega', titulo: '3. Recogida y entrega a domicilio', texto: 'El cliente debe indicar correctamente sus datos de contacto y, para el reparto, la dirección de entrega. En los pedidos a domicilio se aplica un recargo del 25 % sobre el precio de los productos y un coste de envío de 1,50 € por kilómetro, hasta un máximo de 8 km. La web muestra el importe total antes del pago. El establecimiento podrá contactar con el cliente si no puede completar la entrega en las condiciones indicadas.' },
  { id: 'cancelaciones', titulo: '4. Cancelaciones y reembolsos', texto: 'Para solicitar una cancelación, llama cuanto antes al 928 896 097. Si el pedido todavía no ha empezado a prepararse, Las Mesas aceptará la cancelación y tramitará el reembolso. Una vez iniciada la preparación, no se aceptará la cancelación por cambio de opinión. Si el pedido no puede ser atendido por el establecimiento, se devolverá el importe cobrado cuando corresponda.' },
  { id: 'incidencias', titulo: '5. Incidencias con el pedido', texto: 'Si el pedido llega equivocado, incompleto o en condiciones inadecuadas, contacta con el establecimiento lo antes posible en el 928 896 097 o por correo electrónico. Revisaremos la incidencia y, si procede, ofreceremos la reposición del producto o el reembolso del importe afectado. Los reembolsos aprobados se enviarán al medio de pago original; el plazo de abono puede depender del banco o proveedor de pago.' },
  { id: 'reservas', titulo: '6. Reservas y celebraciones', texto: 'Enviar una solicitud de reserva o celebración desde la web no confirma por sí sola la disponibilidad ni constituye una reserva confirmada. El equipo del establecimiento contactará con el cliente para confirmar los detalles.' },
  { id: 'desistimiento', titulo: '7. Derecho de desistimiento', texto: 'La comida preparada para consumo inmediato puede deteriorarse rápidamente. Por ello, el derecho general de desistimiento puede no resultar aplicable a estos productos conforme a las excepciones previstas en la legislación de consumidores. Esto no limita los derechos del cliente si el pedido no se presta correctamente o presenta una incidencia.' },
  { id: 'reclamaciones', titulo: '8. Consultas y reclamaciones', texto: 'Para consultas o reclamaciones relacionadas con un pedido, puedes contactar con Las Mesas por teléfono o correo electrónico usando los datos indicados en esta página. Se atenderán sin perjuicio de los derechos que correspondan al consumidor conforme a la normativa aplicable.' },
];

export default function CondicionesVenta() {
  return (
    <article className="legal-page">
      <div className="shell legal-shell">
        <Link href="/" className="legal-back"><ArrowLeft size={16} aria-hidden="true" /> Volver a Las Mesas</Link>
        <header className="legal-heading">
          <p className="eyebrow"><span className="gold-dot" /> Información para tus pedidos</p>
          <h1>Condiciones de <em>venta.</em></h1>
          <p>Información clara para pedir en Las Mesas, recoger tu comida o recibirla en casa.</p>
          <p className="legal-updated">Última actualización: 23 de noviembre de 2026</p>
        </header>

        <section className="legal-holder" aria-labelledby="legal-holder-title">
          <div><span className="footer-label">Titular del sitio</span><h2 id="legal-holder-title">Marcial Alexis Jimenez Aleman</h2><p>NIF: 045369294T</p></div>
          <div className="legal-contact-lines">
            <a href={`mailto:${EMAIL}`}><Mail size={16} aria-hidden="true" />{EMAIL}</a>
            <a href="tel:+34928896097"><Phone size={16} aria-hidden="true" />{TELEFONO}</a>
            <p><MapPin size={16} aria-hidden="true" /><span>Domicilio fiscal: C. Pepe Rey, n.º 38, planta 1, Las Palmas de Gran Canaria, Las Palmas.</span></p>
          </div>
        </section>

        <nav className="legal-index" aria-label="Contenido de las condiciones">
          {secciones.map(({ id, titulo }) => <a key={id} href={`#${id}`}>{titulo}</a>)}
        </nav>

        <div className="legal-content">
          <p className="legal-intro">Estas condiciones se aplican a las compras realizadas a través de la web de Pizzeria Las Mesas. Al completar un pedido, el cliente acepta las condiciones que se muestran aquí y en el resumen previo al pago.</p>
          {secciones.map(({ id, titulo, texto }) => <section id={id} key={id}><h2>{titulo}</h2><p>{texto}</p>{id === 'entrega' && <p>La entrega está disponible dentro del radio que admite la web. El sistema indicará si la dirección está fuera de la zona de reparto antes de completar el pago.</p>}</section>)}
          <aside className="legal-note"><strong>¿Necesitas ayuda con un pedido?</strong><span>Llámanos al <a href="tel:+34928896097">{TELEFONO}</a> o escríbenos a <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</span></aside>
          <p className="legal-smallprint">Estas condiciones no reducen los derechos reconocidos al consumidor por la legislación vigente.</p>
        </div>
      </div>
    </article>
  );
}
