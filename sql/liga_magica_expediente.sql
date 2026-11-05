-- ════════════════════════════════════════════════════════════════════
-- FASE 2 · Liga Mágica + Expediente Legal
-- ────────────────────────────────────────────────────────────────────
-- Permite que el PROPIETARIO, con un link único (token), suba sus documentos
-- legales y vea el avance de su expediente, SIN login y SIN ver datos internos
-- (precios, comisiones). El equipo (logueado) aprueba/rechaza cada documento.
--
-- 100% ADITIVO. Correr UNA vez en Supabase → SQL Editor.
-- Nota de seguridad: el acceso público NO es por RLS "abierto"; es por RPCs
-- SECURITY DEFINER que validan el token (patrón correcto para token-gated).
-- ════════════════════════════════════════════════════════════════════

-- ── FASE A.1 · Token en captaciones ──
alter table public.captaciones add column if not exists liga_token uuid default gen_random_uuid();
-- Rellena las filas viejas que quedaron sin token:
update public.captaciones set liga_token = gen_random_uuid() where liga_token is null;
create unique index if not exists captaciones_liga_token_uniq on public.captaciones (liga_token);

-- ── FASE A.2 · Tabla de documentos legales ──
create table if not exists public.captaciones_legal (
  id             uuid primary key default gen_random_uuid(),
  captacion_id   text not null references public.captaciones(id) on delete cascade,
  tipo_documento text not null,                      -- 'INE', 'Escrituras', 'Predial', etc.
  url            text,                               -- URL del archivo en Storage
  estatus        text not null default 'pendiente',  -- pendiente | aprobado | rechazado
  created_at     timestamptz not null default now()
);
create index if not exists captaciones_legal_captacion_idx on public.captaciones_legal (captacion_id);

alter table public.captaciones_legal enable row level security;

-- Equipo logueado: acceso total (aprobar/rechazar desde MacroPro).
drop policy if exists captaciones_legal_auth_all on public.captaciones_legal;
create policy captaciones_legal_auth_all
  on public.captaciones_legal for all
  to authenticated using (true) with check (true);
-- El público (anon) NO toca la tabla directo: usa las RPC token-gated de abajo.

-- ── FASE A.3 · RPCs públicas validadas por token ──

-- (a) El propietario sube un documento (valida token → inserta 'pendiente').
create or replace function public.legal_subir_doc(p_token uuid, p_tipo text, p_url text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cap text; v_id uuid;
begin
  if p_token is null then raise exception 'Token requerido'; end if;
  select id into v_cap from public.captaciones where liga_token = p_token limit 1;
  if v_cap is null then raise exception 'Token inválido'; end if;
  insert into public.captaciones_legal (captacion_id, tipo_documento, url, estatus)
    values (v_cap, coalesce(p_tipo,'Documento'), p_url, 'pendiente')
    returning id into v_id;
  return v_id;
end $$;
grant execute on function public.legal_subir_doc(uuid, text, text) to anon, authenticated;

-- (b) El propietario ve el estado de su expediente (SIN precios ni comisiones).
create or replace function public.legal_estado(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_cap record; v json;
begin
  select id, zona, ciudad, estado, uso_suelo, superficie, pipeline,
         aprobada_publicar, publicada_lote_id
    into v_cap
    from public.captaciones where liga_token = p_token limit 1;
  if v_cap.id is null then raise exception 'Token inválido'; end if;
  select json_build_object(
    'captacion', json_build_object(
      'id', v_cap.id, 'zona', v_cap.zona, 'ciudad', v_cap.ciudad, 'estado', v_cap.estado,
      'uso_suelo', v_cap.uso_suelo, 'superficie', v_cap.superficie,
      'pipeline', v_cap.pipeline, 'aprobada_publicar', v_cap.aprobada_publicar,
      'publicada_lote_id', v_cap.publicada_lote_id),
    'documentos', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'tipo_documento', l.tipo_documento, 'url', l.url,
        'estatus', l.estatus, 'created_at', l.created_at) order by l.created_at)
      from public.captaciones_legal l where l.captacion_id = v_cap.id), '[]'::json)
  ) into v;
  return v;
end $$;
grant execute on function public.legal_estado(uuid) to anon, authenticated;

-- Verificación (opcional):
-- select liga_token from public.captaciones limit 3;
-- select * from public.captaciones_legal limit 5;
