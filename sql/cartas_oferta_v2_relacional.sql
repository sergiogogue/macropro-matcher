-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v2 · relacional (wizard "Nueva carta oferta")
-- ────────────────────────────────────────────────────────────────────
-- Requiere: sql/cartas_oferta.sql (ya corrido).
-- Agrega los IDs de lo que se eligió en el wizard:
--   lote_id (ya existía) · captacion_id (ya existía) · cliente_id · asesor_id
-- y lo que hace falta para el seguimiento: origen del terreno, correo del asesor
-- y el precio de lista por m² al momento de ofertar (para comparar).
-- 100% aditivo e idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

alter table public.cartas_oferta
  add column if not exists cliente_id      text,          -- clientes.id_cliente
  add column if not exists asesor_id       text,          -- asesores.id
  add column if not exists asesor_email    text,
  add column if not exists origen          text,          -- 'lote' (inventario) | 'captacion'
  add column if not exists precio_lista_m2 numeric;       -- precio de lista/autorizado por m² al ofertar

do $$ begin
  alter table public.cartas_oferta add constraint cartas_oferta_origen_chk check (origen is null or origen in ('lote','captacion'));
exception when duplicate_object then null; end $$;

create index if not exists idx_cartas_oferta_lote    on public.cartas_oferta (lote_id);
create index if not exists idx_cartas_oferta_cliente on public.cartas_oferta (cliente_id);
create index if not exists idx_cartas_oferta_asesor  on public.cartas_oferta (asesor_id);

-- ── VERIFICACIÓN (deben salir las 5 columnas nuevas) ──
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'cartas_oferta'
   and column_name in ('cliente_id','asesor_id','asesor_email','origen','precio_lista_m2')
 order by column_name;
