-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA · v8 · NEGOCIACIÓN IDA Y VUELTA (2026-11-18)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Qué cambia (sobre v4 carta_oferta_ver / v5 carta_oferta_responder / v4 carta_oferta_liga):
--
--  1. SOLO EL VENDEDOR responde con contrapropuesta (decisión de Dirección, 2026-11-18). El comprador
--     solo firma (acepta) o rechaza: su postura la captura Grupo Guía en MacroPro como contraoferta.
--     Antes el comprador podía contraproponer sobre una contrapropuesta del vendedor; ya no.
--
--  2. Las LIGAS NO CAMBIAN al reenviar una contrapropuesta: si el vendedor contrapropone y Grupo Guía
--     la manda al comprador (o al revés), se reutiliza la misma liga que esa persona ya tiene
--     (también la del portal /mi-oferta/) y solo se renuevan los 10 días. Antes se generaba una liga
--     nueva y la que ya tenía en su WhatsApp dejaba de servir.
--
--  3. Cuando el comprador acepta y la carta pasa sola al vendedor, el vendedor conserva su misma liga
--     (si ya tenía una), con 10 días nuevos.
--
--  4. La liga pública recibe, por ronda, quién la pidió, el plan de pago (con sus LÍNEAS) y la fecha:
--     la carta muestra la oferta original y, abajo de sus firmas, cada contraoferta con su forma de pago.
--
-- No cambia nada más: mismos estados, mismas firmas, mismo historial. Se puede correr varias veces.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1 · PÚBLICO · lo que ve la liga ──
create or replace function public.carta_oferta_ver(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.cartas_oferta; r public.cartas_oferta_rondas; rol text; exp timestamptz; vig boolean;
        puede boolean := false; contra boolean := false; rondas jsonb;
begin
  if coalesce(length(p_token), 0) < 20 then return jsonb_build_object('error', 'liga_invalida'); end if;
  select * into c from public.cartas_oferta where token_comprador = p_token;
  if found then rol := 'comprador'; exp := c.token_comprador_exp;
  else
    select * into c from public.cartas_oferta where token_vendedor = p_token;
    if found then rol := 'vendedor'; exp := c.token_vendedor_exp;
    else
      -- Liga INFORMATIVA del asesor (solo lectura): nunca puede responder ni firmar.
      select * into c from public.cartas_oferta where token_asesor = p_token;
      if not found then return jsonb_build_object('error', 'liga_invalida'); end if;
      rol := 'asesor';
      exp := case when c.estado = 'enviada_vendedor' then c.token_vendedor_exp else c.token_comprador_exp end;
    end if;
  end if;
  vig := exp is not null and exp > now();
  select * into r from public.cartas_oferta_rondas where carta_id = c.id and ronda = c.ronda_actual;
  if rol = 'comprador' then
    puede  := vig and c.estado = 'enviada_comprador' and r.comprador_firma_at is null;
    -- v8: el comprador NUNCA contrapropone desde su liga (lo captura Grupo Guía en MacroPro).
    contra := false;
  elsif rol = 'vendedor' then
    puede  := vig and c.estado = 'enviada_vendedor' and r.vendedor_firma_at is null;
    contra := puede;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'ronda', x.ronda, 'propone', x.propone, 'precio_m2', x.precio_m2, 'total', x.total,
           'forma_pago', x.forma_pago, 'condiciones', x.condiciones, 'comentarios', x.comentarios,
           -- v8: la carta pública dibuja cada contraoferta abajo de la original (líneas de pago + fecha).
           'solicita', x.solicita, 'plan_pago', x.plan_pago, 'created_at', x.created_at,
           'comprador_firmado_at', x.comprador_firma_at,
           'comprador_firma_nombre', case when rol in ('comprador','asesor') then x.comprador_firma_nombre end,
           'comprador_firma_email',  case when rol in ('comprador','asesor') then x.comprador_firma_email end,
           'comprador_firma_ip',     case when rol in ('comprador','asesor') then x.comprador_firma_ip end,
           'vendedor_firmado_at', x.vendedor_firma_at,
           'vendedor_firma_nombre',  case when rol = 'vendedor' or c.estado = 'aceptada' then x.vendedor_firma_nombre end,
           'vendedor_firma_email',   case when rol = 'vendedor' then x.vendedor_firma_email end,
           'vendedor_firma_ip',      case when rol = 'vendedor' then x.vendedor_firma_ip end
         ) order by x.ronda), '[]'::jsonb)
    into rondas from public.cartas_oferta_rondas x where x.carta_id = c.id;
  return jsonb_build_object(
    'rol', rol, 'folio', c.folio, 'asesor', c.asesor_nombre, 'estado', c.estado, 'ronda_actual', c.ronda_actual,
    'vigente', vig, 'vence', exp, 'puede_responder', puede, 'puede_contraproponer', contra,
    'terreno_nombre', c.terreno_nombre, 'terreno_ubicacion', c.terreno_ubicacion,
    'superficie_m2', c.superficie_m2, 'apartado', c.apartado, 'fecha', c.created_at,
    'comprador', case when rol in ('comprador','asesor') then nullif(concat_ws(' · ', nullif(c.comprador_nombre, ''), nullif(c.comprador_empresa, '')), '') else null end,
    'vendedor',  case when rol = 'vendedor' or c.estado = 'aceptada' then c.vendedor_nombre else null end,
    'gg_firmado_at', c.gg_firma_at,
    'rechazo_por', c.rechazo_por, 'rechazo_at', c.rechazo_at,
    'rondas', rondas);
