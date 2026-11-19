-- ════════════════════════════════════════════════════════════════════════════
-- MEDIOS CENTRALIZADOS · FASE 1 (Dirección, 2026-11-19)
-- La captura de fotos, video, plano, KMZ y liga de Maps se hace desde el Back-Office
-- (MacroPro para Corretaje; Intelligence para Desarrollos, fase 2). La Landing solo LEE.
--
-- Decisión: los medios viven en las tablas de medios que la Landing YA lee
-- (landing_lote_meta por lote, landing_desarrollo_meta por desarrollo), no en lotes/desarrollos.
--
--   1) Bucket central PÚBLICO `media-terrenos` (50 MB por archivo, límite del plan Free).
--      La base guarda solo URLs públicas. Escribe solo un admin (landing_es_admin()).
--   2) Columnas: fotos_urls (text[]) · video_url · plano_url · kmz_url · maps_url ·
--      ficha_tecnica_url (PDF generado) + ficha_tecnica_at · media_actualizado_at/por.
--   3) Migración NO destructiva de lo que ya existe (solo llena lo vacío; no borra nada):
--      fotos (landing_presentaciones tipo 'foto'), plano (landing_fichas), video y Maps.
-- Idempotente: se puede correr varias veces.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Bucket central ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('media-terrenos', 'media-terrenos', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "media_terrenos_read" on storage.objects;
create policy "media_terrenos_read" on storage.objects for select
  using (bucket_id = 'media-terrenos');
drop policy if exists "media_terrenos_ins" on storage.objects;
create policy "media_terrenos_ins" on storage.objects for insert
  with check (bucket_id = 'media-terrenos' and landing_es_admin());
drop policy if exists "media_terrenos_upd" on storage.objects;
create policy "media_terrenos_upd" on storage.objects for update
  using (bucket_id = 'media-terrenos' and landing_es_admin());
drop policy if exists "media_terrenos_del" on storage.objects;
create policy "media_terrenos_del" on storage.objects for delete
  using (bucket_id = 'media-terrenos' and landing_es_admin());

-- ── 2) Columnas ──────────────────────────────────────────────────────────────
-- Por LOTE (corretaje y lotes de desarrollo). lote_id = id del lote en minúscula (loteKey).
alter table public.landing_lote_meta add column if not exists fotos_urls text[] not null default '{}';
alter table public.landing_lote_meta add column if not exists video_url text;
alter table public.landing_lote_meta add column if not exists plano_url text;
alter table public.landing_lote_meta add column if not exists kmz_url text;
alter table public.landing_lote_meta add column if not exists maps_url text;
alter table public.landing_lote_meta add column if not exists ficha_tecnica_url text;
alter table public.landing_lote_meta add column if not exists ficha_tecnica_at timestamptz;
alter table public.landing_lote_meta add column if not exists media_actualizado_at timestamptz;
alter table public.landing_lote_meta add column if not exists media_actualizado_por text;

-- Por DESARROLLO (se llenará desde Intelligence en la fase 2; los lotes heredan portada y datos).
alter table public.landing_desarrollo_meta add column if not exists fotos_urls text[] not null default '{}';
alter table public.landing_desarrollo_meta add column if not exists video_url text;
alter table public.landing_desarrollo_meta add column if not exists plano_url text;
alter table public.landing_desarrollo_meta add column if not exists kmz_url text;
alter table public.landing_desarrollo_meta add column if not exists maps_url text;
alter table public.landing_desarrollo_meta add column if not exists ficha_tecnica_url text;
alter table public.landing_desarrollo_meta add column if not exists ficha_tecnica_at timestamptz;
alter table public.landing_desarrollo_meta add column if not exists media_actualizado_at timestamptz;
alter table public.landing_desarrollo_meta add column if not exists media_actualizado_por text;

-- URL pública a partir de una ruta guardada en un bucket (o la deja igual si ya es URL).
create or replace function public._media_url_publica(p_bucket text, p_path text) returns text
language sql immutable as $$
  select case
    when p_path is null or btrim(p_path) = '' then null
    when p_path ~* '^https?://' then p_path
    else 'https://xugrrabebphdelgwqnwc.supabase.co/storage/v1/object/public/' || p_bucket || '/' || ltrim(p_path, '/')
  end;
