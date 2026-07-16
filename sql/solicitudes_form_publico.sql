-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Permitir que el formulario público (buscar.html) INSERTE
-- solicitudes de macrolote sin login. Solo INSERT para el rol anónimo.
-- Correr una vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

alter table public.solicitudes_asesor enable row level security;

-- El formulario público (rol anon) SOLO puede insertar (no ve ni edita nada).
drop policy if exists solicitudes_anon_insert on public.solicitudes_asesor;
create policy solicitudes_anon_insert
  on public.solicitudes_asesor
  for insert
  to anon
  with check (true);

-- (La política de acceso total para usuarios logueados debe seguir vigente.
--  Si no existe, créala:)
-- drop policy if exists solicitudes_auth_all on public.solicitudes_asesor;
-- create policy solicitudes_auth_all on public.solicitudes_asesor
--   for all to authenticated using (true) with check (true);
