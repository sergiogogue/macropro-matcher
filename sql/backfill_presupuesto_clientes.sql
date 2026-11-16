-- ════════════════════════════════════════════════════════════════════
-- BACKFILL · Rescata presupuesto_max y es_desarrollador desde tipo_comprador
-- Base compartida (xugrrabebphdelgwqnwc) · tabla public.clientes.
--
-- El presupuesto venía ATRAPADO en el texto de tipo_comprador, p.ej.
--   "Desarrollador Mediano B+ ($50 -$100 MDP)"  → tope $100 MDP.
--
-- Reglas acordadas:
--   · presupuesto_max se guarda en PESOS (MDP × 1,000,000) para poder
--     compararlo directo con lotes.precio_total.
--   · etiqueta con ">"  (p.ej. ">$200 MDP")  → NULL  = SIN TOPE (no penaliza).
--   · etiqueta con "<$15 MDP"                 → 15 MDP = 15,000,000.
--   · rango "$50 -$100 MDP"                   → tope = mayor número = 100 MDP.
--   · etiqueta sin números (Inmobiliaria, Fibra…) → NULL (sin dato de tope).
--
-- Idempotente: solo RELLENA presupuesto_max donde está vacío (0/NULL); no pisa
-- los que ya traen un valor. Correr en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════

-- 1) Columna derivada para el bonus de matching.
alter table public.clientes add column if not exists es_desarrollador boolean default false;

-- 2) es_desarrollador para TODOS (según su tipo_comprador).
update public.clientes
   set es_desarrollador = (lower(coalesce(tipo_comprador, '')) like '%desarrollad%');

-- 3) presupuesto_max desde la etiqueta, SOLO donde está vacío.
update public.clientes c
   set presupuesto_max = sub.pmax
  from (
    select id_cliente,
      case
        when coalesce(tipo_comprador, '') ~ '>' then null                       -- ">$200 MDP" → sin tope
        else ( select max((m[1])::numeric)
                 from regexp_matches(coalesce(tipo_comprador, ''), '([0-9]+)', 'g') as m
             ) * 1000000                                                          -- mayor nº (MDP) → pesos
      end as pmax
    from public.clientes
    where coalesce(presupuesto_max, 0) = 0
      and coalesce(nullif(btrim(tipo_comprador), ''), '') <> ''
  ) sub
 where sub.id_cliente = c.id_cliente;

-- 4) Verificación (antes: pct_presupuesto ~0.1%; esperado: ~27%).
select
  count(*)                                                                                   as total,
  count(*) filter (where coalesce(presupuesto_max, 0) > 0)                                   as con_presupuesto,
  round(100.0 * count(*) filter (where coalesce(presupuesto_max, 0) > 0) / nullif(count(*), 0), 1) as pct_presupuesto,
  count(*) filter (where es_desarrollador)                                                   as desarrolladores,
  count(*) filter (where coalesce(tipo_comprador, '') ~ '>')                                 as sin_tope_uncapped
from public.clientes
where coalesce(activo, true) = true;
