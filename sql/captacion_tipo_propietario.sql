-- ════════════════════════════════════════════════════════════════════════════
-- Tipo de PROPIETARIO del terreno (Dirección, 2026-11-19) · MacroPro + Landing
--   El propietario puede ser: persona física · persona moral (empresa) · copropiedad
--   (varios dueños, con % que suman 100). Según el tipo cambian los documentos para el
--   contrato:
--     física       → INE del propietario
--     moral        → Acta constitutiva · Poder del representante legal · INE del representante legal
--     copropiedad  → INE de cada copropietario · Acta de matrimonio
--   (más, en todos: Escrituras · Libertad de gravamen · Predial)
-- Cambios:
--   1) captaciones.tipo_persona y captaciones.copropietarios.
--   2) legal_persona_set(token, tipo, copropietarios): lo usa el propietario desde su liga
--      (/expediente/<token>). Valida la copropiedad (≥ 2, nombre, % que suman 100).
--   3) legal_estado: devuelve también tipo_persona y copropietarios.
-- Requiere haber corrido docs_viabilidad_complementarios.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.captaciones add column if not exists tipo_persona text not null default 'fisica';
alter table public.captaciones add column if not exists copropietarios jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.captaciones add constraint captaciones_tipo_persona_chk check (tipo_persona in ('fisica', 'moral', 'copropiedad'));
exception when duplicate_object then null; end $$;

-- ¿Copropietarios bien capturados? (≥ 2, todos con nombre de 3+ letras y % que suman 100)
create or replace function public._cap_copro_ok(p jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) >= 2
     and not exists (select 1 from jsonb_array_elements(p) e where length(btrim(coalesce(e->>'nombre', ''))) < 3
                        or coalesce(nullif(regexp_replace(coalesce(e->>'pct', ''), '[^0-9.]', '', 'g'), ''), '0')::numeric <= 0)
     and abs((select sum(coalesce(nullif(regexp_replace(coalesce(e->>'pct', ''), '[^0-9.]', '', 'g'), ''), '0')::numeric)
                from jsonb_array_elements(p) e) - 100) < 0.01;
$$;

create or replace function public.legal_persona_set(p_token uuid, p_persona text, p_copropietarios jsonb default null)
returns json
language plpgsql security definer set search_path = public as $$
declare v_cap text; v_exp timestamptz; v_lista jsonb;
begin
  if p_token is null then raise exception 'Token requerido'; end if;
  select id, token_expira_at into v_cap, v_exp from public.captaciones where liga_token = p_token limit 1;
  if v_cap is null then raise exception 'Token inválido'; end if;
  if v_exp is not null and v_exp < now() then raise exception 'Liga expirada'; end if;
  if p_persona not in ('fisica', 'moral', 'copropiedad') then raise exception 'Tipo de propietario no válido'; end if;
  if p_copropietarios is not null then
    -- Solo nombre y % (limpios); nada más se guarda.
    select coalesce(jsonb_agg(jsonb_build_object('nombre', left(btrim(coalesce(e->>'nombre', '')), 120),
                                                 'pct', coalesce(nullif(regexp_replace(coalesce(e->>'pct', ''), '[^0-9.]', '', 'g'), ''), '0')::numeric)), '[]'::jsonb)
      into v_lista from jsonb_array_elements(case when jsonb_typeof(p_copropietarios) = 'array' then p_copropietarios else '[]'::jsonb end) e;
    if p_persona = 'copropiedad' and not public._cap_copro_ok(v_lista) then
      raise exception 'Revisa los copropietarios: mínimo 2, cada uno con nombre y los porcentajes deben sumar 100%%';
    end if;
  end if;
  update public.captaciones
     set tipo_persona = p_persona,
         copropietarios = coalesce(v_lista, copropietarios),
         fecha_ultima_actividad = now(), updated_at = now()
   where id = v_cap;
  return public.legal_estado(p_token);
end $$;
grant execute on function public.legal_persona_set(uuid, text, jsonb) to anon, authenticated;

create or replace function public.legal_estado(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_cap record; v json;
begin
  select id, zona, ciudad, estado, uso_suelo, superficie, pipeline,
         aprobada_publicar, publicada_lote_id, token_expira_at, documentos_urls,
         propietario, contacto,
         tipo_persona, copropietarios
    into v_cap
    from public.captaciones where liga_token = p_token limit 1;
  if v_cap.id is null then raise exception 'Token inválido'; end if;
  select json_build_object(
    'captacion', json_build_object(
      'id', v_cap.id, 'zona', v_cap.zona, 'ciudad', v_cap.ciudad, 'estado', v_cap.estado,
      'uso_suelo', v_cap.uso_suelo, 'superficie', v_cap.superficie,
      'propietario', v_cap.propietario, 'contacto', v_cap.contacto,
      'pipeline', v_cap.pipeline, 'aprobada_publicar', v_cap.aprobada_publicar,
      'publicada_lote_id', v_cap.publicada_lote_id,
      'token_expira_at', v_cap.token_expira_at,
      'expirado', (v_cap.token_expira_at is not null and v_cap.token_expira_at < now()),
      'tipo_persona', coalesce(v_cap.tipo_persona, 'fisica'),
      'copropietarios', coalesce(v_cap.copropietarios, '[]'::jsonb)),
    'documentos', coalesce((
      select json_agg(json_build_object(
        -- Los que NO subió el propietario por esta liga se muestran como "subido" sin exponer su archivo.
        'id', case when e->>'origen' = 'legal' then e->>'url' end, 'tipo_documento', e->>'tipo',
        'url', case when e->>'origen' = 'legal' then e->>'url' end,
        'estatus', coalesce(e->>'estatus', 'pendiente'),
        'created_at', nullif(e->>'fecha', '')::timestamptz) order by e->>'fecha')
      from jsonb_array_elements(coalesce(v_cap.documentos_urls, '[]'::jsonb)) e
      where e->>'origen' = 'legal' or nullif(btrim(coalesce(e->>'tipo', '')), '') is not null), '[]'::json)
  ) into v;
  return v;
end $$;
grant execute on function public.legal_estado(uuid) to anon, authenticated;

-- Verificación
select count(*) filter (where tipo_persona = 'fisica') as fisica,
       count(*) filter (where tipo_persona = 'moral') as moral,
       count(*) filter (where tipo_persona = 'copropiedad') as copropiedad,
       (select count(*) from pg_proc where proname = 'legal_persona_set') as rpc_persona
  from public.captaciones;
