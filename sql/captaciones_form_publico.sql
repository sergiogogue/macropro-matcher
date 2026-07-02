-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Permitir que el formulario público (captar.html) INSERTE
-- captaciones sin login. Solo INSERT para el rol anónimo (no leer/editar/borrar).
-- Correr una vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

alter table public.captaciones enable row level security;

-- El formulario público (rol anon) SOLO puede insertar (no ve ni edita nada).
drop policy if exists captaciones_anon_insert on public.captaciones;
create policy captaciones_anon_insert
  on public.captaciones
  for insert
  to anon
  with check (true);

-- (La política de acceso total para usuarios logueados sigue vigente:
--  captaciones_auth_all — ver sql/captaciones.sql)
