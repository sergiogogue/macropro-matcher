-- ════════════════════════════════════════════════════════════════════
-- REQUERIMIENTOS · búsquedas fallidas (vista "🔍 Requerimientos" de MacroPro)
-- ────────────────────────────────────────────────────────────────────
-- El bot de WhatsApp y el buscador del landing guardan en landing_busquedas_fallidas
-- los terrenos que pidieron los asesores y no teníamos. Esto agrega:
--   1) estatus (pendiente | en_busqueda | resuelto) + quién/cuándo lo cambió.
--   2) macropro_busquedas_fallidas(): listado con nombre del asesor y del cliente.
--   3) macropro_busqueda_estatus(id, estatus): cambia el estatus.
--
-- SEGURIDAD: los asesores del landing entran al MISMO Supabase y por RLS solo ven
-- SUS búsquedas. Las dos funciones responden únicamente a ADMINS
-- (landing_es_admin), así ningún asesor ve los clientes de otros.
--
-- 100% aditivo e idempotente: se puede correr las veces que haga falta.
-- Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- 1) Estatus del requerimiento (default 'pendiente' para todo lo que ya existe).
alter table public.landing_busquedas_fallidas
  add column if not exists estatus     text not null default 'pendiente',
  add column if not exists estatus_at  timestamptz,
  add column if not exists estatus_por text;

do $$ begin
  alter table public.landing_busquedas_fallidas
    add constraint lbf_estatus_chk check (estatus in ('pendiente','en_busqueda','resuelto'));
exception when duplicate_object then null; end $$;

create index if not exists idx_lbf_estatus on public.landing_busquedas_fallidas (estatus);

-- 2) Listado para MacroPro: requerimiento + nombre del asesor + nombre del cliente.
--    (Bot de WhatsApp: el cliente viene en resumen.cliente. Buscador web: viene del
--     cliente ligado al criterio.)
create or replace function public.macropro_busquedas_fallidas()
returns table(
  id uuid, fecha timestamptz, asesor_id uuid, asesor_nombre text, asesor_email text,
  cliente_nombre text, resumen jsonb, estatus text, estatus_at timestamptz,
  estatus_por text, criterio_id uuid
)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  return query
    select bf.id, bf.fecha, bf.asesor_id,
           coalesce(nullif(btrim(c.nombre), ''), u.raw_user_meta_data->>'nombre', u.email)::text,
           lower(u.email)::text,
           coalesce(nullif(btrim(bf.resumen->>'cliente'), ''),
                    nullif(btrim(cl.nombre_contacto), ''),
                    nullif(btrim(cl.empresa), ''),
                    nullif(btrim(bf.resumen->>'nombre_busqueda'), ''))::text,
           bf.resumen, bf.estatus, bf.estatus_at, bf.estatus_por, bf.criterio_id
      from public.landing_busquedas_fallidas bf
      left join auth.users u               on u.id  = bf.asesor_id
      left join public.landing_colaboradores c on c.id  = bf.asesor_id
      left join public.landing_criterios cr  on cr.id = bf.criterio_id
      left join public.landing_clientes cl   on cl.id = cr.cliente_id
     order by bf.fecha desc;
end $$;
revoke execute on function public.macropro_busquedas_fallidas() from public, anon;
grant  execute on function public.macropro_busquedas_fallidas() to authenticated;

-- 3) Cambiar estatus (Marcar como resuelto / En búsqueda / Pendiente).
create or replace function public.macropro_busqueda_estatus(p_id uuid, p_estatus text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  if p_estatus not in ('pendiente','en_busqueda','resuelto') then raise exception 'estatus inválido'; end if;
  update public.landing_busquedas_fallidas
     set estatus = p_estatus, estatus_at = now(), estatus_por = lower(auth.jwt() ->> 'email')
   where id = p_id;
  if not found then raise exception 'requerimiento no encontrado'; end if;
end $$;
revoke execute on function public.macropro_busqueda_estatus(uuid, text) from public, anon;
grant  execute on function public.macropro_busqueda_estatus(uuid, text) to authenticated;

-- ── VERIFICACIÓN (debe salir una fila por estatus) ──
select estatus, count(*) as requerimientos
  from public.landing_busquedas_fallidas
 group by estatus order by estatus;
