-- ════════════════════════════════════════════════════════════════════
-- Inteligencia Comercial · 3 vistas analíticas. Correr en Supabase → SQL Editor.
-- Robusto: to_jsonb() maneja columnas array (text[] o jsonb) por igual.
-- ════════════════════════════════════════════════════════════════════

-- 1) PERFIL DEL COMPRADOR — por ciudad, rango de presupuesto y uso de suelo
create or replace view public.vw_analisis_compradores as
select
  lower(btrim(ci.ciudad)) as ciudad,
  case
    when coalesce(c.presupuesto_max, c.presupuesto_min, 0) = 0 then 'sin dato'
    when coalesce(c.presupuesto_max, c.presupuesto_min) <= 5000000  then '0-5M'
    when coalesce(c.presupuesto_max, c.presupuesto_min) <= 20000000 then '5-20M'
    when coalesce(c.presupuesto_max, c.presupuesto_min) <= 50000000 then '20-50M'
    else '50M+'
  end as rango_presupuesto,
  coalesce(lower(btrim(us.uso)), 'sin uso') as uso,
  count(distinct c.id_cliente) as clientes,
  round(avg(nullif(coalesce(c.presupuesto_max, c.presupuesto_min), 0))) as presupuesto_prom
from public.clientes c
left join lateral jsonb_array_elements_text(to_jsonb(c.ciudad_interes)) as ci(ciudad) on true
left join lateral jsonb_array_elements_text(to_jsonb(c.uso_interes))   as us(uso)    on true
where coalesce(c.activo, true) = true
  and ci.ciudad is not null and btrim(ci.ciudad) <> ''
group by 1, 2, 3;

-- 2) OFERTA vs DEMANDA — por ciudad: lotes disponibles vs clientes buscando
create or replace view public.vw_inventario_vs_demanda as
with oferta as (
  select lower(btrim(ciudad)) as ciudad, count(*) as lotes_disponibles
  from public.lotes
  where lower(coalesce(status_inventario, status, 'disponible')) like 'disponible%'
    and coalesce(btrim(ciudad), '') <> ''
  group by 1
),
demanda as (
  select lower(btrim(ci.ciudad)) as ciudad, count(distinct c.id_cliente) as clientes_buscando
  from public.clientes c
  left join lateral jsonb_array_elements_text(to_jsonb(c.ciudad_interes)) as ci(ciudad) on true
  where coalesce(c.activo, true) = true
    and ci.ciudad is not null and btrim(ci.ciudad) <> ''
  group by 1
)
select
  coalesce(o.ciudad, d.ciudad) as ciudad,
  coalesce(o.lotes_disponibles, 0) as lotes_disponibles,
  coalesce(d.clientes_buscando, 0) as clientes_buscando,
  (coalesce(d.clientes_buscando,0) - coalesce(o.lotes_disponibles,0)) as brecha
from oferta o
full outer join demanda d on o.ciudad = d.ciudad
order by clientes_buscando desc, lotes_disponibles desc;

-- 3) RENDIMIENTO DEL INVENTARIO — tiempo en mercado + interés + conversión global
create or replace view public.vw_estrategia_ventas as
with conv as (
  select
    count(*) filter (where lower(coalesce(estatus,'')) = 'aceptada') as cotiz_aceptadas,
    count(*) as cotiz_total,
    round(100.0 * count(*) filter (where lower(coalesce(estatus,'')) = 'aceptada')
          / nullif(count(*), 0), 1) as tasa_conversion
  from public.cotizaciones_opcionador
)
select
  l.id,
  coalesce(nullif(btrim(l.nombre),''), l.clave_unica, l.id::text) as terreno,
  l.ciudad,
  coalesce(l.status_inventario, l.status, 'Disponible') as status,
  nullif(l.precio_total, 0) as precio_total,
  case when l.fecha_ingreso::text ~ '^\d{4}-\d{2}-\d{2}'
       then (current_date - (left(l.fecha_ingreso::text,10))::date)
       else null end as dias_en_mercado,
  coalesce((
    select count(*) from jsonb_array_elements(
      case when jsonb_typeof(to_jsonb(cr.prospectos)) = 'array' then to_jsonb(cr.prospectos) else '[]'::jsonb end)
  ), 0) as interesados,
  conv.tasa_conversion, conv.cotiz_aceptadas, conv.cotiz_total
from public.lotes l
left join public.crm_lotes cr on cr.lote_id = l.id
cross join conv
order by dias_en_mercado desc nulls last;

-- Permisos de lectura para el equipo (autenticados)
grant select on public.vw_analisis_compradores, public.vw_inventario_vs_demanda, public.vw_estrategia_ventas to authenticated;
