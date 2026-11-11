-- ════════════════════════════════════════════════════════════════════
-- REQUERIMIENTOS v2 · compradores + contacto del asesor + match en Captación
-- ────────────────────────────────────────────────────────────────────
-- Requiere haber corrido antes: sql/requerimientos_busquedas_fallidas.sql
--   1) macropro_busquedas_fallidas(): ahora trae también el CELULAR del asesor.
--   2) macropro_criterios_landing(): las búsquedas de clientes del CRM del landing
--      (landing_criterios) con asesor, celular y cliente. La usa la alerta de
--      "match automático" al capturar un terreno nuevo.
--   3) macropro_req_estatus: estatus (pendiente / en búsqueda / resuelto) de los
--      requerimientos de COMPRADORES (tabla aparte: no toca la sincronización de clientes).
--
-- SEGURIDAD: todo responde SOLO a admins (landing_es_admin). Los asesores del landing
-- comparten este Supabase y por RLS solo deben ver lo suyo.
-- Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- 1) Búsquedas fallidas + celular del asesor (cambia el tipo de retorno → se re-crea).
drop function if exists public.macropro_busquedas_fallidas();
create function public.macropro_busquedas_fallidas()
returns table(
  id uuid, fecha timestamptz, asesor_id uuid, asesor_nombre text, asesor_email text,
  asesor_celular text, cliente_nombre text, resumen jsonb, estatus text,
  estatus_at timestamptz, estatus_por text, criterio_id uuid
)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  return query
    select bf.id, bf.fecha, bf.asesor_id,
           coalesce(nullif(btrim(c.nombre), ''), u.raw_user_meta_data->>'nombre', u.email)::text,
           lower(u.email)::text,
           nullif(btrim(c.celular), '')::text,
           coalesce(nullif(btrim(bf.resumen->>'cliente'), ''),
                    nullif(btrim(cl.nombre_contacto), ''),
                    nullif(btrim(cl.empresa), ''),
                    nullif(btrim(bf.resumen->>'nombre_busqueda'), ''))::text,
           bf.resumen, bf.estatus, bf.estatus_at, bf.estatus_por, bf.criterio_id
      from public.landing_busquedas_fallidas bf
      left join auth.users u                   on u.id  = bf.asesor_id
      left join public.landing_colaboradores c on c.id  = bf.asesor_id
      left join public.landing_criterios cr    on cr.id = bf.criterio_id
      left join public.landing_clientes cl     on cl.id = cr.cliente_id
     order by bf.fecha desc;
end $$;
revoke execute on function public.macropro_busquedas_fallidas() from public, anon;
grant  execute on function public.macropro_busquedas_fallidas() to authenticated;

-- 2) Búsquedas de clientes del landing (landing_criterios) para el match automático.
create or replace function public.macropro_criterios_landing()
returns table(
  id uuid, fecha timestamptz, asesor_id uuid, asesor_nombre text, asesor_email text,
  asesor_celular text, cliente_nombre text, resumen jsonb
)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  return query
    select cr.id, cr.fecha_alta, cr.asesor_id,
           coalesce(nullif(btrim(c.nombre), ''), u.raw_user_meta_data->>'nombre', u.email)::text,
           lower(u.email)::text,
           nullif(btrim(c.celular), '')::text,
           coalesce(nullif(btrim(cl.nombre_contacto), ''), nullif(btrim(cl.empresa), ''), nullif(btrim(cr.nombre_busqueda), ''))::text,
           jsonb_build_object(
             'usos_primarios', coalesce(cr.usos_primarios, '[]'::jsonb),
             'ciudades',       to_jsonb(coalesce(cr.ciudades, '{}'::text[])),
             'nombre_busqueda', cr.nombre_busqueda,
             'origen',         'landing')
      from public.landing_criterios cr
      left join auth.users u                   on u.id  = cr.asesor_id
      left join public.landing_colaboradores c on c.id  = cr.asesor_id
      left join public.landing_clientes cl     on cl.id = cr.cliente_id
     order by cr.fecha_alta desc;
end $$;
revoke execute on function public.macropro_criterios_landing() from public, anon;
grant  execute on function public.macropro_criterios_landing() to authenticated;

-- 3) Estatus de requerimientos de COMPRADORES (clientes de MacroPro).
create table if not exists public.macropro_req_estatus (
  fuente      text not null,          -- 'comprador'
  ref_id      text not null,          -- clientes.id_cliente
  estatus     text not null default 'pendiente' check (estatus in ('pendiente','en_busqueda','resuelto')),
  estatus_at  timestamptz not null default now(),
  estatus_por text,
  primary key (fuente, ref_id)
);
alter table public.macropro_req_estatus enable row level security;
drop policy if exists macropro_req_estatus_admin on public.macropro_req_estatus;
create policy macropro_req_estatus_admin on public.macropro_req_estatus
  for all to authenticated using (landing_es_admin()) with check (landing_es_admin());
grant select, insert, update on public.macropro_req_estatus to authenticated;

-- ── VERIFICACIÓN ──
select 'busquedas_fallidas' as fuente, count(*) from public.landing_busquedas_fallidas
union all select 'criterios_landing', count(*) from public.landing_criterios
union all select 'estatus_compradores', count(*) from public.macropro_req_estatus;
