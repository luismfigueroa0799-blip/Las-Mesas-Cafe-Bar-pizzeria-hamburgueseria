-- Renombrar el producto Burguerpizza a La Encerrona en Neon
UPDATE public.products
   SET name = 'La Encerrona'
 WHERE lower(name) IN ('burguerpizza', 'burgerpizza', 'burger pizza a la plancha');

-- Verificación
SELECT id, name FROM public.products WHERE name = 'La Encerrona';
