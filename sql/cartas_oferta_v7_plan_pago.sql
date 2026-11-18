-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v7 · CONTRAPROPUESTA ESTRUCTURADA (plan de pago por ronda)
-- ────────────────────────────────────────────────────────────────────
-- Requiere: cartas_oferta.sql, v2, v3, v4, v5 y v6 (ya corridos).
--
-- Cada ronda puede guardar su PLAN DE PAGO como datos (plan_pago jsonb):
--   { forma: 'Contado'|'Financiamiento'|'Diferido',
--     dias, eng_pct, eng_cuando ('contrato'|'aceptacion'), banco, aprob,      (según la forma)
--     n, per ('mensual'|'bimestral'|'trimestral'), inicio (AAAA-MM-DD), escr ('ultimo'|'contrato'),
--     conds { posesion, gastos, dictamen, gravamenes }, otra }
-- La cláusula TERCERA (lo que se firma) la redacta MacroPro con esos datos y se guarda, como
-- siempre, en rondas.condiciones (marca §). plan_pago sirve para el historial y el comparativo.
--
-- carta_oferta_contraoferta() recibe el plan (p_plan, opcional). Se reemplaza la versión v6
-- (misma lógica: conserva la liga del comprador, nueva ronda, vuelve a firma comprador → vendedor).
-- Solo admins (landing_es_admin). Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

alter table public.cartas_oferta_rondas add column if not exists plan_pago jsonb;

-- La versión v6 (7 parámetros) se sustituye por la v7 (8 parámetros, p_plan opcional).
drop function if exists public.carta_oferta_contraoferta(uuid, text, numeric, text, text, text, text);

create or replace function public.carta_oferta_contraoferta(
  p_id uuid, p_solicita text, p_precio_m2 numeric, p_forma_pago text,
  p_condiciones text default null, p_comentarios text default null, p_nota text default null,
  p_plan jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public, auth as $$
declare c public.cartas_oferta; n int; t text; em text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  select * into c from public.cartas_oferta where id = p_id for update;
  if not found then raise exception 'carta no encontrada'; end if;
  if c.estado = 'borrador' then
    raise exception 'La carta sigue en borrador: edítala y mándala al comprador (no hace falta una contraoferta).';
  end if;
  if coalesce(p_solicita, '') not in ('comprador','vendedor','grupo_guia') then
    raise exception 'Indica quién pide la contraoferta (comprador, vendedor o Grupo Guía).';
  end if;
  if coalesce(p_precio_m2, 0) <= 0 then raise exception 'Escribe el precio por m².'; end if;
  if coalesce(p_forma_pago, '') not in ('Contado','Financiamiento','Diferido') then
    raise exception 'Elige la forma de pago.';
  end if;
  if p_plan is not null and coalesce(p_plan ->> 'forma', p_forma_pago) <> p_forma_pago then
    raise exception 'El plan de pago no coincide con la forma de pago.';
  end if;
  if length(btrim(coalesce(p_comentarios, '')) || btrim(coalesce(p_nota, ''))) < 5 then
    raise exception 'Escribe el motivo de la contraoferta (comentario o nota interna).';
  end if;

  n := c.ronda_actual + 1;
  insert into public.cartas_oferta_rondas (carta_id, ronda, propone, solicita, precio_m2, forma_pago,
         condiciones, comentarios, capturada_por, nota_interna, plan_pago)
  values (c.id, n, 'grupo_guia', p_solicita, p_precio_m2, p_forma_pago,
         nullif(btrim(coalesce(p_condiciones, '')), ''), nullif(btrim(coalesce(p_comentarios, '')), ''),
         nullif(em, ''), nullif(btrim(coalesce(p_nota, '')), ''), p_plan);

  -- Se CONSERVA la liga del comprador (y su portal /mi-oferta/); solo se renueva la vigencia.
  t := coalesce(c.token_comprador, public._co_token());
  update public.cartas_oferta
     set ronda_actual = n, estado = 'enviada_comprador',
         token_comprador = t, token_comprador_exp = now() + interval '10 days'
   where id = c.id;

  return jsonb_build_object('ok', true, 'ronda', n, 'token_comprador', t, 'estado_anterior', c.estado);
end $$;

revoke execute on function public.carta_oferta_contraoferta(uuid, text, numeric, text, text, text, text, jsonb) from public, anon;
grant  execute on function public.carta_oferta_contraoferta(uuid, text, numeric, text, text, text, text, jsonb) to authenticated;

-- ── VERIFICACIÓN (debe salir: plan_pago | 1) ──
select (select column_name from information_schema.columns where table_schema='public' and table_name='cartas_oferta_rondas' and column_name='plan_pago') as columna,
       (select count(*) from pg_proc where proname = 'carta_oferta_contraoferta') as funciones;
