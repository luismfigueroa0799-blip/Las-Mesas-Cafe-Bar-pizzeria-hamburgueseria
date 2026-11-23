import { LegalPageFrame } from '@/LegalPageFrame';

export default function DeclaracionAccesibilidad() {
  return (
    <LegalPageFrame eyebrow="Acceso para todas las personas" title="Declaración de" accent="accesibilidad." description="Compromiso de mejorar el acceso a la carta, los pedidos y la información del local.">
      <p className="legal-intro">Pizzeria Las Mesas trabaja para que su web pueda utilizarse desde distintos dispositivos y por el mayor número posible de personas. La web incluye, entre otras medidas, un enlace para saltar al contenido principal y etiquetas de texto en partes de la interfaz.</p>
      <section><h2>Estado de la evaluación</h2><p>No disponemos todavía de una auditoría completa, independiente y documentada de accesibilidad. Por ese motivo no declaramos que la web cumpla el 100 % de los criterios ni afirmamos conformidad total con un estándar. La evaluación y las mejoras están pendientes de completarse.</p></section>
      <section><h2>Cómo comunicar una barrera</h2><p>Si no puedes acceder a una página, usar un formulario o completar un pedido, cuéntanos qué pantalla y dispositivo utilizas. Contacta con <a href="mailto:lasmesascafeteriabar@gmail.com">lasmesascafeteriabar@gmail.com</a> o llama al <a href="tel:+34928896097">+34 928 896 097</a>. Procuraremos ofrecerte una alternativa y corregir el problema.</p></section>
      <section><h2>Próximos pasos</h2><p>Revisaremos navegación con teclado, foco visible, nombres y etiquetas de controles, contraste, ampliación de texto, estructura de encabezados, mensajes de error y uso en móvil. Publicaremos los resultados y la fecha de la revisión cuando se haya completado la evaluación.</p><p>La aplicación concreta de obligaciones legales de accesibilidad depende de las características y tamaño de la empresa y del servicio. Esta declaración no sustituye una evaluación legal o técnica.</p></section>
      <aside className="legal-note"><strong>Última actualización</strong><span>23 de noviembre de 2026. Para comunicar una barrera: <a href="mailto:lasmesascafeteriabar@gmail.com">lasmesascafeteriabar@gmail.com</a>.</span></aside>
    </LegalPageFrame>
  );
}
