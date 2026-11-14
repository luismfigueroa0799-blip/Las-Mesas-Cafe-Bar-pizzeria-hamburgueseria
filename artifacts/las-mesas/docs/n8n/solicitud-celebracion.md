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

El nodo de Postgres del flujo debe insertar en `solicitudes_celebracion`.
Una tabla que sirve:

```sql
CREATE TABLE solicitudes_celebracion (
  id                SERIAL PRIMARY KEY,
  nombre            TEXT NOT NULL,
  contacto          TEXT NOT NULL,
  tipo_evento       TEXT,
  fecha_aproximada  TEXT,
  numero_personas   INTEGER,
  detalles          TEXT,
  estado            TEXT DEFAULT 'nueva',
  fecha             TIMESTAMPTZ DEFAULT NOW()
);
```

> **Ojo con el mapeo del nodo de Postgres**: en n8n las expresiones del
> nodo usan `{{ $json.body.nombre }}` (o `{{ $json.nombre }}` si el nodo
> anterior ya se quedó con el cuerpo). Los campos de la tabla se llaman en
> `snake_case` (`tipo_evento`, `numero_personas`…), pero el JSON que llega
> desde la web usa `camelCase` (`tipoEvento`, `numeroPersonas`).

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
