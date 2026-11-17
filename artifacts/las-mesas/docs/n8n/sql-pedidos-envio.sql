-- Zona de reparto, recargo y coste de envío en pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS zona_envio TEXT,
  ADD COLUMN IF NOT EXISTS recargo NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envio NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pedidos.zona_envio IS 'Zona de reparto elegida (1-4) en pedidos a domicilio';
COMMENT ON COLUMN public.pedidos.recargo IS 'Recargo del 25% sobre el subtotal en pedidos a domicilio';
COMMENT ON COLUMN public.pedidos.envio IS 'Coste de envío según zona (0 en mesa/recogida)';
