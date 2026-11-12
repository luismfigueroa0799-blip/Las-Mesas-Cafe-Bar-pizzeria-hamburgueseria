import { readFileSync, writeFileSync } from 'node:fs';

// Variante B del flujo de confirmacion: sin el nodo "Insert rows in a table".
// Se usa cuando la web guarda el pedido en Neon (DATABASE_URL) y asi no se
// duplica la fila (la web inserta una y el flujo otra).
const origen = process.argv[2];
const destino = process.argv[3];

const wf = JSON.parse(readFileSync(origen, 'utf8'));
const antes = wf.nodes.length;

wf.nodes = wf.nodes.filter((n) => n.name !== 'Insert rows in a table');

// El codigo va directo al Telegram y al aviso por voz.
wf.connections['Generar Codigo de Pedido'] = {
  main: [
    [
      { node: 'Avisar domicilio por Telegram', type: 'main', index: 0 },
      { node: 'HTTP Request', type: 'main', index: 0 },
    ],
  ],
};
delete wf.connections['Insert rows in a table'];

writeFileSync(destino, JSON.stringify(wf, null, 2), 'utf8');
console.log('Variante B (sin INSERT en Neon) guardada en:', destino);
console.log('nodos:', antes, '->', wf.nodes.length);