end $$;
grant execute on function public.carta_oferta_ver(text) to anon, authenticated;

-- ── 2 · PÚBLICO · responder (aceptar · contrapropuesta · rechazar) ──
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
        -- ENVÍO AUTOMÁTICO al vendedor. v8: conserva la liga que el vendedor ya tenga (10 días nuevos).
        update public.cartas_oferta
           set estado = 'enviada_vendedor', comprador_email = coalesce(comprador_email, em),
               gg_firma_at = coalesce(gg_firma_at, now()), gg_firma_email = coalesce(gg_firma_email, 'macrolotes@grupoguia.mx'),
               token_vendedor = coalesce(token_vendedor, public._co_token()), token_vendedor_exp = now() + interval '10 days'
         where id = c.id;
      else
        update public.cartas_oferta set estado = 'firmada_comprador', comprador_email = coalesce(comprador_email, em) where id = c.id;
      end if;
    else
      update public.cartas_oferta_rondas set vendedor_firma_nombre = nom, vendedor_firma_email = em,
             vendedor_firma_at = now(), vendedor_firma_ip = ip, vendedor_firma_ua = ua where id = r.id;
      update public.cartas_oferta set estado = 'aceptada', vendedor_email = coalesce(vendedor_email, em) where id = c.id;
    end if;

  elsif p_accion = 'contrapropuesta' then
    -- v8: SOLO el vendedor contrapropone. El comprador acepta o rechaza; sus ajustes los captura Grupo Guía.
    if rol <> 'vendedor' then
      return jsonb_build_object('error', 'Para proponer otras condiciones comunícate con Grupo Guía.');
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
grant execute on function public.carta_oferta_responder(text, text, text, text, numeric, text, text, text) to anon, authenticated;

-- ── 3 · INTERNO · liga del comprador / vendedor / asesor ──
-- v8: al mandar una contrapropuesta a la otra parte se REUTILIZA su liga (10 días nuevos).
-- p_renovar = true sigue generando una liga nueva (p. ej. si la anterior se compartió por error).
create or replace function public.carta_oferta_liga(p_id uuid, p_rol text, p_renovar boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare c public.cartas_oferta; t text;
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  select * into c from public.cartas_oferta where id = p_id for update;
  if not found then raise exception 'carta no encontrada'; end if;
  if not exists (select 1 from public.cartas_oferta_rondas where carta_id = p_id and ronda = c.ronda_actual) then
    raise exception 'La carta no tiene condiciones capturadas.';
  end if;
  if p_rol = 'comprador' then
    if c.estado not in ('borrador','enviada_comprador','contrapropuesta_vendedor') then
      raise exception 'En este momento la carta no está esperando al comprador (estado: %).', c.estado;
    end if;
    if c.token_comprador is not null and c.token_comprador_exp > now() and not p_renovar and c.estado = 'enviada_comprador' then
      return c.token_comprador;
    end if;
    t := case when p_renovar then public._co_token() else coalesce(c.token_comprador, public._co_token()) end;
    update public.cartas_oferta set token_comprador = t, token_comprador_exp = now() + interval '10 days', estado = 'enviada_comprador' where id = p_id;
    return t;
  elsif p_rol = 'vendedor' then
    if c.estado not in ('autorizada','enviada_vendedor','contrapropuesta_comprador') then
      raise exception 'En este momento la carta no está lista para el vendedor (estado: %).', c.estado;
    end if;
    if coalesce(btrim(c.vendedor_nombre), '') = '' then raise exception 'Captura el nombre del vendedor.'; end if;
    if c.token_vendedor is not null and c.token_vendedor_exp > now() and not p_renovar and c.estado = 'enviada_vendedor' then
      return c.token_vendedor;
    end if;
    t := case when p_renovar then public._co_token() else coalesce(c.token_vendedor, public._co_token()) end;
    update public.cartas_oferta set token_vendedor = t, token_vendedor_exp = now() + interval '10 days', estado = 'enviada_vendedor' where id = p_id;
    return t;
  elsif p_rol = 'asesor' then
    if c.token_asesor is not null and not p_renovar then return c.token_asesor; end if;
    t := public._co_token();
    update public.cartas_oferta set token_asesor = t where id = p_id;
    return t;
  end if;
  raise exception 'rol inválido';
end $$;
revoke execute on function public.carta_oferta_liga(uuid, text, boolean) from public, anon;
grant  execute on function public.carta_oferta_liga(uuid, text, boolean) to authenticated;

-- ── Verificación (debe salir: t | t | t | t) ──
select position('contra := false' in (select prosrc from pg_proc where proname = 'carta_oferta_ver')) > 0                       as solo_vendedor_contrapropone,
       position('coalesce(token_vendedor, public._co_token())' in (select prosrc from pg_proc where proname = 'carta_oferta_responder')) > 0 as vendedor_conserva_liga,
       position('coalesce(c.token_comprador, public._co_token())' in (select prosrc from pg_proc where proname = 'carta_oferta_liga')) > 0  as ligas_se_conservan,
       position('''plan_pago'', x.plan_pago' in (select prosrc from pg_proc where proname = 'carta_oferta_ver')) > 0                as carta_muestra_lineas;
