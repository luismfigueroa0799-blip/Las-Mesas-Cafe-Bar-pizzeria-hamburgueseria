import { LegalPageFrame } from '@/LegalPageFrame';

const almacenamientos = [
  ['lm_carrito_lasmesas', 'localStorage', 'Conservar los artículos y opciones del carrito al recargar la web o volver del pago.', 'Hasta que se borren los datos del navegador o se vacíe el carrito.'],
  ['lm_tema', 'localStorage', 'Recordar el modo claro u oscuro elegido.', 'Hasta que se borren los datos del navegador.'],
  ['lm_idioma', 'localStorage', 'Recordar el idioma elegido.', 'Hasta que se borren los datos del navegador.'],
  ['lm_menu_refresh', 'localStorage', 'Avisar a otras pestañas que la carta se ha actualizado.', 'Hasta que se borren los datos del navegador; guarda solo la hora de actualización.'],
  ['lm_ruleta_cliente_v1', 'localStorage', 'Reconocer el navegador para aplicar las reglas de participación de la ruleta y evitar repetir premios.', 'Hasta que se borren los datos del navegador; el identificador no contiene nombre ni correo.'],
  ['lm_ruleta_vista_sesion_v1', 'sessionStorage', 'Evitar que la ruleta se vuelva a abrir al recargar la misma sesión.', 'Hasta que se cierre la pestaña o sesión del navegador.'],
  ['sidebar_state', 'Cookie propia', 'Recordar el estado visual del menú lateral en componentes que lo utilizan.', '7 días.'],
];

export default function PoliticaCookies() {
  return (
    <LegalPageFrame eyebrow="Privacidad y almacenamiento" title="Política de" accent="cookies." description="Qué información guarda el navegador para que funcionen la carta, el carrito y algunas preferencias.">
      <p className="legal-intro">En esta web usamos cookies y almacenamiento local del navegador para funciones concretas. En la revisión del código no hemos encontrado herramientas de analítica publicitaria ni píxeles de seguimiento. La configuración puede cambiar si añadimos servicios; esta página se actualizará cuando ocurra.</p>
      <section><h2>Elementos identificados</h2><div className="legal-table-wrap"><table className="legal-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Finalidad</th><th>Duración</th></tr></thead><tbody>{almacenamientos.map(([nombre, tipo, finalidad, duracion]) => <tr key={nombre}><th scope="row"><code>{nombre}</code></th><td>{tipo}</td><td>{finalidad}</td><td>{duracion}</td></tr>)}</tbody></table></div><p>El panel de personal también puede usar cookies técnicas de sesión para mantener el acceso protegido. Esas cookies solo se utilizan al entrar en Administración, Barra o Cocina.</p></section>
      <section><h2>Cómo borrarlos o bloquearlos</h2><p>Puedes borrar cookies y datos del sitio desde los ajustes de privacidad de tu navegador. También puedes bloquear el almacenamiento; en ese caso, el carrito, las preferencias o la ruleta podrían no conservar su estado. Al borrar los datos se elimina el identificador local de la ruleta y el navegador podría ser tratado como una visita nueva.</p><p>Las tipografías se solicitan a Google Fonts. Al cargar recursos externos, el proveedor puede recibir datos técnicos de conexión, como la dirección IP. No se usan aquí para personalizar anuncios.</p></section>
      <section><h2>Base de uso y cambios</h2><p>El carrito, el tema y el idioma guardan preferencias solicitadas al usar esas funciones. La ruleta usa un identificador aleatorio persistente para aplicar sus reglas de participación y evitar repetir premios durante el periodo establecido; no incluye tu nombre, correo ni teléfono. Antes de publicar esta política debe confirmarse si esta función requiere una elección de consentimiento y cómo ofrecerla.</p><p>Si añadimos tecnologías opcionales de medición o publicidad, se solicitará la elección correspondiente antes de activarlas.</p></section>
      <aside className="legal-note"><strong>¿Tienes una consulta?</strong><span>Escribe a <a href="mailto:lasmesascafeteriabar@gmail.com">lasmesascafeteriabar@gmail.com</a>.</span></aside>
    </LegalPageFrame>
  );
}
