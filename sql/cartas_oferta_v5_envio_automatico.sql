-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v5 · ENVÍO AUTOMÁTICO al vendedor + bitácora de avisos
-- ────────────────────────────────────────────────────────────────────
-- Requiere: cartas_oferta.sql, v2, v3 y v4 (ya corridos).
--   · Cuando el COMPRADOR acepta y firma (sin contrapropuesta) y la carta ya trae al
--     vendedor, la carta pasa SOLA a "enviada al vendedor": Grupo Guía la recibe en
--     automático y se habilita la liga del vendedor (10 días). Si no trae vendedor,
--     queda en "firmada por el comprador" para capturarlo.
--   · avisos (jsonb): registro de los correos ya enviados (vendedor, Grupo Guía, asesor…)
--     para no mandarlos dos veces. Lo escribe la función carta-oferta-notificar (Netlify).
-- Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

alter table public.cartas_oferta add column if not exists avisos jsonb not null default '{}'::jsonb;

create or replace function public.carta_oferta_responder(
  p_token text, p_accion text, p_nombre text, p_email text,
  p_precio_m2 numeric default null, p_forma_pago text default null,
  p_condiciones text default null, p_comentarios text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.cartas_oferta; r public.cartas_oferta_rondas; rol text; exp timestamptz;
        nom text := btrim(coalesce(p_nombre, '')); em text := lower(btrim(coalesce(p_email, '')));
        ip text := public._co_ip(); ua text := public._co_ua();
begin
  if coalesce(length(p_token), 0) < 20 then return jsonb_build_object('error', 'liga_invalida'); end if;
  select * into c from public.cartas_oferta where token_comprador = p_token for update;
  if found then rol := 'comprador'; exp := c.token_comprador_exp;
  else
    select * into c from public.cartas_oferta where token_vendedor = p_token for update;
    if not found then return jsonb_build_object('error', 'liga_invalida'); end if;
    rol := 'vendedor'; exp := c.token_vendedor_exp;
  end if;
  if exp is null or exp <= now() then return jsonb_build_object('error', 'vencida'); end if;
  if length(nom) < 3 then return jsonb_build_object('error', 'Escribe tu nombre completo.'); end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('error', 'Escribe un correo válido.'); end if;
  select * into r from public.cartas_oferta_rondas where carta_id = c.id and ronda = c.ronda_actual for update;
  if r.id is null then return jsonb_build_object('error', 'La carta no tiene condiciones capturadas.'); end if;
  if rol = 'comprador' and not (c.estado = 'enviada_comprador' and r.comprador_firma_at is null) then
    return jsonb_build_object('error', 'Esta carta ya no está esperando tu respuesta.');
  end if;
  if rol = 'vendedor' and not (c.estado = 'enviada_vendedor' and r.vendedor_firma_at is null) then
    return jsonb_build_object('error', 'Esta carta ya no está esperando tu respuesta.');
  end if;

  if p_accion = 'aceptar' then
    if rol = 'comprador' then
      update public.cartas_oferta_rondas set comprador_firma_nombre = nom, comprador_firma_email = em,
             comprador_firma_at = now(), comprador_firma_ip = ip, comprador_firma_ua = ua where id = r.id;
      if r.propone = 'vendedor' then
        -- Acepta la contrapropuesta del vendedor (que ya la firmó) → oferta ACEPTADA.
        update public.cartas_oferta set estado = 'aceptada', comprador_email = coalesce(comprador_email, em) where id = c.id;
      elsif coalesce(btrim(c.vendedor_nombre), '') <> '' then
        -- ENVÍO AUTOMÁTICO al vendedor: el comprador aceptó sin cambios y la carta ya trae al vendedor.
        -- Grupo Guía la RECIBE en automático y se habilita la liga del vendedor (10 días).
        update public.cartas_oferta
           set estado = 'enviada_vendedor', comprador_email = coalesce(comprador_email, em),
               gg_firma_at = coalesce(gg_firma_at, now()), gg_firma_email = coalesce(gg_firma_email, 'macrolotes@grupoguia.mx'),
               token_vendedor = public._co_token(), token_vendedor_exp = now() + interval '10 days'
         where id = c.id;
      else
        -- Sin vendedor capturado: queda para que Grupo Guía lo capture y lo envíe.
        update public.cartas_oferta set estado = 'firmada_comprador', comprador_email = coalesce(comprador_email, em) where id = c.id;
      end if;
    else
      update public.cartas_oferta_rondas set vendedor_firma_nombre = nom, vendedor_firma_email = em,
             vendedor_firma_at = now(), vendedor_firma_ip = ip, vendedor_firma_ua = ua where id = r.id;
      update public.cartas_oferta set estado = 'aceptada', vendedor_email = coalesce(vendedor_email, em) where id = c.id;
    end if;

  elsif p_accion = 'contrapropuesta' then
    if rol = 'comprador' and r.propone <> 'vendedor' then
      return jsonb_build_object('error', 'Solo puedes contraproponer sobre una contrapropuesta del vendedor.');
    end if;
    if coalesce(p_precio_m2, 0) <= 0 then return jsonb_build_object('error', 'Escribe el precio por m² que propones.'); end if;
    if coalesce(p_forma_pago, '') not in ('Contado','Financiamiento','Diferido') then
      return jsonb_build_object('error', 'Elige la forma de pago.');
    end if;
    insert into public.cartas_oferta_rondas (carta_id, ronda, propone, precio_m2, forma_pago, condiciones, comentarios,
           comprador_firma_nombre, comprador_firma_email, comprador_firma_at, comprador_firma_ip, comprador_firma_ua,
           vendedor_firma_nombre, vendedor_firma_email, vendedor_firma_at, vendedor_firma_ip, vendedor_firma_ua)
    values (c.id, c.ronda_actual + 1, rol, p_precio_m2, p_forma_pago, nullif(btrim(coalesce(p_condiciones, '')), ''), nullif(btrim(coalesce(p_comentarios, '')), ''),
           case when rol = 'comprador' then nom end, case when rol = 'comprador' then em end, case when rol = 'comprador' then now() end,
           case when rol = 'comprador' then ip end, case when rol = 'comprador' then ua end,
           case when rol = 'vendedor' then nom end, case when rol = 'vendedor' then em end, case when rol = 'vendedor' then now() end,
           case when rol = 'vendedor' then ip end, case when rol = 'vendedor' then ua end);
    update public.cartas_oferta set ronda_actual = c.ronda_actual + 1,
           estado = case when rol = 'vendedor' then 'contrapropuesta_vendedor' else 'contrapropuesta_comprador' end
     where id = c.id;

  elsif p_accion = 'rechazar' then
    update public.cartas_oferta set estado = 'rechazada', rechazo_por = rol,
           rechazo_motivo = concat_ws(' — ', nullif(btrim(coalesce(p_comentarios, '')), ''), nom || ' <' || em || '>'),
           rechazo_at = now(), rechazo_ip = ip where id = c.id;
  else
    return jsonb_build_object('error', 'acción inválida');
  end if;
  return public.carta_oferta_ver(p_token);
end $$;

grant  execute on function public.carta_oferta_responder(text, text, text, text, numeric, text, text, text) to anon, authenticated;

-- ── VERIFICACIÓN (debe salir: avisos | true) ──
select (select column_name from information_schema.columns where table_schema='public' and table_name='cartas_oferta' and column_name='avisos') as columna,
       (select position('ENVÍO AUTOMÁTICO' in prosrc) > 0 from pg_proc where proname='carta_oferta_responder') as envio_automatico;
