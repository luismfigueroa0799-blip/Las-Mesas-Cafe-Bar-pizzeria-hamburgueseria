-- Tarifas de envío por zonas: guardar el coste en pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS envio NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pedidos.envio IS 'Coste de envío a domicilio según zona (0 en mesa/recogida)';
