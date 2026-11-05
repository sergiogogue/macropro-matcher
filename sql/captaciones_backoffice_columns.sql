-- ════════════════════════════════════════════════════════════════════
-- Spec Back-Office · Tarea 2 · Columnas NUEVAS para el Wizard de Captación.
-- 100% ADITIVO: solo ADD COLUMN IF NOT EXISTS. No borra ni renombra nada.
-- Correr UNA vez en Supabase → SQL Editor ANTES de activar los writes del wizard
-- (si la app manda columnas que no existen, el upsert de captaciones falla).
-- ════════════════════════════════════════════════════════════════════
alter table public.captaciones add column if not exists esquema_comision     text;      -- '100/0' | '40/60'
alter table public.captaciones add column if not exists acepta_privacidad     boolean default false;  -- Aviso de Privacidad LFPDPPP
alter table public.captaciones add column if not exists acepta_responsabilidad boolean default false;  -- Responsabilidad de la Información
alter table public.captaciones add column if not exists viabilidad_100         boolean default false;  -- Semáforo de Viabilidad al 100%
alter table public.captaciones add column if not exists firma_nombre           text;      -- nombre completo que escribe el asesor
alter table public.captaciones add column if not exists firma_fecha            timestamptz;
alter table public.captaciones add column if not exists firma_ip               text;      -- IP (se llena solo si se captura server-side; ver decisión 3)

-- Verificación (opcional):
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='captaciones'
--     and column_name in ('esquema_comision','acepta_privacidad','acepta_responsabilidad','viabilidad_100','firma_nombre','firma_fecha','firma_ip');
