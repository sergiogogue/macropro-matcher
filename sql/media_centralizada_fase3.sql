-- ════════════════════════════════════════════════════════════════════════════
-- MEDIOS CENTRALIZADOS · FASE 3 (Dirección, 2026-11-19)
-- Los DOCUMENTOS de publicación también se capturan en el Back-Office (MacroPro / Intelligence):
--   lote       → presentacion_url (PDF)            [uso_suelo_url y poligono ya existen]
--   desarrollo → presentacion_url · reglamento_url · presentaciones_uso (jsonb {uso: url})
--                [poligono y ubicacion_lat/lng ya existen]
-- Migración NO destructiva de lo que hoy vive en landing_presentaciones (solo llena lo vacío).
-- Requiere media_centralizada_fase1.sql (función _media_url_publica). Idempotente.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.landing_lote_meta add column if not exists presentacion_url text;
alter table public.landing_desarrollo_meta add column if not exists presentacion_url text;
alter table public.landing_desarrollo_meta add column if not exists reglamento_url text;
alter table public.landing_desarrollo_meta add column if not exists presentaciones_uso jsonb not null default '{}'::jsonb;

-- Presentación general de cada LOTE (landing_presentaciones tipo 'general' con slug = id del lote).
insert into public.landing_lote_meta (lote_id, presentacion_url)
select distinct on (p.desarrollo_slug) p.desarrollo_slug, public._media_url_publica('presentaciones', p.url)
  from public.landing_presentaciones p
 where p.tipo = 'general' and exists (select 1 from public.lotes l where l.id = p.desarrollo_slug)
 order by p.desarrollo_slug, p.created_at desc, p.id desc
on conflict (lote_id) do update set presentacion_url = excluded.presentacion_url
 where public.landing_lote_meta.presentacion_url is null;

-- Presentación general y reglamento de cada DESARROLLO.
insert into public.landing_desarrollo_meta (desarrollo_slug, presentacion_url)
select distinct on (p.desarrollo_slug) p.desarrollo_slug, public._media_url_publica('presentaciones', p.url)
  from public.landing_presentaciones p
 where p.tipo = 'general' and not exists (select 1 from public.lotes l where l.id = p.desarrollo_slug)
 order by p.desarrollo_slug, p.created_at desc, p.id desc
on conflict (desarrollo_slug) do update set presentacion_url = excluded.presentacion_url
 where public.landing_desarrollo_meta.presentacion_url is null;

insert into public.landing_desarrollo_meta (desarrollo_slug, reglamento_url)
select distinct on (p.desarrollo_slug) p.desarrollo_slug, public._media_url_publica('presentaciones', p.url)
  from public.landing_presentaciones p
 where p.tipo = 'reglamento'
 order by p.desarrollo_slug, p.created_at desc, p.id desc
on conflict (desarrollo_slug) do update set reglamento_url = excluded.reglamento_url
 where public.landing_desarrollo_meta.reglamento_url is null;

-- Presentaciones POR USO de suelo de cada desarrollo ({ "Habitacional": "https://…pdf", … }).
insert into public.landing_desarrollo_meta (desarrollo_slug, presentaciones_uso)
select x.desarrollo_slug, jsonb_object_agg(x.uso, x.url)
  from (select distinct on (p.desarrollo_slug, p.uso) p.desarrollo_slug, p.uso, public._media_url_publica('presentaciones', p.url) as url
          from public.landing_presentaciones p
         where p.tipo = 'uso' and nullif(btrim(p.uso), '') is not null
         order by p.desarrollo_slug, p.uso, p.created_at desc, p.id desc) x
 group by x.desarrollo_slug
on conflict (desarrollo_slug) do update set presentaciones_uso = excluded.presentaciones_uso
 where public.landing_desarrollo_meta.presentaciones_uso = '{}'::jsonb;

-- Verificación
select 'lotes con presentación' as que, count(*)::text as valor from public.landing_lote_meta where presentacion_url is not null
union all select 'lotes con uso de suelo', count(*)::text from public.landing_lote_meta where uso_suelo_url is not null
union all select 'lotes con polígono', count(*)::text from public.landing_lote_meta where poligono is not null
union all select 'desarrollos con presentación', count(*)::text from public.landing_desarrollo_meta where presentacion_url is not null
union all select 'desarrollos con reglamento', count(*)::text from public.landing_desarrollo_meta where reglamento_url is not null
union all select 'desarrollos con presentaciones por uso', count(*)::text from public.landing_desarrollo_meta where presentaciones_uso <> '{}'::jsonb;
