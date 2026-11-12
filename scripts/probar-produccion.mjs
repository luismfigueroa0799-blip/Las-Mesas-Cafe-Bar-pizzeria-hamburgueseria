/**
 * Prueba de las APIs desplegadas en produccion.
 *
 * IMPORTANTE (PowerShell): el cuerpo debe escribirse SIN BOM. Si usas
 * `Set-Content -Encoding UTF8`, PowerShell 5.1 anade un BOM (EF BB BF) y
 * Vercel no puede parsear el JSON -> 400 con cuerpo vacio.
 * Usa [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
 *
 * En bash/macOS este script funciona directamente.
 *
 * Uso:  node scripts/probar-produccion.mjs
 */
const BASE =
  process.env.BASE_URL ||
  'https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app';

const N8N =
  process.env.N8N_WEBHOOK_URL ||
  'https://barcafeteria.app.n8n.cloud/webhook/crear-pedido-domicilio';

async function probar(nombre, url, opciones) {
  process.stdout.write(`  ${nombre.padEnd(34)}`);
  try {
    const respuesta = await fetch(url, {
      ...opciones,
      signal: AbortSignal.timeout(45000),
    });
    const texto = await respuesta.text();
    let cuerpo = null;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = null;
    }
    const ok = respuesta.ok && cuerpo !== null;
    console.log(
      `${ok ? 'OK  ' : 'FALLO'} HTTP ${respuesta.status} ${respuesta.headers.get('content-type') ?? ''}`,
    );
    if (cuerpo) {
      const resumen = { ...cuerpo };
      if (typeof resumen.url === 'string') resumen.url = resumen.url.slice(0, 62) + '…';
      console.log(`       ${JSON.stringify(resumen).slice(0, 220)}`);
    } else {
      console.log(`       cuerpo vacio o no JSON: "${texto.slice(0, 120)}"`);
    }
    return ok;
  } catch (error) {
    console.log(`FALLO ${error.message}`);
    return false;
  }
}

console.log(`Base: ${BASE}\n`);

let fallos = 0;

// 1. La API responde JSON (no HTML del SPA)
if (!(await probar('GET /api/webhook (salud)', `${BASE}/api/webhook`, { method: 'GET' })))
  fallos += 1;

// 2. Crea una sesion de pago real en Stripe
if (
  !(await probar('POST /api/checkout (Stripe)', `${BASE}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: '1', name: 'Burger Pizza', price: '12,00', quantity: 1 },
        { id: '63', name: 'Tropical', price: '1,40', quantity: 2 },
      ],
      customerEmail: 'test@test.com',
      customerName: 'Test Cliente',
      telefono: '600000000',
      tipoEntrega: 'recogida',
    }),
  }))
)
  fallos += 1;

// 3. Consulta de sesion inexistente: debe dar 404 con cuerpo JSON
{
  process.stdout.write('  GET /api/pedido (invalida)        ');
  try {
    const respuesta = await fetch(
      `${BASE}/api/pedido?session_id=cs_test_inexistente`,
      { signal: AbortSignal.timeout(45000) },
    );
    const cuerpo = await respuesta.json().catch(() => null);
    const ok = respuesta.status === 404 && cuerpo !== null;
    if (!ok) fallos += 1;
    console.log(
      `${ok ? 'OK  ' : 'FALLO'} HTTP ${respuesta.status} (esperado 404) ${JSON.stringify(cuerpo).slice(0, 70)}`,
    );
  } catch (error) {
    fallos += 1;
    console.log(`FALLO ${error.message}`);
  }
}

// 4. n8n acepta el pedido con el formato exacto
if (
  !(await probar('POST n8n crear-pedido-domicilio', N8N, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Luis Test',
      direccion: 'Calle Mayor 24, 3 B, 35018 Las Palmas de Gran Canaria',
      cliente_telefono: '34600000000',
      items: [{ id: 1, qty: 1 }],
    }),
  }))
)
  fallos += 1;

console.log('');
if (fallos === 0) {
  console.log('Todo correcto: la web, la API de Stripe y el webhook de n8n responden bien.');
} else {
  console.log(`${fallos} comprobacion(es) fallida(s).`);
  process.exit(1);
}
