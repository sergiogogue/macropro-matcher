-- ════════════════════════════════════════════════════════════════════
-- REQUERIMIENTOS v3 · borrar búsquedas SIN MATCH de prueba
-- ────────────────────────────────────────────────────────────────────
-- Requiere: sql/requerimientos_busquedas_fallidas.sql (ya corrido).
-- macropro_busquedas_borrar(ids): borra DEFINITIVAMENTE las búsquedas fallidas
-- seleccionadas en 🔍 Requerimientos → 🚫 Sin match → 🗑 Borrar.
-- (Los COMPRADORES no necesitan SQL: se dan de baja con activo=false, igual que
--  el botón Eliminar cliente de MacroPro.)
--
-- SEGURIDAD: solo admins (landing_es_admin). Idempotente.
-- Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.macropro_busquedas_borrar(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  delete from public.landing_busquedas_fallidas where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.macropro_busquedas_borrar(uuid[]) from public, anon;
grant  execute on function public.macropro_busquedas_borrar(uuid[]) to authenticated;

-- ── VERIFICACIÓN (debe salir 1 fila: macropro_busquedas_borrar) ──
select proname from pg_proc where proname = 'macropro_busquedas_borrar';
