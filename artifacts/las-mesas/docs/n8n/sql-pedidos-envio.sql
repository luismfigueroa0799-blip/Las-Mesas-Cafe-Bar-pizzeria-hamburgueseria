-- Recargo por servicio a domicilio (25%) y coste de envío
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS recargo NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envio NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pedidos.recargo IS 'Recargo del 25% sobre el subtotal en pedidos a domicilio';
COMMENT ON COLUMN public.pedidos.envio IS 'Coste de envío a domicilio según distancia (0 en mesa/recogida)';
