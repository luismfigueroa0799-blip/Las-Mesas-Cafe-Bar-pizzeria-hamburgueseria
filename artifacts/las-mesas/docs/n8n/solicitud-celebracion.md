# Solicitud de celebración (web → n8n → Neon)

El formulario **“Solicitud de celebración”** de la web (sección “¿Qué
celebramos esta vez?”) ya no abre WhatsApp. Al enviarlo, la web hace un
`POST` al webhook de n8n y este guarda la solicitud en la tabla
`solicitudes_celebracion` de Neon.

## Webhook

| | |
|---|---|
| URL de producción | `https://barcafeteria.app.n8n.cloud/webhook/solicitud-celebracion` |
| Método | `POST` |
| Tipo de contenido | `application/json` |
| Variable de entorno (opcional) | `N8N_WEBHOOK_SOLICITUD_CELEBRACION` (si no se pone, se usa la URL de arriba) |

## Datos que recibe

Las claves son **exactas**, no las cambies:

```json
{
  "nombre": "Nombre del cliente",
  "contacto": "+34 600 000 000",
  "tipoEvento": "Cumpleaños",
  "fechaAproximada": "2026-12-24",
  "numeroPersonas": 10,
  "detalles": "Texto libre con los detalles de la celebración"
}
```

| Clave | Tipo | Contenido |
|---|---|---|
| `nombre` | texto | Nombre del cliente (obligatorio) |
| `contacto` | texto | Teléfono o email (obligatorio) |
| `tipoEvento` | texto | `Cumpleaños`, `Cena de empresa` u `Otro encuentro` |
| `fechaAproximada` | texto | Fecha aproximada en formato `AAAA-MM-DD` |
| `numeroPersonas` | número | Número de invitados (entre 1 y 100) |
| `detalles` | texto | Comentarios libres del cliente |

## Cómo va el POST

La web **no** llama a n8n desde el navegador: lo hace desde el servidor, en
`POST /api/solicitud-celebracion`. Así no depende de CORS y la URL del
webhook se puede cambiar con una variable de entorno.

```
Navegador ──POST /api/solicitud-celebracion──▶ Vercel (servidor) ──POST──▶ n8n ──▶ Neon
                                                    ▲
                                                    └── si n8n responde 2xx, la web
                                                        muestra "Solicitud enviada correctamente"
```

## La tabla en Neon

La tabla `solicitudes_celebracion` de Neon queda así (es la que hay creada):

| Columna | Tipo | Valor |
|---|---|---|
| `id` | integer | autoincrement |
| `nombre` | varchar | `nombre` |
| `contacto` | varchar | `contacto` |
| `tipo_evento` | varchar | `tipoEvento` |
| `fecha_aproximada` | varchar | `fechaAproximada` |
| `numero_personas` | integer | `numeroPersonas` |
| `detalles` | text | `detalles` |
| `fecha_creacion` | timestamp | lo pone n8n al insertar |

## ⚠️ Qué expresiones poner en cada nodo (esto es lo importante)

El JSON que manda la web va **plano en la raíz**, pero **cada nodo de n8n ve
una cosa distinta**. Por eso el mismo dato se llama de una forma o de otra
dependiendo del nodo:

| Nodo | Qué hay en `$json` | Cómo pedir el nombre |
|---|---|---|
| **Webhook** (el primero) | `{headers, params, query, body, webhookUrl, executionMode}` → el JSON de la web está dentro de `body` | `{{ $json.body.nombre }}` |
| **Postgres** (si va justo detrás del webhook) | lo mismo que el webhook | `{{ $json.body.nombre }}` |
| **Telegram / HTTP Request / email** (si van **después** del Postgres) | **la fila insertada en Neon**, con los nombres de las columnas | `{{ $json.nombre }}` |

### Ejemplo: nodo de Postgres (columna → valor)

| Columna | Valor |
|---|---|
| `nombre` | `{{ $json.body.nombre }}` |
| `contacto` | `{{ $json.body.contacto }}` |
| `tipo_evento` | `{{ $json.body.tipoEvento }}` |
| `fecha_aproximada` | `{{ $json.body.fechaAproximada }}` |
| `numero_personas` | `{{ $json.body.numeroPersonas }}` |
| `detalles` | `{{ $json.body.detalles }}` |

### Ejemplo: nodo de Telegram (después del Postgres)

```
🎉 Nueva solicitud de celebración

👤 Nombre: {{ $json.nombre }}
📞 Contacto: {{ $json.contacto }}
🎊 Tipo: {{ $json.tipo_evento }}
📅 Fecha aproximada: {{ $json.fecha_aproximada }}
👥 Personas: {{ $json.numero_personas }}

📝 Detalles:
{{ $json.detalles }}

Nº de solicitud: {{ $json.id }}
```

**El error típico**: poner `{{ $json.body.nombre }}` en el nodo de Telegram.
Ahí `$json` es la fila de Neon, no el webhook, y `$json.body` no existe →
sale **undefined**.

Dos formas de arreglarlo:

1. **Cambiar las expresiones** del nodo de Telegram a los nombres de columna
   (`{{ $json.nombre }}`, `{{ $json.tipo_evento }}`, …) ← recomendado.
2. **Mover el nodo de Telegram antes del Postgres**: entonces vuelve a
   aplicar `{{ $json.body.nombre }}`.

> La web manda además alias en `snake_case` (`tipo_evento`, `fecha_aproximada`,
> `numero_personas`) junto a los del contrato, así que en el nodo de Postgres
> sirve `{{ $json.body.tipoEvento }}` o `{{ $json.body.tipo_evento }}`.

## ⚠️ Hay que ACTIVAR el flujo

Un workflow **no activo no registra su webhook de producción**: si el flujo
está apagado, la web responde con un error 404 de n8n y el cliente ve
“no hemos podido enviar la solicitud”.

Para que funcione:

1. Abre el workflow en n8n.
2. Comprueba que el nodo **Webhook** tiene la ruta `solicitud-celebracion`
   (y el método `POST`).
3. **Activa el flujo** con el interruptor *Active* de la esquina superior
   derecha del editor.
4. Copia la *Production URL* que muestra el nodo Webhook: tiene que ser
   `https://barcafeteria.app.n8n.cloud/webhook/solicitud-celebracion`.

## Comprobar que funciona

```bash
curl -X POST https://barcafeteria.app.n8n.cloud/webhook/solicitud-celebracion \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Prueba","contacto":"+34 600 000 000","tipoEvento":"Cumpleaños","fechaAproximada":"2026-12-24","numeroPersonas":10,"detalles":"Prueba tecnica"}'
```

Si el flujo está activo y el nodo de Postgres está bien, responde `200` con
`{"message":"Workflow was started"}` y aparece la fila en la tabla.

Para probar la API de la web (no toca n8n si los datos van incompletos):

```bash
node scripts/probar-celebracion.mjs
```
