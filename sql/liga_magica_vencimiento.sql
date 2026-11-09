-- ════════════════════════════════════════════════════════════════════
-- Liga Mágica · VENCIMIENTO (15 días) + REGENERAR
-- ────────────────────────────────────────────────────────────────────
-- Agrega caducidad al token del propietario y permite regenerarlo.
-- 100% ADITIVO. Correr UNA vez en Supabase → SQL Editor (después de
-- liga_magica_expediente.sql).
-- ════════════════════════════════════════════════════════════════════

-- 1) Columna de vencimiento. Nuevas ligas caducan a los 15 días.
alter table public.captaciones
  add column if not exists token_expira_at timestamptz default (now() + interval '15 days');
-- Backfill: a las filas existentes les damos 15 días frescos desde hoy (no tumbamos las vivas).
update public.captaciones set token_expira_at = now() + interval '15 days' where token_expira_at is null;

-- 2) legal_estado: ahora informa si la liga está EXPIRADA (sin romper: devuelve el flag).
create or replace function public.legal_estado(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_cap record; v json;
begin
  select id, zona, ciudad, estado, uso_suelo, superficie, pipeline,
         aprobada_publicar, publicada_lote_id, token_expira_at
    into v_cap
    from public.captaciones where liga_token = p_token limit 1;
  if v_cap.id is null then raise exception 'Token inválido'; end if;
  select json_build_object(
    'captacion', json_build_object(
      'id', v_cap.id, 'zona', v_cap.zona, 'ciudad', v_cap.ciudad, 'estado', v_cap.estado,
      'uso_suelo', v_cap.uso_suelo, 'superficie', v_cap.superficie,
      'pipeline', v_cap.pipeline, 'aprobada_publicar', v_cap.aprobada_publicar,
      'publicada_lote_id', v_cap.publicada_lote_id,
      'token_expira_at', v_cap.token_expira_at,
      'expirado', (v_cap.token_expira_at is not null and v_cap.token_expira_at < now())),
    'documentos', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'tipo_documento', l.tipo_documento, 'url', l.url,
        'estatus', l.estatus, 'created_at', l.created_at) order by l.created_at)
      from public.captaciones_legal l where l.captacion_id = v_cap.id), '[]'::json)
  ) into v;
  return v;
end $$;
grant execute on function public.legal_estado(uuid) to anon, authenticated;

-- 3) legal_subir_doc: RECHAZA la subida si la liga ya expiró (candado server-side real).
create or replace function public.legal_subir_doc(p_token uuid, p_tipo text, p_url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cap text; v_exp timestamptz; v_id uuid;
begin
  if p_token is null then raise exception 'Token requerido'; end if;
  select id, token_expira_at into v_cap, v_exp from public.captaciones where liga_token = p_token limit 1;
  if v_cap is null then raise exception 'Token inválido'; end if;
  if v_exp is not null and v_exp < now() then raise exception 'Liga expirada'; end if;
  insert into public.captaciones_legal (captacion_id, tipo_documento, url, estatus)
    values (v_cap, coalesce(p_tipo,'Documento'), p_url, 'pendiente')
    returning id into v_id;
  return v_id;
end $$;
grant execute on function public.legal_subir_doc(uuid, text, text) to anon, authenticated;

-- 4) legal_regenerar_liga: el EQUIPO (logueado) crea un token nuevo y extiende 15 días más.
--    Devuelve el nuevo token. Solo authenticated (la Landing/propietario NO lo puede llamar).
create or replace function public.legal_regenerar_liga(p_captacion_id text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if auth.role() <> 'authenticated' then raise exception 'Solo el equipo puede regenerar la liga'; end if;
  v_token := gen_random_uuid();
  update public.captaciones
     set liga_token = v_token,
         token_expira_at = now() + interval '15 days'
   where id = p_captacion_id;
  if not found then raise exception 'Captación no encontrada'; end if;
  return v_token;
end $$;
grant execute on function public.legal_regenerar_liga(text) to authenticated;

-- Verificación (opcional):
-- select id, liga_token, token_expira_at from public.captaciones limit 5;
