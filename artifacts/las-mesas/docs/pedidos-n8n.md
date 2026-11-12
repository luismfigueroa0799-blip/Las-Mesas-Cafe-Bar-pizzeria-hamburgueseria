# Pedidos: Stripe → n8n

Guía de configuración para conectar el pago de Stripe con el flujo de n8n.

## 1. Variables de entorno en Vercel

Settings → Environment Variables → añadir:

### URL del webhook de n8n (en el código)

El flujo de checkout **no lo crea el navegador**: se pide la sesión de pago al
webhook de n8n, que es quien tiene la clave secreta de Stripe.

Está en `src/pedidos.ts`:

```ts
const WORKFLOW_ID = '6c8d3a58-72e0-4cce-a773-ddd1382fddbd';
const WEBHOOK_PRODUCCION = `https://barcafeteria.app.n8n.cloud/webhook/${WORKFLOW_ID}/webhook`;
const WEBHOOK_PRUEBAS    = `https://barcafeteria.app.n8n.cloud/webhook-test/${WORKFLOW_ID}/webhook`;

/** Ponlo en true solo para hacer una prueba puntual. */
export const USAR_WEBHOOK_DE_PRUEBAS = false;

export const PEDIDOS = {
  activo: true,
  webhook:
    (import.meta.env?.VITE_N8N_WEBHOOK_URL as string | undefined) ||
    (USAR_WEBHOOK_DE_PRUEBAS ? WEBHOOK_PRUEBAS : WEBHOOK_PRODUCCION),
  webhookProduccion: WEBHOOK_PRODUCCION,
  webhookPruebas: WEBHOOK_PRUEBAS,
};
```

Por defecto se usa la URL de **PRODUCCIÓN**. Para comprobar qué se está
usando sin desplegar:

```bash
node scripts/ver-config-pedidos.mjs
```

> ⚠️ Requisitos de n8n:
> - URL de **producción** (`…/webhook/…`): el workflow debe estar **ACTIVO**
>   (toggle arriba a la derecha del editor).
> - URL de **pruebas** (`…/webhook-test/…`): solo responde **una llamada** y
>   hay que pulsar antes "Execute workflow" en el canvas.
>
> Variable opcional en Vercel: `VITE_N8N_WEBHOOK_URL` sobrescribe la URL.

| Variable | Valor | Notas |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` | Panel de Stripe → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | Panel de Stripe → Developers → API keys |
| `NEXT_PUBLIC_URL` | `https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app` | Dominio de producción |
| `N8N_WEBHOOK_URL` | `https://<host-n8n>/webhook/las-mesas` | **Producción** (n8n muestra "Production URL") |
| `N8N_WEBHOOK_URL_TEST` | `https://<host-n8n>/webhook-test/las-mesas` | **Pruebas** (n8n muestra "Test URL") |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Opcional. Si se define, se verifica la firma |

> La URL de pruebas de n8n **solo recibe eventos mientras el flujo esté en modo
> "Listen for test event"**. En producción usa siempre la URL `…/webhook/…`.

## 2. Configurar el webhook en Stripe

Panel de Stripe → **Developers → Webhooks → Add endpoint**

- **URL**:
  ```
  https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app/api/webhook
  ```
- **Events**: seleccionar `checkout.session.completed`
- Copiar el **Signing secret** (`whsec_…`) → pegarlo en `STRIPE_WEBHOOK_SECRET`

> En modo test puedes probar con `stripe trigger checkout.session.completed`
> (CLI de Stripe) o desde la propia web con una tarjeta de prueba `4242 4242 4242 4242`.


> **Importante**: la URL del webhook de Stripe tiene que ser la del despliegue
> **que tiene las funciones de la API** (la que termina en
> `-git-main-luism4.vercel.app`). Si apunta a un despliegue antiguo, Stripe
> recibe el HTML de la web en vez de la respuesta de la funcion y el pedido
> pagado nunca se registra en la base de datos.
>
> Ademas, las urls de retorno de Stripe (exito y cancelacion) las pone la web
> al crear la sesion, asi que apuntan al dominio desde el que el cliente esta
> viendo la carta.
## 3. Flujo de n8n

Nodo **Webhook** (Trigger) → nodo de acción (WhatsApp, email, hoja de cálculo…).

**Método**: POST · **Path**: `las-mesas` · **Response Mode**: `Last Node`

### Datos que recibe el flujo

