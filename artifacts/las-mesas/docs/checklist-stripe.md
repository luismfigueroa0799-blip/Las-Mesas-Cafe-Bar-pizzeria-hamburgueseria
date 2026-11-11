# 🚨 PENDIENTE: Desactivar la autenticación de Vercel

El proyecto tiene activada la **Vercel Authentication (SSO)**. Mientras esté activa:

- Cualquier visitante de la web es redirigido a `vercel.com/sso-api` → **la web no es pública**
- **Stripe no puede entregar el webhook** → el pago no llega a n8n
- **El etch a /api/checkout devuelve 401** y el navegador entra en un bucle de
  redirecciones → el carrito se queda en 'Redirigiendo al pago seguro…' para siempre
- Los bots de Google no pueden indexar la web

## Solución

Vercel → tu proyecto → **Settings** → **Deployment Protection**

Cambia **"Vercel Authentication"** de `Enabled` a:

- **Disabled** (recomendado para una web pública), o
- **Preview Only** (si quieres proteger solo las previews)

Guarda y haz **Redeploy**.

## Cómo confirmar que está resuelto

```bash
curl -s -o NUL -w "HTTP %{http_code}\n" \
  https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/api/webhook
```

- `HTTP 200` → correcto, la API es pública
- `HTTP 302` → sigue protegido

## Checklist completo para que el pago funcione

### 1. Desactivar Vercel Authentication
(ver arriba) — **bloqueante**

### 2. Variables de entorno en Vercel
Settings → Environment Variables → añadir para **Production** y **Preview**:

> Las claves se copian del panel de Stripe (Developers → API keys) y **nunca**
> se escriben en el repositorio.

```
STRIPE_SECRET_KEY                  sk_test_…   (Stripe → Developers → API keys → Secret key)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_test_…   (Stripe → Developers → API keys → Publishable key)
NEXT_PUBLIC_URL                     https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app
N8N_WEBHOOK_URL                    https://<host-n8n>/webhook/las-mesas
N8N_WEBHOOK_URL_TEST               https://<host-n8n>/webhook-test/las-mesas
STRIPE_WEBHOOK_SECRET              whsec_…     (Stripe → Developers → Webhooks → Signing secret)
```

### 3. Webhook en el panel de Stripe
Developers → Webhooks → Add endpoint

- URL: `https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/api/webhook`
- Evento: `checkout.session.completed`
- Copiar el Signing secret → `STRIPE_WEBHOOK_SECRET`

### 4. Redeploy
Deployments → Redeploy (obligatorio tras cambiar variables)

### 5. Verificar
```bash
# API viva
curl https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/api/webhook

# Stripe crea sesión
curl -X POST https://las-mesas-cafe-bar-pizzeria-hamburgueseria-7l1h-cgcz0at74.vercel.app/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":"pc-3","name":"Burger Pizza","price":"12,00 €","quantity":1}],"customerEmail":"test@test.com"}'
```

### 6. Probar el pago
Tarjeta de prueba `4242 4242 4242 4242`, cualquier CVC y fecha futura.
