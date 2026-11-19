-- ============================================================
-- Las Mesas · Personalización de productos (estilo Glovo)
-- Ejecutar UNA VEZ en el SQL Editor de Neon. Idempotente.
-- NOTA: la tabla se llama product_options (options es palabra reservada).
-- ============================================================

-- 1) Grupos de opciones reutilizables
CREATE TABLE IF NOT EXISTS public.option_groups (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'extra'
                CHECK (type IN ('quitar', 'extra', 'elegir')),
  required    BOOLEAN NOT NULL DEFAULT FALSE,
  min_choices INTEGER NOT NULL DEFAULT 0 CHECK (min_choices >= 0),
  max_choices INTEGER NOT NULL DEFAULT 1 CHECK (max_choices >= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Opciones dentro de cada grupo (product_options, NO "options")
CREATE TABLE IF NOT EXISTS public.product_options (
  id           BIGSERIAL PRIMARY KEY,
  group_id     BIGINT NOT NULL REFERENCES public.option_groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  extra_price  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (extra_price >= 0),
  available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_options_group_id ON public.product_options(group_id);

-- 3) Los productos llevan los ids de sus grupos
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS option_group_ids TEXT[] NOT NULL DEFAULT '{}';

-- 4) Nota y opciones elegidas en el pedido
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS nota_cocina TEXT;
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS opciones JSONB NOT NULL DEFAULT '[]'::jsonb;
