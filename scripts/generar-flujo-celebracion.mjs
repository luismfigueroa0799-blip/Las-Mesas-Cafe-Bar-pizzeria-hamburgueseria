// Genera el flujo de n8n corregido para las solicitudes de celebracion.
//
// A partir de "My workflow.json" (exportado por el usuario) crea:
//   scripts/n8n-solicitud-celebracion-corregido.json
//
// El cambio: las expresiones pasan a ser "tolerantes":
//
//     {{ $json.nombre ?? $json.body.nombre }}
//
// asi funcionan tanto si el nodo recibe la FILA de Neon (cuando va despues
// del Postgres) como si recibe el cuerpo del webhook (cuando va detras).
// Asi da igual el orden de los nodos.
//
//   node scripts/generar-flujo-celebracion.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN =
  process.env.FLUJO_ORIGEN ?? 'C:/Users/luism/Downloads/My workflow.json';
const DESTINO =
  'C:/Users/luism/Documents/Default Project/Las-Mesas-Cafe-Bar-pizzeria-hamburgueseria/scripts/n8n-solicitud-celebracion-corregido.json';

const flujo = JSON.parse(readFileSync(ORIGEN, 'utf8'));

/** Expresiones tolerantes: primero la fila de Neon, luego el cuerpo. */
const EXPRESIONES = {
  nombre: '{{ $json.nombre ?? $json.body.nombre }}',
  contacto: '{{ $json.contacto ?? $json.body.contacto }}',
  tipo_evento:
    '{{ $json.tipo_evento ?? $json.tipoEvento ?? $json.body.tipoEvento ?? $json.body.tipo_evento }}',
  fecha_aproximada:
    '{{ $json.fecha_aproximada ?? $json.fechaAproximada ?? $json.body.fechaAproximada }}',
  numero_personas:
    '{{ $json.numero_personas ?? $json.numeroPersonas ?? $json.body.numeroPersonas }}',
  detalles: '{{ $json.detalles ?? $json.body.detalles }}',
};

let cambiados = 0;

for (const nodo of flujo.nodes ?? []) {
  // ── Postgres: el valor de cada columna ──
  if (nodo.type === 'n8n-nodes-base.postgres') {
    const valor = nodo.parameters?.columns?.value ?? {};
    for (const columna of Object.keys(EXPRESIONES)) {
      if (!(columna in valor)) continue;
      const nuevo = '=' + EXPRESIONES[columna];
      if (valor[columna] !== nuevo) {
        valor[columna] = nuevo;
        cambiados += 1;
      }
    }
  }

  // ── Telegram: el texto del aviso ──
  if (nodo.type === 'n8n-nodes-base.telegram') {
    const texto = String(nodo.parameters?.text ?? '');
    const nuevo =
      '=🎉 ¡NUEVA SOLICITUD DE CELEBRACIÓN! 🎉\n\n' +
      '👤 Nombre: ' + EXPRESIONES.nombre + '\n' +
      '📞 Contacto: ' + EXPRESIONES.contacto + '\n' +
      '🎊 Tipo: ' + EXPRESIONES.tipo_evento + '\n' +
      '📅 Fecha: ' + EXPRESIONES.fecha_aproximada + '\n' +
      '👥 Personas: ' + EXPRESIONES.numero_personas + '\n\n' +
      '📝 Detalles: ' + EXPRESIONES.detalles;
    if (texto !== nuevo) {
      nodo.parameters.text = nuevo;
      cambiados += 1;
    }
  }
}

// El nombre del flujo, que "My workflow" no dice nada.
flujo.name = 'Solicitud de celebración';
// Se importa desactivado: lo activa el usuario cuando lo revisa.
flujo.active = false;

writeFileSync(DESTINO, JSON.stringify(flujo, null, 2), 'utf8');

console.log('Expresiones corregidas: ' + cambiados);
console.log('Guardado en: ' + DESTINO);
console.log('');
console.log('=== Expresiones finales ===');
for (const nodo of flujo.nodes ?? []) {
  if (nodo.type === 'n8n-nodes-base.postgres') {
    console.log('  Postgres:');
    for (const [c, v] of Object.entries(nodo.parameters.columns.value)) {
      console.log('    ' + c.padEnd(20) + ' = ' + v);
    }
  }
  if (nodo.type === 'n8n-nodes-base.telegram') {
    console.log('  Telegram:');
    console.log('    ' + nodo.parameters.text.replace(/\n/g, '\n    '));
  }
}
