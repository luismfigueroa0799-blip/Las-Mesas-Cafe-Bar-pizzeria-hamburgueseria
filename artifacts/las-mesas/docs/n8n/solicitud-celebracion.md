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
una cosa distinta**:

| Nodo | Qué hay en `$json` |
|---|---|
| **Webhook** (el primero) | `{headers, params, query, body, webhookUrl, executionMode}` → el JSON de la web está dentro de `body` |
| **Webhook con "Raw Body"** | `body` es un **texto** con el JSON, no un objeto |
| **Postgres / Telegram** (si van **después** del Postgres) | **la fila insertada en Neon**, con los nombres de las columnas |

Por eso a veces `$json.body.nombre` da `undefined` y otras veces
`$json.nombre` da vacío: **depende de en qué nodo se pone**.

## ✅ La solución blindada: un nodo Code que lo normaliza todo

Añade un nodo **Code** (o *Execute Code*) justo después del **Webhook** y
conecta **desde él** tanto el nodo de Postgres como el de Telegram:

```
Webhook  ->  Code "Normalizar solicitud"  ┬──> Postgres (insertar fila)
                                            └──> Telegram (aviso)
```

**Código del nodo Code** (pegar en *Code → JavaScript*, modo *Run Once for All Items*):

```js
// Normaliza la solicitud de celebracion: deja los datos con el nombre de
// las columnas de la tabla solicitudes_celebracion, este donde estuvieran.
const salida = [];
for (const item of items) {
  const j = item.json ?? {};
  let b = j.body ?? j;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  const f = { ...j, ...b };
  salida.push({
    json: {
      nombre: f.nombre ?? '',
      contacto: f.contacto ?? '',
      tipo_evento: f.tipoEvento ?? f.tipo_evento ?? '',
      fecha_aproximada: f.fechaAproximada ?? f.fecha_aproximada ?? '',
      numero_personas: Number(f.numeroPersonas ?? f.numero_personas ?? 0),
      detalles: f.detalles ?? '',
    },
  });
}
return salida;
```

Este código busca los datos **en la raíz, en `body`, y aunque `body` venga
como texto** (por si el webhook tiene *Raw Body* activado), y acepta tanto
`tipoEvento` como `tipo_evento`.

### Con el nodo Code, las expresiones son IGUALES en todos los nodos

**Nodo de Postgres** (columna → valor):

| Columna | Valor |
|---|---|
| `nombre` | `{{ $json.nombre }}` |
| `contacto` | `{{ $json.contacto }}` |
| `tipo_evento` | `{{ $json.tipo_evento }}` |
| `fecha_aproximada` | `{{ $json.fecha_aproximada }}` |
| `numero_personas` | `{{ $json.numero_personas }}` |
| `detalles` | `{{ $json.detalles }}` |

**Nodo de Telegram** (el aviso):

```
🎉 ¡NUEVA SOLICITUD DE CELEBRACIÓN! 🎉

👤 Nombre: {{ $json.nombre }}
📞 Contacto: {{ $json.contacto }}
🎊 Tipo: {{ $json.tipo_evento }}
📅 Fecha: {{ $json.fecha_aproximada }}
👥 Personas: {{ $json.numero_personas }}

📝 Detalles: {{ $json.detalles }}
```

Como ambos nodos cuelgan del Code, **da igual en qué orden estén**: los dos
leen lo mismo ✅.

### Sin nodo Code (alternativa rápida)

Si no quieres añadir nodos, el Postgres va justo detrás del Webhook y ahí sí
vale `$json.body.…`; el Telegram, si va **después** del Postgres, usa los
**nombres de las columnas**:

| Dato | En el Postgres (tras el webhook) | En el Telegram (tras el Postgres) |
|---|---|---|
| nombre | `{{ $json.body.nombre }}` | `{{ $json.nombre }}` |
| contacto | `{{ $json.body.contacto }}` | `{{ $json.contacto }}` |
| tipo de evento | `{{ $json.body.tipoEvento }}` | `{{ $json.tipo_evento }}` |
| fecha | `{{ $json.body.fechaAproximada }}` | `{{ $json.fecha_aproximada }}` |
| personas | `{{ $json.body.numeroPersonas }}` | `{{ $json.numero_personas }}` |
| detalles | `{{ $json.body.detalles }}` | `{{ $json.detalles }}` |

**El error típico**: poner `{{ $json.body.nombre }}` en el nodo de Telegram.
Ahí `$json` es la fila de Neon, no el webhook, y `$json.body` no existe →
sale **undefined** o **vacío**.

## Alternativa sin n8n: que avise la web

Si se rellenan `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en Vercel, la
**propia web** manda el aviso a Telegram (además de guardar la solicitud en
Neon por medio de n8n). En ese caso hay que **quitar o desactivar el nodo de
Telegram** del flujo para no recibir el aviso dos veces.

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
