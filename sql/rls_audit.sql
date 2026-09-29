-- ════════════════════════════════════════════════════════════════════
-- R-03 · Auditoría y endurecimiento de RLS · public
-- Corre por PARTES en Supabase → SQL Editor. NO corras todo de un jalón.
-- Modelo de negocio: 3 usuarios de confianza. "Logueado = acceso total;
-- sin login = nada", salvo el formulario público de captación (anon INSERT).
-- ════════════════════════════════════════════════════════════════════

-- ── PARTE 1 · AUDITORÍA (solo lectura, no cambia nada) ──────────────────
-- 1a) ¿Qué tablas tienen RLS activo?
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;

-- 1b) Políticas existentes por tabla
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 1c) Prueba de fuego (con la publishable/anon key, SIN login):
--     lo ideal es que estas dos NO devuelvan datos ni permitan escribir.
--     (Córrelas desde la app sin sesión, o con un cliente anon.)
--     select count(*) from public.lotes;         -> debería fallar o dar 0
--     insert into public.lotes (id) values('x');  -> debería fallar

-- ════════════════════════════════════════════════════════════════════
-- ── PARTE 2 · ENDURECIMIENTO (aplica tabla por tabla, revisando) ────────
-- Repite este bloque por cada tabla de negocio. Empieza por UNA, prueba la
-- app (login → leer/escribir), y si todo bien, sigue con la siguiente.
-- ════════════════════════════════════════════════════════════════════

-- Plantilla A · Tablas de la APP (los 3 usuarios leen y escriben todo):
--   crm_lotes, app_config, ofertas, solicitudes_asesor, captaciones
-- ----------------------------------------------------------------------
-- alter table public.crm_lotes enable row level security;
-- drop policy if exists app_auth_all on public.crm_lotes;
-- create policy app_auth_all on public.crm_lotes
--   for all to authenticated using (true) with check (true);

-- Plantilla B · Catálogos COMPARTIDOS (MacroPro solo LEE; la Landing escribe):
--   lotes, clientes, desarrollos, inventario_full, landing_clientes,
--   landing_criterios, cotizaciones, asesores, hubspot_deals_pendientes
-- ----------------------------------------------------------------------
-- alter table public.lotes enable row level security;
-- drop policy if exists shared_auth_read on public.lotes;
-- create policy shared_auth_read on public.lotes
--   for select to authenticated using (true);
--   -- (sin políticas de insert/update/delete para authenticated → MacroPro no escribe)

-- Plantilla C · Captación desde el FORMULARIO PÚBLICO (anon solo INSERT):
-- ----------------------------------------------------------------------
-- alter table public.captaciones enable row level security;
-- drop policy if exists capt_anon_insert on public.captaciones;
-- create policy capt_anon_insert on public.captaciones
--   for insert to anon with check (true);
-- drop policy if exists capt_auth_all on public.captaciones;
-- create policy capt_auth_all on public.captaciones
--   for all to authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
-- ── PARTE 3 · VERIFICACIÓN post-endurecimiento ──────────────────────────
-- Repite 1a/1b: ninguna tabla de negocio con rowsecurity=false sin razón.
-- Prueba la app logueado (debe leer/escribir lo suyo) y sin login (nada).
-- Documenta el resultado en el Anexo A (docs/ANEXOS_AUDITORIA.md).
-- ════════════════════════════════════════════════════════════════════
