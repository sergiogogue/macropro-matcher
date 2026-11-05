-- ════════════════════════════════════════════════════════════════════
-- Aprobación para publicar · captaciones → catálogo de MACROLOTES (tabla lotes)
-- ────────────────────────────────────────────────────────────────────
-- Flujo (decidido 2026-11-05): MacroPro NO escribe lotes/vitrina. Solo MARCA la
-- captación como aprobada; la LANDING lee las aprobadas e inserta en `lotes` con
-- sus reglas (clave_unica no nula, id minúscula, upsert por clave → anti-duplicados).
--
-- 100% ADITIVO (add column if not exists). No borra ni renombra nada.
-- Correr UNA vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════
alter table public.captaciones add column if not exists aprobada_publicar  boolean default false;  -- Dirección la aprobó para el catálogo
alter table public.captaciones add column if not exists aprobada_at        timestamptz;            -- cuándo se aprobó
alter table public.captaciones add column if not exists aprobada_por        text;                   -- email de quien aprobó (Dirección)
alter table public.captaciones add column if not exists publicada_lote_id   text;                   -- lo setea la LANDING cuando ya creó el lote (idempotencia)

-- Índice para que la Landing liste rápido lo pendiente de publicar:
create index if not exists captaciones_pendientes_publicar_idx
  on public.captaciones (aprobada_publicar)
  where aprobada_publicar = true and publicada_lote_id is null;

-- Verificación (opcional):
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='captaciones'
--     and column_name in ('aprobada_publicar','aprobada_at','aprobada_por','publicada_lote_id');