$$;

-- ── 3) Migración NO destructiva (solo llena lo que está vacío) ───────────────
-- 3a) Fotos de cada LOTE (galería de la Landing: landing_presentaciones tipo 'foto', slug = id del lote).
insert into public.landing_lote_meta (lote_id, fotos_urls)
select p.desarrollo_slug, array_agg(public._media_url_publica('planos', p.url) order by p.orden nulls last, p.created_at, p.id)
  from public.landing_presentaciones p
 where p.tipo = 'foto' and exists (select 1 from public.lotes l where l.id = p.desarrollo_slug)
 group by p.desarrollo_slug
on conflict (lote_id) do update set fotos_urls = excluded.fotos_urls
 where coalesce(array_length(public.landing_lote_meta.fotos_urls, 1), 0) = 0;

-- 3b) Plano de cada LOTE (hoy en landing_fichas, bucket 'fichas').
insert into public.landing_lote_meta (lote_id, plano_url)
select f.lote_id, public._media_url_publica('fichas', f.url)
  from public.landing_fichas f
 where nullif(btrim(f.url), '') is not null
on conflict (lote_id) do update set plano_url = excluded.plano_url
 where public.landing_lote_meta.plano_url is null;

-- 3c) Liga de Google Maps de cada LOTE (hoy en lotes.maps_url o metadata 'Link Google Maps').
insert into public.landing_lote_meta (lote_id, maps_url)
select l.id, coalesce(nullif(btrim(l.maps_url), ''), nullif(btrim(l.metadata ->> 'Link Google Maps'), ''))
  from public.lotes l
 where l.dado_baja_at is null
   and coalesce(nullif(btrim(l.maps_url), ''), nullif(btrim(l.metadata ->> 'Link Google Maps'), '')) ~* '^https?://'
on conflict (lote_id) do update set maps_url = excluded.maps_url
 where public.landing_lote_meta.maps_url is null;

-- 3d) DESARROLLOS: fotos (slug que no es un lote), primer video y Maps (de ubicacion_url).
insert into public.landing_desarrollo_meta (desarrollo_slug, fotos_urls)
select p.desarrollo_slug, array_agg(public._media_url_publica('planos', p.url) order by p.orden nulls last, p.created_at, p.id)
  from public.landing_presentaciones p
 where p.tipo = 'foto' and not exists (select 1 from public.lotes l where l.id = p.desarrollo_slug)
 group by p.desarrollo_slug
on conflict (desarrollo_slug) do update set fotos_urls = excluded.fotos_urls
 where coalesce(array_length(public.landing_desarrollo_meta.fotos_urls, 1), 0) = 0;

update public.landing_desarrollo_meta m
   set video_url = v.url
  from (select distinct on (desarrollo_slug) desarrollo_slug, public._media_url_publica('presentaciones', url) as url
          from public.landing_presentaciones where tipo = 'video'
         order by desarrollo_slug, orden nulls last, created_at, id) v
 where v.desarrollo_slug = m.desarrollo_slug and m.video_url is null;

update public.landing_desarrollo_meta
   set maps_url = ubicacion_url
 where maps_url is null and ubicacion_url ~* '^https?://';

-- ── Verificación ────────────────────────────────────────────────────────────
select 'bucket media-terrenos' as que, count(*)::text as valor from storage.buckets where id = 'media-terrenos'
union all select 'lotes con fotos', count(*)::text from public.landing_lote_meta where coalesce(array_length(fotos_urls, 1), 0) > 0
union all select 'lotes con plano', count(*)::text from public.landing_lote_meta where plano_url is not null
union all select 'lotes con Maps', count(*)::text from public.landing_lote_meta where maps_url is not null
union all select 'lotes con video', count(*)::text from public.landing_lote_meta where video_url is not null
union all select 'desarrollos con fotos', count(*)::text from public.landing_desarrollo_meta where coalesce(array_length(fotos_urls, 1), 0) > 0
union all select 'desarrollos con Maps', count(*)::text from public.landing_desarrollo_meta where maps_url is not null;
