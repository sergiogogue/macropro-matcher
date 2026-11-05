-- ════════════════════════════════════════════════════════════════════
-- Fix de duplicados · vitrina_propiedades (publicación desde MacroPro)
-- ────────────────────────────────────────────────────────────────────
-- Problema: aprobarYPublicar() hacía INSERT sin unicidad → re-publicar la
-- misma captación creaba filas duplicadas en la vitrina.
--
-- Solución: índice único PARCIAL sobre `folio` SOLO para filas origen='macropro'.
-- Es scoped a propósito: NO impone restricción a filas de easybroker/landing
-- (respeta la integración: la Landing/EasyBroker siguen sin tocarse).
-- 100% aditivo (CREATE INDEX IF NOT EXISTS); no borra ni renombra nada.
-- Correr UNA vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- 1) (Opcional pero recomendado) Detectar duplicados macropro ANTES de crear el índice.
--    Si esta query devuelve filas, hay que depurar antes (paso 2), o el índice fallará.
-- select folio, count(*)
--   from public.vitrina_propiedades
--   where origen = 'macropro'
--   group by folio having count(*) > 1;

-- 2) (Solo si el paso 1 devolvió duplicados) Conservar la fila más reciente por folio
--    y borrar las anteriores. REVISAR antes de ejecutar.
-- delete from public.vitrina_propiedades v
--  using (
--    select id,
--           row_number() over (partition by folio order by coalesce(updated_at, created_at) desc, created_at desc) as rn
--      from public.vitrina_propiedades
--     where origen = 'macropro'
--  ) d
--  where v.id = d.id and d.rn > 1;

-- 3) Índice único parcial: evita duplicados futuros de MacroPro por folio.
create unique index if not exists vitrina_prop_macropro_folio_uniq
  on public.vitrina_propiedades (folio)
  where origen = 'macropro';

-- Verificación (opcional):
-- select indexname, indexdef from pg_indexes
--  where schemaname='public' and tablename='vitrina_propiedades'
--    and indexname='vitrina_prop_macropro_folio_uniq';
