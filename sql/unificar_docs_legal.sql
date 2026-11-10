-- ════════════════════════════════════════════════════════════════════
-- UNIFICAR DOCUMENTOS · una sola fuente por ID de captación
-- ────────────────────────────────────────────────────────────────────
-- Antes: el opcionador (/aceptar) escribía en captaciones.documentos_urls, pero la
-- LIGA MÁGICA (captar.html) escribía en la tabla aparte captaciones_legal.
-- Ahora: TODO vive en captaciones.documentos_urls, amarrado al ID de la captación.
-- Los documentos legales se marcan con origen='legal' y conservan su estatus
-- (pendiente | aprobado | rechazado) para el flujo de aprobación y el gate de publicar.
--
-- No borra captaciones_legal (queda como respaldo). Idempotente: correr las veces que
-- haga falta. Requiere liga_magica_expediente.sql + liga_magica_vencimiento.sql.
-- Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) MIGRACIÓN · captaciones_legal → documentos_urls (sin perder historial) ──
-- Agrega a cada captación sus documentos legales que aún NO estén en documentos_urls
-- (dedupe por url). Conserva estatus y fecha.
update public.captaciones k
set documentos_urls = coalesce(k.documentos_urls, '[]'::jsonb) || sub.nuevos
from (
  select l.captacion_id,
         jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'tipo',       l.tipo_documento,
           'nombre',     l.tipo_documento,
           'url',        l.url,
           'bucket',     'captaciones-docs',
           'fecha',      l.created_at,
           'subido_por', 'propietario',
           'estatus',    coalesce(l.estatus, 'pendiente'),
           'origen',     'legal'))) as nuevos
    from public.captaciones_legal l
    join public.captaciones k2 on k2.id = l.captacion_id
   where l.url is not null
     and not exists (
       select 1 from jsonb_array_elements(coalesce(k2.documentos_urls, '[]'::jsonb)) e
       where coalesce(e->>'url', e->>'path') = l.url)
   group by l.captacion_id
) sub
where k.id = sub.captacion_id;

-- ── 2) LIGA MÁGICA sube a documentos_urls (ya no a captaciones_legal) ──
-- Mantiene el candado de vencimiento. Devuelve null (captar.html no usa el valor).
create or replace function public.legal_subir_doc(p_token uuid, p_tipo text, p_url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cap text; v_exp timestamptz;
begin
  if p_token is null then raise exception 'Token requerido'; end if;
  select id, token_expira_at into v_cap, v_exp from public.captaciones where liga_token = p_token limit 1;
  if v_cap is null then raise exception 'Token inválido'; end if;
  if v_exp is not null and v_exp < now() then raise exception 'Liga expirada'; end if;
  update public.captaciones
     set documentos_urls = coalesce(documentos_urls, '[]'::jsonb) || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
           'tipo', coalesce(p_tipo, 'Documento'), 'nombre', coalesce(p_tipo, 'Documento'),
           'url', p_url, 'bucket', 'captaciones-docs', 'fecha', now(),
           'subido_por', 'propietario', 'estatus', 'pendiente', 'origen', 'legal'))),
         fecha_ultima_actividad = now(), updated_at = now()
   where id = v_cap;
  return null::uuid;
end $$;
grant execute on function public.legal_subir_doc(uuid, text, text) to anon, authenticated;

-- ── 3) legal_estado lee los documentos legales DE documentos_urls ──
-- Mismos nombres de campos que espera captar.html (id, tipo_documento, url, estatus, created_at).
create or replace function public.legal_estado(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_cap record; v json;
begin
  select id, zona, ciudad, estado, uso_suelo, superficie, pipeline,
         aprobada_publicar, publicada_lote_id, token_expira_at, documentos_urls
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
        'id', e->>'url', 'tipo_documento', e->>'tipo', 'url', e->>'url',
        'estatus', coalesce(e->>'estatus', 'pendiente'),
        'created_at', nullif(e->>'fecha', '')::timestamptz) order by e->>'fecha')
      from jsonb_array_elements(coalesce(v_cap.documentos_urls, '[]'::jsonb)) e
      where e->>'origen' = 'legal'), '[]'::json)
  ) into v;
  return v;
end $$;
grant execute on function public.legal_estado(uuid) to anon, authenticated;

-- ── 4) El equipo aprueba/rechaza un documento (por url) dentro de documentos_urls ──
create or replace function public.captacion_doc_estatus(p_cap text, p_llave text, p_estatus text)
returns jsonb
language sql set search_path = public as $$
  update public.captaciones
     set documentos_urls = coalesce((
           select jsonb_agg(
             case when coalesce(e->>'url', e->>'path') = p_llave
                  then e || jsonb_build_object('estatus', p_estatus)
                  else e end)
           from jsonb_array_elements(coalesce(documentos_urls, '[]'::jsonb)) e), '[]'::jsonb),
         updated_at = now()
   where id = p_cap
  returning documentos_urls;
$$;
revoke execute on function public.captacion_doc_estatus(text, text, text) from public, anon;
grant  execute on function public.captacion_doc_estatus(text, text, text) to authenticated;

-- ── VERIFICACIÓN ──
select 'docs legales en captaciones_legal' as que, count(*)::text as valor from public.captaciones_legal
union all
select 'docs legales ya en documentos_urls',
       count(*)::text
  from public.captaciones k, jsonb_array_elements(coalesce(k.documentos_urls,'[]'::jsonb)) e
 where e->>'origen' = 'legal';
