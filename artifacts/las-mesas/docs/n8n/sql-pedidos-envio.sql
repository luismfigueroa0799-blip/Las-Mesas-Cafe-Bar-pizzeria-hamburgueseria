-- Envío a domicilio por distancia (1,50 €/km) y recargo 25%
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS recargo NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envio NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pedidos.distancia_km IS 'Distancia al local calculada por GPS del navegador';
COMMENT ON COLUMN public.pedidos.recargo IS 'Recargo del 25% sobre el subtotal en pedidos a domicilio';
COMMENT ON COLUMN public.pedidos.envio IS 'Coste de envío: distancia_km × 1,50 € (0 en mesa/recogida)';
