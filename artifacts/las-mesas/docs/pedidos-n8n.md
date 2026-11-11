# Pedidos: Stripe → n8n

Guía de configuración para conectar el pago de Stripe con el flujo de n8n.

## 1. Variables de entorno en Vercel

Settings → Environment Variables → añadir:

| Variable | Valor | Notas |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` | Panel de Stripe → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | Panel de Stripe → Developers → API keys |
| `NEXT_PUBLIC_URL` | `https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app` | Dominio de producción |
| `N8N_WEBHOOK_URL` | `https://<host-n8n>/webhook/las-mesas` | **Producción** (n8n muestra "Production URL") |
| `N8N_WEBHOOK_URL_TEST` | `https://<host-n8n>/webhook-test/las-mesas` | **Pruebas** (n8n muestra "Test URL") |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Opcional. Si se define, se verifica la firma |

> La URL de pruebas de n8n **solo recibe eventos mientras el flujo esté en modo
> "Listen for test event"**. En producción usa siempre la URL `…/webhook/…`.

## 2. Configurar el webhook en Stripe

Panel de Stripe → **Developers → Webhooks → Add endpoint**

- **URL**:
  ```
  https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/api/webhook
  ```
- **Events**: seleccionar `checkout.session.completed`
- Copiar el **Signing secret** (`whsec_…`) → pegarlo en `STRIPE_WEBHOOK_SECRET`

> En modo test puedes probar con `stripe trigger checkout.session.completed`
> (CLI de Stripe) o desde la propia web con una tarjeta de prueba `4242 4242 4242 4242`.

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
  "nombre": "Cliente Las Mesas",
  "telefono": "",

  "total": "13,00",
  "moneda": "eur",
  "subtotal": "13,00",
  "impuestos": "0.00",
  "metodoPago": "card",

  "articulos": [
    { "id": "pc-3", "name": "Burger Pizza", "qty": 1, "price": "12,00 €" },
    { "id": "cz-1", "name": "Tropical", "qty": 1, "price": "1,40 €" }
  ],

  "modoRecogida": "recogida",
  "mesa": "",

  "urlOrigen": "https://…/app",
  "restaurante": "Las Mesas · Café & Bar",
  "telefonoRestaurante": "+34 928 896 097",
  "whatsappRestaurante": "346010000000"
}
```

### Reglas de enrutado en n8n

- `modoPrueba === true` → avisar solo al equipo (pruebas)
- `modoRecogida === "mesa"` → el pedido va a la mesa `mesa`; si está vacía, avisar por WhatsApp
- `modoRecogida === "recogida"` → avisar que el pedido está listo para recoger

## 4. Probar el flujo

1. En n8n, pon el flujo en modo **Listen for test event** y copia la *Test URL*
2. Pon esa URL en `N8N_WEBHOOK_URL_TEST` en Vercel y haz **Redeploy**
3. En la web, añade productos al carrito, paga con `4242 4242 4242 4242`
4. El pedido debe aparecer en n8n con `modoPrueba: true`

Para verificar el estado sin pagar:

```bash
curl https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/api/webhook
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

> El paso 6 es una comprobación real en Stripe: si alguien entra manualmente en
> `?pedido=ok` sin haber pagado, no se muestra la confirmación.