```json
{
  "evento": "checkout.session.completed",
  "idPedido": "cs_test_a1B2c3…",
  "idPago": "pi_test_X9Y8Z7…",
  "fecha": "2026-11-11T10:24:00.000Z",
  "modoPrueba": true,

  "correo": "cliente@correo.com",
  "nombre": "Ana Pérez",
  "telefono": "600 00 00 00",

  "tipoEntrega": "domicilio",
  "recogida": false,
  "domicilio": true,
  "direccion": "Calle Mayor, nº 24, 3º B, 35018, Las Palmas de Gran Canaria",
  "direccionDetalle": {
    "calle": "Calle Mayor",
    "numero": "24",
    "piso": "3º B",
    "codigoPostal": "35018",
    "ciudad": "Las Palmas de Gran Canaria",
    "pais": "ES"
  },
  "modoRecogida": "domicilio",
  "mesa": "",

  "total": "13.00",
  "moneda": "eur",
  "subtotal": "13.00",
  "impuestos": "0.00",
  "metodoPago": "card",

  "articulos": [
    { "id": "pc-3", "name": "Burger Pizza", "qty": 1, "price": "12,00 €" },
    { "id": "cz-1", "name": "Tropical", "qty": 1, "price": "1,40 €" }
  ],

  "urlOrigen": "https://…/app",
  "restaurante": "Las Mesas · Café & Bar",
  "telefonoRestaurante": "+34 928 896 097",
  "whatsappRestaurante": "346010000000"
}
```

### Ejemplos de envío

**Recogida en local**
```json
{ "tipoEntrega": "recogida", "recogida": true, "domicilio": false,
  "direccion": "", "mesa": "", "modoRecogida": "recogida" }
```

**Envío a domicilio**
```json
{ "tipoEntrega": "domicilio", "recogida": false, "domicilio": true,
  "direccion": "Calle Mayor, nº 24, 3º B, 35018, Las Palmas",
  "modoRecogida": "domicilio" }
```

**Pedido para una mesa (`?mesa=7`)**
```json
{ "tipoEntrega": "recogida", "modoRecogida": "mesa", "mesa": "7" }
```

### Reglas de enrutado en n8n

- `modoPrueba === true` → avisar solo al equipo (pruebas)
- `tipoEntrega === "domicilio"` → preparar el reparto con `direccion` y `telefono`
- `modoRecogida === "mesa"` → el pedido va a la mesa `mesa`; si está vacía, avisar por WhatsApp
- `tipoEntrega === "recogida"` → avisar que el pedido está listo para recoger

## 4. Probar el flujo

1. En n8n, pon el flujo en modo **Listen for test event** y copia la *Test URL*
2. Pon esa URL en `N8N_WEBHOOK_URL_TEST` en Vercel y haz **Redeploy**
3. En la web, añade productos al carrito, paga con `4242 4242 4242 4242`
4. El pedido debe aparecer en n8n con `modoPrueba: true`

Para verificar el estado sin pagar:

```bash
curl https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-git-main-luism4.vercel.app/api/webhook
```

## 5. Endpoints disponibles

| Endpoint | Método | Función |
|---|---|---|
| `/api/checkout` | POST | Crea la sesión de pago en Stripe y devuelve `{ sessionId, url }` |
| `/api/pedido` | GET | Consulta la sesión en Stripe y confirma si el pago se completó |
| `/api/webhook` | POST | Recibe eventos de Stripe y los reenvía a n8n |
| `/api/webhook` | GET | Estado de la configuración (comprueba que las URLs están definidas) |

## 6. Flujo completo del cliente

```
1. Cliente añade productos → carrito (React Context)
2. "Pagar con Stripe" → POST /api/checkout
   └─ Stripe devuelve sessionId + url
3. Redirección a la página de pago de Stripe
4. Cliente paga (tarjeta 4242… en pruebas)
5. Stripe redirige a  /?pedido=ok&session_id=cs_xxx
6. La web llama a GET /api/pedido?session_id=… 
   └─ Verifica en Stripe que payment_status = "paid"
   └─ Muestra el aviso "¡Pedido confirmado!" y vacía el carrito
7. En paralelo, Stripe envía checkout.session.completed a /api/webhook
   └─ El webhook reenvía el pedido a n8n
```

## 7. Contrato plano (formato nuevo)

A partir de ahora la web envía a n8n un **JSON plano** con los datos reales
del pedido. Los nombres de las propiedades son **exactamente** estos:

```json
{
  "order_code": "PED-4K7X",
  "cliente_nombre": "Luis Figueras",
  "direccion": "Calle Mayor, 24, 3 B, 35018 Las Palmas de Gran Canaria",
  "telefono": "34600000000",
  "total": 6.5,
  "items": [
    { "nombre": "La suprema", "cantidad": 1, "precio": 6.5 }
  ]
}
```

| Propiedad        | Tipo       | Notas                                                 |
| ---------------- | ---------- | ----------------------------------------------------- |
| `order_code`     | texto      | Código del pedido, formato `PED-XXXX`                 |
| `cliente_nombre` | texto      | Nombre y apellidos del cliente                         |
| `direccion`      | texto      | Dirección completa o `Recogida en el local`           |
| `telefono`       | texto      | Solo dígitos con prefijo 34 (p. ej. `34600000000`)    |
| `total`          | **número** | Total en euros (6.5, no "6,50" ni 650)                |
| `items`          | **array**  | Líneas del pedido (ver tabla siguiente)               |

Cada línea de `items`:

| Propiedad  | Tipo       | Notas                    |
| ---------- | ---------- | ------------------------ |
| `nombre`   | texto      | Nombre del producto      |
| `cantidad` | número     | Unidades pedidas         |
| `precio`   | **número** | Precio unitario en euros |

