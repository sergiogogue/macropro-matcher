-- ════════════════════════════════════════════════════════════════════
-- FASE 3 · Normalización de datos de clientes (uso_interes + tipo_comprador)
-- Base compartida (xugrrabebphdelgwqnwc) · tabla public.clientes.
--
-- Problema: uso_interes viene sucio ("Comercial" vs "comercial" vs "Vivienda"
-- vs "Habitacional Vertical"…). Aunque el motor ya compara sin acentos/mayúsculas,
-- estandarizar a la FAMILIA canónica del sistema (la misma de familiaDeUso:
-- Habitacional, Comercial, Oficinas, Industrial, Turístico, Equipamiento, Mixto)
-- deja datos limpios para filtros, reportes y cualquier match exacto.
--
-- Qué hace:
--   1) landing_familia_uso(text)  → mapea un uso a su familia canónica (o deja el
--      texto tal cual si no reconoce ninguna familia, para no destruir datos).
--   2) landing_norm_usos(text[])  → normaliza, limpia vacíos y dedup del array.
--   3) trigger en public.clientes  → normaliza en CADA insert/update (cubre MacroPro
--      y cualquier importación futura, p.ej. HubSpot). También corrige typos obvios
--      de tipo_comprador ("Grnde"→"Grande", "Privadp"→"Privado") y colapsa espacios.
--   4) backfill de lo existente.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════

-- 1) Familia canónica de un uso (mismo orden/keywords que netlify/lib/match.mjs).
--    Orden: lo más específico primero (industrial/turístico/equipamiento antes de comercial).
create or replace function public.landing_familia_uso(p text)
returns text language sql immutable as $$
  select case
    when v ~ 'mixto|usos? mixtos'                                                                                             then 'Mixto'
    when v ~ 'industrial|log[ií]stic|nave|bodega|almac[eé]n|manufactur|f[aá]brica|maquiladora|cedis|self.?storage|data ?center|centro de datos|agroindustrial|invernadero|planta solar|fotovoltaic|frigor[ií]f' then 'Industrial'
    when v ~ 'hotel|hospitality|tur[ií]stic|resort|hospedaje|caba(n|ñ)a|vacacional'                                          then 'Turístico'
    when v ~ 'hospital|cl[ií]nic|salud|m[eé]dic|dental|laboratorio|educativ|educaci|escuela|universidad|colegio|guarder|equipamiento|asilo|geri[aá]tric|deportivo|templo|iglesia' then 'Equipamiento'
    when v ~ 'oficina|corporativ|despacho|coworking|consultorio'                                                             then 'Oficinas'
    when v ~ 'habitacional|residencial|vivienda|departament|depa|casa|fraccionamiento|inter[eé]s social|torre'              then 'Habitacional'
    when v ~ 'comercial|retail|tienda|plaza|strip|conveniencia|oxxo|gasolin|supermercado|autoservicio|abarrotes|minisuper|farmacia|banco|restaurante|caf[eé]|sal[oó]n|gimnasio|showroom|agencia|cine|bar|spa' then 'Comercial'
    else nullif(btrim(coalesce(p, '')), '')     -- sin familia reconocida: conserva el texto (trim)
  end
  from (select lower(coalesce(p, '')) as v) s
$$;

-- 2) Normaliza un array de usos: familia canónica, sin vacíos, sin duplicados.
create or replace function public.landing_norm_usos(arr text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct f order by f), '{}')
  from (
    select public.landing_familia_uso(u) as f
    from unnest(coalesce(arr, '{}')) as u
    where coalesce(btrim(u), '') <> ''
  ) t
  where f is not null and btrim(f) <> ''
$$;

-- 3) Trigger: normaliza en cada escritura (MacroPro + imports futuros).
create or replace function public.clientes_normaliza()
returns trigger language plpgsql as $$
begin
  if new.uso_interes is not null then
    new.uso_interes := public.landing_norm_usos(new.uso_interes);
  end if;
  if new.tipo_comprador is not null then
    new.tipo_comprador := btrim(regexp_replace(
      replace(replace(new.tipo_comprador, 'Grnde', 'Grande'), 'Privadp', 'Privado'),
      '\s+', ' ', 'g'));
  end if;
  return new;
end $$;

drop trigger if exists trg_clientes_normaliza on public.clientes;
create trigger trg_clientes_normaliza
  before insert or update on public.clientes
  for each row execute function public.clientes_normaliza();

-- 4) Backfill de lo existente.
update public.clientes set uso_interes = public.landing_norm_usos(uso_interes)
 where uso_interes is not null;

update public.clientes
   set tipo_comprador = btrim(regexp_replace(
         replace(replace(tipo_comprador, 'Grnde', 'Grande'), 'Privadp', 'Privado'),
         '\s+', ' ', 'g'))
 where tipo_comprador is not null;

-- 5) Verificación: distribución de usos ya canónica.
select lower(btrim(u)) as uso_norm, count(*)
from public.clientes, unnest(coalesce(uso_interes, '{}')) as u
where coalesce(activo, true) = true
group by 1 order by 2 desc;
