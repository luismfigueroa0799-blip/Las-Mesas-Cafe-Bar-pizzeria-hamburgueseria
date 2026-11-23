# Solicitudes de reserva

La web guarda las solicitudes en `public.solicitudes_reserva` en Neon. No se crea una reserva confirmada automáticamente: Administración debe comprobar disponibilidad, contactar con el cliente y cambiar el estado en `/admin/reservas`.

## Avisos de n8n

1. Importa `n8n-solicitud-reserva-v1.json` en n8n.
2. En el nodo **Avisar al local por Telegram**, selecciona la credencial de Telegram del local y revisa el chat de destino.
3. Ejecuta una prueba desde el nodo Webhook y activa el flujo.
4. Añade en Vercel la variable `N8N_WEBHOOK_SOLICITUD_RESERVA_URL` con la URL de producción del webhook del flujo. Usa el dominio que muestra tu instancia n8n, seguido de `/webhook/solicitud-reserva`.
5. Despliega la web para que la variable quede disponible.

El flujo solo manda el aviso; no vuelve a insertar la reserva en Neon. Así no se crean duplicados. La web conserva la solicitud aunque n8n esté temporalmente fuera de servicio y lo indica al cliente para que llame al local.
