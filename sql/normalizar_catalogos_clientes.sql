-- ════════════════════════════════════════════════════════════════════════
-- Normalización de una sola vez · public.clientes
-- Alinea uso_interes (10) y tipo_comprador (4) con el catálogo EXACTO que
-- comparten MacroPro y la landing "Grupo Guía Macrolotes".
--
-- El match entre ambos sistemas empata por TEXTO EXACTO, así que un cliente
-- viejo con un acento/espacio/mayúscula distinta NO cruza. Este script arregla
-- SOLO esos casos (mismo valor, forma distinta). Los valores que NO empatan con
-- ninguna de las 10/4 cadenas se dejan intactos (no inventamos mapeos).
--
-- Seguro de correr varias veces (idempotente). Sella updated_at para que la
-- landing respete "gana el más reciente".
--
-- CÓMO USAR:
--   1. Corre el bloque "PREVIEW" para ver qué cambiaría (no modifica nada).
--   2. Si te cuadra, corre los dos UPDATE.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists unaccent;

-- canon(x): minúsculas, sin acentos, sin espacios alrededor de "/", un solo espacio.
-- "Comercial/Retail", "comercial / retail", "COMERCIAL / RETAIL" → todos casan.
-- (definida inline abajo; aquí queda como referencia)
--   regexp_replace(regexp_replace(trim(lower(unaccent(x))),'\s*/\s*','/','g'),'\s+',' ','g')

-- ── Catálogo canónico (canon → cadena EXACTA) ──────────────────────────
-- uso_interes (10):
--   habitacional vertical      → Habitacional Vertical
--   habitacional horizontal    → Habitacional Horizontal
--   comercial/retail           → Comercial / Retail
--   industrial/logistico       → Industrial / Logístico
--   hotel/hospitality          → Hotel / Hospitality
--   servicios/oficinas         → Servicios / Oficinas
--   hospital/clinica           → Hospital / Clínica
--   gasolinera                 → Gasolinera
--   mixto                      → Mixto
--   equipamiento/educacion     → Equipamiento / Educación
-- tipo_comprador (4):
--   inversionista → Inversionista · desarrollador → Desarrollador
--   usuario final → Usuario final · broker → Broker


-- ════════════════════════════════════════════════════════════════════════
-- PREVIEW (no modifica nada) — qué usos cambiarían
-- ════════════════════════════════════════════════════════════════════════
with cat(canon, canonical) as (values
  ('habitacional vertical','Habitacional Vertical'),
  ('habitacional horizontal','Habitacional Horizontal'),
  ('comercial/retail','Comercial / Retail'),
  ('industrial/logistico','Industrial / Logístico'),
  ('hotel/hospitality','Hotel / Hospitality'),
  ('servicios/oficinas','Servicios / Oficinas'),
  ('hospital/clinica','Hospital / Clínica'),
  ('gasolinera','Gasolinera'),
  ('mixto','Mixto'),
  ('equipamiento/educacion','Equipamiento / Educación')
)
select c.id_cliente, c.nombre, c.uso_interes as antes,
  (select array_agg(coalesce(cat.canonical, u.elem) order by u.ord)
     from unnest(c.uso_interes) with ordinality as u(elem, ord)
     left join cat on cat.canon =
       regexp_replace(regexp_replace(trim(lower(unaccent(u.elem))),'\s*/\s*','/','g'),'\s+',' ','g')
  ) as despues
from public.clientes c
where c.uso_interes is not null and array_length(c.uso_interes,1) > 0
  and c.uso_interes is distinct from
    (select array_agg(coalesce(cat.canonical, u.elem) order by u.ord)
       from unnest(c.uso_interes) with ordinality as u(elem, ord)
       left join cat on cat.canon =
         regexp_replace(regexp_replace(trim(lower(unaccent(u.elem))),'\s*/\s*','/','g'),'\s+',' ','g'));

-- PREVIEW — qué tipo_comprador cambiaría
with cat(canon, canonical) as (values
  ('inversionista','Inversionista'),
  ('desarrollador','Desarrollador'),
  ('usuario final','Usuario final'),
  ('broker','Broker')
)
select c.id_cliente, c.nombre, c.tipo_comprador as antes, cat.canonical as despues
from public.clientes c
join cat on cat.canon = regexp_replace(trim(lower(unaccent(c.tipo_comprador))),'\s+',' ','g')
where c.tipo_comprador is not null and c.tipo_comprador <> cat.canonical;


-- ════════════════════════════════════════════════════════════════════════
-- APLICAR — uso_interes
-- ════════════════════════════════════════════════════════════════════════
with cat(canon, canonical) as (values
  ('habitacional vertical','Habitacional Vertical'),
  ('habitacional horizontal','Habitacional Horizontal'),
  ('comercial/retail','Comercial / Retail'),
  ('industrial/logistico','Industrial / Logístico'),
  ('hotel/hospitality','Hotel / Hospitality'),
  ('servicios/oficinas','Servicios / Oficinas'),
  ('hospital/clinica','Hospital / Clínica'),
  ('gasolinera','Gasolinera'),
  ('mixto','Mixto'),
  ('equipamiento/educacion','Equipamiento / Educación')
),
calc as (
  select c.id_cliente,
    (select array_agg(coalesce(cat.canonical, u.elem) order by u.ord)
       from unnest(c.uso_interes) with ordinality as u(elem, ord)
       left join cat on cat.canon =
         regexp_replace(regexp_replace(trim(lower(unaccent(u.elem))),'\s*/\s*','/','g'),'\s+',' ','g')
    ) as new_arr
  from public.clientes c
  where c.uso_interes is not null and array_length(c.uso_interes,1) > 0
)
update public.clientes c
set uso_interes = calc.new_arr, updated_at = now()
from calc
where c.id_cliente = calc.id_cliente
  and c.uso_interes is distinct from calc.new_arr;

-- ════════════════════════════════════════════════════════════════════════
-- APLICAR — tipo_comprador
-- ════════════════════════════════════════════════════════════════════════
with cat(canon, canonical) as (values
  ('inversionista','Inversionista'),
  ('desarrollador','Desarrollador'),
  ('usuario final','Usuario final'),
  ('broker','Broker')
)
update public.clientes c
set tipo_comprador = cat.canonical, updated_at = now()
from cat
where cat.canon = regexp_replace(trim(lower(unaccent(c.tipo_comprador))),'\s+',' ','g')
  and c.tipo_comprador is distinct from cat.canonical;
