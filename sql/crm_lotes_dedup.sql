-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Limpieza de DUPLICADOS en crm_lotes por id no canónico
-- (KU-010 / ku-010 / ku_010 / KU_010 = el MISMO lote).
--
-- ⚠ CORRER SOLO DESPUÉS de que los 3 equipos tengan la app actualizada
--   y hayan sincronizado el CRM fusionado/limpio (así la fila canónica ya
--   trae TODOS los prospectos e interacciones).
--
-- La app ya fusiona al leer, así que esto es "higiene" de la nube para que
-- deje de reenviar variantes. Conserva, por grupo normalizado, la fila con
-- MÁS prospectos; en empate, la de id lexicográficamente menor (minúscula).
-- ════════════════════════════════════════════════════════════════════

-- 1) Reporte previo (revisa antes de borrar):
select regexp_replace(lower(lote_id),'[^a-z0-9]','','g') as norm_id,
       count(*) as filas,
       array_agg(lote_id order by lote_id) as variantes
from public.crm_lotes
group by 1
having count(*) > 1
order by filas desc;

-- 2) Borrado de duplicados (conserva la fila con más prospectos por grupo):
delete from public.crm_lotes a
using public.crm_lotes b
where regexp_replace(lower(a.lote_id),'[^a-z0-9]','','g')
    = regexp_replace(lower(b.lote_id),'[^a-z0-9]','','g')
  and a.ctid <> b.ctid
  and (
        jsonb_array_length(coalesce(a.prospectos,'[]'::jsonb))
      < jsonb_array_length(coalesce(b.prospectos,'[]'::jsonb))
     or (
          jsonb_array_length(coalesce(a.prospectos,'[]'::jsonb))
        = jsonb_array_length(coalesce(b.prospectos,'[]'::jsonb))
        and a.lote_id > b.lote_id
        )
      );

-- 3) Verificación (debe devolver 0 filas):
select regexp_replace(lower(lote_id),'[^a-z0-9]','','g') as norm_id, count(*)
from public.crm_lotes
group by 1 having count(*) > 1;

-- ────────────────────────────────────────────────────────────────────
-- 4) BASURA tipo UUID: filas cuyo lote_id es un UUID (dato corrupto de
--    sincronizaciones viejas). Un lote NUNCA tiene id UUID. La app ya las
--    oculta, pero conviene borrarlas de la nube.
-- ────────────────────────────────────────────────────────────────────

-- 4a) Reporte (revisa antes de borrar; verás qué prospectos traían):
select lote_id, jsonb_array_length(coalesce(prospectos,'[]'::jsonb)) as prospectos
from public.crm_lotes
where regexp_replace(lower(lote_id),'[^a-z0-9]','','g') ~ '^[0-9a-f]{32}$'
order by prospectos desc;

-- 4b) Borrado de las filas UUID (descomenta para ejecutar):
-- delete from public.crm_lotes
-- where regexp_replace(lower(lote_id),'[^a-z0-9]','','g') ~ '^[0-9a-f]{32}$';
