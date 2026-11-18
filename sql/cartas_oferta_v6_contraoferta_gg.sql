-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v6 · CONTRAOFERTA / REENVÍO A FIRMA desde MacroPro (Grupo Guía)
-- ────────────────────────────────────────────────────────────────────
-- Requiere: cartas_oferta.sql, v2, v3, v4 y v5 (ya corridos).
--
-- Para qué: cuando la negociación se mueve por teléfono/WhatsApp (el vendedor pide otro
-- precio, el comprador cambia la forma de pago) o cuando hay que volver a firmar la carta
-- para el contrato, Grupo Guía captura una NUEVA RONDA desde MacroPro. Ninguna ronda pisa
-- a la anterior: queda todo el historial (quién la pidió, quién la capturó, nota interna).
--
-- Flujo de la nueva ronda (las DOS partes vuelven a firmar las nuevas condiciones):
--   1) Se crea la ronda N+1 (propone = 'grupo_guia', solicita = comprador|vendedor|grupo_guia)
--   2) La carta pasa a "enviada al comprador" con liga NUEVA de 10 días → el comprador firma
--   3) Al firmar el comprador, si la carta ya trae vendedor, pasa sola al vendedor (v5)
--   4) El vendedor acepta → "aceptada"  (o contrapropone / rechaza, como siempre)
--
-- Se puede usar en cualquier estado excepto "borrador" (en borrador se edita la carta).
-- También sirve para reabrir una carta "rechazada" o "aceptada".
-- El apartado y la superficie NO cambian (los congela la carta, igual que antes).
-- Solo admins (landing_es_admin). Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

alter table public.cartas_oferta_rondas add column if not exists solicita      text;
alter table public.cartas_oferta_rondas add column if not exists capturada_por text;
alter table public.cartas_oferta_rondas add column if not exists nota_interna  text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cartas_oferta_rondas_solicita_chk') then
    alter table public.cartas_oferta_rondas add constraint cartas_oferta_rondas_solicita_chk
      check (solicita is null or solicita in ('comprador','vendedor','grupo_guia'));
  end if;
end $$;

create or replace function public.carta_oferta_contraoferta(
  p_id uuid, p_solicita text, p_precio_m2 numeric, p_forma_pago text,
  p_condiciones text default null, p_comentarios text default null, p_nota text default null)
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
  if length(btrim(coalesce(p_comentarios, '')) || btrim(coalesce(p_nota, ''))) < 5 then
    raise exception 'Escribe el motivo de la contraoferta (comentario o nota interna).';
  end if;

  n := c.ronda_actual + 1;
  insert into public.cartas_oferta_rondas (carta_id, ronda, propone, solicita, precio_m2, forma_pago,
         condiciones, comentarios, capturada_por, nota_interna)
  values (c.id, n, 'grupo_guia', p_solicita, p_precio_m2, p_forma_pago,
         nullif(btrim(coalesce(p_condiciones, '')), ''), nullif(btrim(coalesce(p_comentarios, '')), ''),
         nullif(em, ''), nullif(btrim(coalesce(p_nota, '')), ''));

  t := public._co_token();
  update public.cartas_oferta
     set ronda_actual = n, estado = 'enviada_comprador',
         token_comprador = t, token_comprador_exp = now() + interval '10 days',
         token_vendedor = null, token_vendedor_exp = null
   where id = c.id;

  return jsonb_build_object('ok', true, 'ronda', n, 'token_comprador', t, 'estado_anterior', c.estado);
end $$;

revoke execute on function public.carta_oferta_contraoferta(uuid, text, numeric, text, text, text, text) from public, anon;
grant  execute on function public.carta_oferta_contraoferta(uuid, text, numeric, text, text, text, text) to authenticated;

-- ── VERIFICACIÓN (debe salir: solicita | true) ──
select (select column_name from information_schema.columns where table_schema='public' and table_name='cartas_oferta_rondas' and column_name='solicita') as columna,
       exists (select 1 from pg_proc where proname = 'carta_oferta_contraoferta') as funcion;
