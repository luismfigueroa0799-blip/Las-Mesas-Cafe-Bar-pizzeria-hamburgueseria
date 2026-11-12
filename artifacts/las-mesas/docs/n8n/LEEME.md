# Workflows de n8n de Las Mesas

Estos tres archivos son los workflows de n8n. **Importa en n8n el que te
indique cada paso** (n8n → ⋯ → Import from File → sobrescribe el que exista).

| Archivo | Para qué |
|---|---|
| `n8n-crear-pedido-domicilio.json` | Crea el pedido a domicilio y la sesión de pago de Stripe (webhook `crear-pedido-domicilio`). |
| `n8n-confirmacion-pago-stripe.json` | Aviso de pago a cocina: inserta el pedido en Neon, manda Telegram, email y aviso por voz. **Incluye el INSERT en Neon.** |
| `n8n-confirmacion-pago-stripe-sin-insert.json` | Igual que el anterior pero **sin** el INSERT en Neon (para cuando la web ya guarda el pedido en Neon y no quieres la fila duplicada). |

## Recomendación

1. Importa `n8n-confirmacion-pago-stripe-sin-insert.json` (el de 9 KB, sin insert).
2. Deja el de creación **desactivado** y tira del Plan B de la web
   (la web crea el pedido en Neon y la sesión de Stripe).
   - Para eso hace falta `DATABASE_URL` de Neon en Vercel.
3. Si prefieres que el pedido lo guarde n8n, activa el de creación y usa en
   su lugar `n8n-confirmacion-pago-stripe.json`.

## El email

En el workflow corregido, el nodo "Send an Email" ya lleva asunto y cuerpo
reales. Ojo a dos cosas:

- **`fromEmail`**: tiene que ser la MISMA cuenta que la credencial SMTP
  (`lasmesascafeteriabar@gmail.com` si esa es la de la credencial).
- **`toEmail`**: ahora va al cliente (`metadata.email`). Si lo quieres
  siempre al restaurante, quita el `|| 'luism.figueroa0799@gmail.com'`.