### Alias que se envían además

Para que los nodos que ya existían sigan funcionando, el mismo JSON lleva
también los nombres antiguos (apartado 3) y algunos nuevos:

| Alias                        | Valor                        |
| ---------------------------- | ---------------------------- |
| `nombre`                     | = `cliente_nombre`           |
| `cliente_telefono`           | = `telefono`                 |
| `cliente_direccion`          | = `direccion`                |
| `codigo`, `codigo_pedido`    | = `order_code`               |
| `email`, `correo`           | Correo del cliente           |
| `total_cents`, `total_centimos` | Total en céntimos        |
| `tipo`                       | `domicilio` o `mesa`        |
| `modo_entrega`, `tipoEntrega` | `recogida` o `domicilio`   |
| `modo_recogida`, `modoRecogida` | `recogida`, `mesa`…     |
| `mesa`, `mesa_id`          | Número de mesa               |
| `articulos`                  | = `items` (alias)           |
| `recogida`, `domicilio`     | `true`/`false`              |
| `evento`, `idPedido`, `idPago`, `fecha`, `modoPrueba` | Datos del evento de Stripe |
| `restaurante`, `telefonoRestaurante`, `whatsappRestaurante` | Datos del local |

### Dónde está cada cosa

El pedido plano viaja por **tres** sitios a la vez, para que el flujo de n8n lo
encuentre esté donde esté:

1. **En el webhook de creación** (`/api/checkout` → n8n): el JSON plano
   completo, con `total` como número e `items` como array.
2. **En el `metadata` de la sesión de Stripe**: los mismos datos. Los lee el
   trigger "Pago completado en Stripe":
   - `{{ $json.data.object.metadata.cliente_nombre }}`
   - `{{ $json.data.object.metadata.telefono }}`
   - `{{ $json.data.object.metadata.direccion }}`
   - `{{ $json.data.object.metadata.total }}` (texto: `"6.50"`)
   - `{{ JSON.parse($json.data.object.metadata.items) }}`
   - `{{ $json.data.object.metadata.order_code }}`
   - `{{ $json.data.object.metadata.pedido_id }}`
   > En el `metadata` **todos los valores son texto**, porque Stripe solo
   > admite strings (máx. 500 caracteres por valor).
3. **En la tabla `pedidos` de Supabase**: `cliente_nombre`,
   `cliente_telefono`, `direccion`, `items`, `total`, `estado` y
   `payment_intent`.

### Tabla `pedidos` de Supabase

| Columna            | Contenido                                              |
| ------------------ | ------------------------------------------------------ |
| `id`               | Id numérico del pedido (es el `pedido_id`)            |
| `cliente_nombre`   | Nombre del cliente (lo rellena esta web)              |
| `cliente_telefono` | Teléfono normalizado con prefijo 34                   |
| `direccion`        | Dirección de entrega                                   |
| `items`            | JSONB: `{ id, qty, nombre, subtotal, precio_unitario }` |
| `total`            | Total en euros                                         |
| `estado`           | `pendiente_pago` → `pendiente_confirmacion`         |
| `payment_intent`   | Id del intent de Stripe tras el pago                  |

La tabla **NO tiene** columnas `stripe_session_id`, `session_id`, `codigo`,
`order_code` ni `pagado_at`. Para crearlas, en el **SQL Editor de Supabase**:

```sql
alter table public.pedidos add column if not exists stripe_session_id text;
alter table public.pedidos add column if not exists pagado_at timestamptz;
create unique index if not exists pedidos_stripe_session_idx
  on public.pedidos (stripe_session_id);
```

La web funciona igual sin esas columnas (las omite automáticamente).

### Qué revisar en el flujo de n8n

1. **Trigger "Pago completado en Stripe"**: que lea los datos del `metadata`
   (punto 2) o de la tabla `pedidos` usando `metadata.pedido_id`.
2. **Nodo de Telegram / tablet / email**: que use `cliente_nombre`,
   `telefono`, `direccion`, `total` e `items`.
3. **Detalle del pedido**: si el nodo hace un bucle sobre `items`, que use
   `item.nombre`, `item.cantidad` y `item.precio`.
4. **Total**: si el nodo lo recalcula, que sume `precio * cantidad` de cada
   línea (o use directamente el campo `total`).

## 8. Variable nueva

| Variable                | Para qué sirve                                              |
| ----------------------- | ----------------------------------------------------------- |
| `N8N_WEBHOOK_NOTIFICAR` | Opcional: webhook de n8n que **solo notifica** el pedido ya pagado (Telegram, email, tablet). Es **distinto** del de creación: si se usara ese, el flujo insertaría un pedido duplicado. Si se deja vacío, la notificación la hace el trigger "Pago completado en Stripe" de n8n. |

> El paso 6 es una comprobación real en Stripe: si alguien entra manualmente en
> `?pedido=ok` sin haber pagado, no se muestra la confirmación.
