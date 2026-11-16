-- ═══════════════════════════════════════════════════════════════════════════
-- MacroPro · Rendimiento Fase 2 (2026-11-16)
-- 1) DIAGNÓSTICO: corre la PRIMERA consulta sola y pásale el resultado a Claude.
--    Dice cuántas filas y cuánto pesa cada tabla (con eso se decide si conviene
--    paginar o recortar columnas en la sincronización de cada 45 s).
-- 2) ÍNDICES: el resto del archivo. Es idempotente (se puede correr varias veces)
--    y cada índice solo se crea si la tabla y la columna existen.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) DIAGNÓSTICO ─────────────────────────────────────────────────────────────
select relname                                        as tabla,
       n_live_tup                                     as filas,
       pg_size_pretty(pg_total_relation_size(relid))  as tamano_total
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('clientes','captaciones','ofertas','solicitudes_asesor','crm_lotes','lotes',
                  'cartas_oferta','cartas_oferta_rondas','cotizaciones_opcionador','documentos_opcionador',
                  'asesores','desarrollos','hubspot_deals_pendientes','landing_clientes','landing_criterios')
order by pg_total_relation_size(relid) desc;

-- 2) ÍNDICES ──────────────────────────────────────────────────────────────────
-- Búsquedas parciales de teléfono/correo (ilike '%…%') al guardar un cliente.
create extension if not exists pg_trgm;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- tabla,                      columna,          nombre del índice,                    sql del índice
      ('documentos_opcionador',  'tipo_documento','idx_docopc_cot_tipo',    'create index if not exists idx_docopc_cot_tipo on public.documentos_opcionador (cotizacion_id, tipo_documento)'),
      ('documentos_opcionador',  'cotizacion_id', 'idx_docopc_cotizacion',  'create index if not exists idx_docopc_cotizacion on public.documentos_opcionador (cotizacion_id)'),
      ('cotizaciones_opcionador','created_at',    'idx_cotopc_created',     'create index if not exists idx_cotopc_created on public.cotizaciones_opcionador (created_at desc)'),
      ('clientes',               'id_cliente',    'idx_clientes_id_cliente','create index if not exists idx_clientes_id_cliente on public.clientes (id_cliente)'),
      ('clientes',               'email',         'idx_clientes_email_trgm','create index if not exists idx_clientes_email_trgm on public.clientes using gin (email gin_trgm_ops)'),
      ('clientes',               'telefono',      'idx_clientes_tel_trgm',  'create index if not exists idx_clientes_tel_trgm on public.clientes using gin (telefono gin_trgm_ops)'),
      ('macropro_req_estatus',   'fuente',        'idx_mpreq_fuente',       'create index if not exists idx_mpreq_fuente on public.macropro_req_estatus (fuente)'),
      ('landing_criterios',      'cliente_id',    'idx_lcrit_cliente',      'create index if not exists idx_lcrit_cliente on public.landing_criterios (cliente_id)'),
      ('app_config',             'clave',         'idx_app_config_clave',   'create index if not exists idx_app_config_clave on public.app_config (clave)')
    ) as t(tabla, columna, indice, ddl)
  loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = r.tabla and column_name = r.columna) then
      -- un índice normal no hace falta si ya existe otro (o la llave primaria) que empiece por esa columna
      if r.ddl not like '%gin_trgm_ops%' and r.columna <> 'tipo_documento' and exists (
           select 1 from pg_index i
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
           join pg_class ic on ic.oid = i.indexrelid
           where i.indrelid = ('public.' || r.tabla)::regclass and a.attname = r.columna and ic.relname <> r.indice) then
        raise notice 'YA EXISTE un índice sobre %.% (no se crea %)', r.tabla, r.columna, r.indice;
      else
        execute r.ddl;
        raise notice 'OK  %', r.indice;
      end if;
    else
      raise notice 'SALTADO % (no existe %.%)', r.indice, r.tabla, r.columna;
    end if;
  end loop;
end $$;

-- Verificación: índices de esas tablas
select tablename as tabla, indexname as indice
from pg_indexes
where schemaname = 'public'
  and tablename in ('documentos_opcionador','cotizaciones_opcionador','clientes','macropro_req_estatus','landing_criterios','app_config')
order by tablename, indexname;

-- 3) LIMPIEZA ─────────────────────────────────────────────────────────────────
-- Borra un índice creado por la Fase 2 SOLO si existe otro con exactamente las mismas columnas.
do $$
declare
  r record;
  gemelo text;
begin
  for r in select unnest(array['idx_docopc_cot_tipo','idx_clientes_id_cliente','idx_cotopc_created',
                               'idx_clientes_email_trgm','idx_clientes_tel_trgm']) as idx
  loop
    if not exists (select 1 from pg_class where relname = r.idx and relkind = 'i') then
      raise notice 'YA NO EXISTE %', r.idx; continue;
    end if;
    gemelo := null;
    select oc.relname into gemelo
    from pg_index mio
    join pg_class mc on mc.oid = mio.indexrelid and mc.relname = r.idx
    join pg_index otro on otro.indrelid = mio.indrelid and otro.indexrelid <> mio.indexrelid
                      and otro.indkey::text = mio.indkey::text
                      and otro.indexprs is null and mio.indexprs is null
                      and otro.indpred is null
                      and otro.indclass::text = mio.indclass::text
    join pg_class oc on oc.oid = otro.indexrelid
    limit 1;
    if gemelo is not null then
      execute format('drop index if exists public.%I', r.idx);
      raise notice 'BORRADO %  (repetía a %)', r.idx, gemelo;
    else
      raise notice 'SE QUEDA %', r.idx;
    end if;
  end loop;
end $$;
