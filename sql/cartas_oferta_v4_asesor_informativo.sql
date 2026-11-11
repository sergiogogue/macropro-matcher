-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v4 · liga INFORMATIVA para el ASESOR (solo lectura)
-- ────────────────────────────────────────────────────────────────────
-- Requiere: cartas_oferta.sql, v2 y v3 (ya corridos).
--   · token_asesor: tercera liga, para el asesor que trajo al comprador. Ve la carta
--     como el comprador (el vendedor sigue confidencial hasta que se acepte), pero
--     NUNCA puede responder ni firmar: carta_oferta_responder solo acepta las ligas
--     del comprador y del vendedor (con la del asesor devuelve "liga_invalida").
--   · carta_oferta_liga(id, 'asesor') genera/reusa esa liga (solo admins).
-- Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

alter table public.cartas_oferta add column if not exists token_asesor text unique;

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
    t := public._co_token();
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
    t := public._co_token();
    update public.cartas_oferta set token_vendedor = t, token_vendedor_exp = now() + interval '10 days', estado = 'enviada_vendedor' where id = p_id;
    return t;
  elsif p_rol = 'asesor' then
    -- Liga INFORMATIVA del asesor: solo lectura, en cualquier estado, sin vencimiento.
    if c.token_asesor is not null and not p_renovar then return c.token_asesor; end if;
    t := public._co_token();
    update public.cartas_oferta set token_asesor = t where id = p_id;
    return t;
  end if;
  raise exception 'rol inválido';
end $$;

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
    contra := puede and r.propone = 'vendedor';
  else
    puede  := vig and c.estado = 'enviada_vendedor' and r.vendedor_firma_at is null;
    contra := puede;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'ronda', x.ronda, 'propone', x.propone, 'precio_m2', x.precio_m2, 'total', x.total,
           'forma_pago', x.forma_pago, 'condiciones', x.condiciones, 'comentarios', x.comentarios,
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

revoke execute on function public.carta_oferta_liga(uuid, text, boolean) from public, anon;
grant  execute on function public.carta_oferta_liga(uuid, text, boolean) to authenticated;
grant  execute on function public.carta_oferta_ver(text) to anon, authenticated;

-- ── VERIFICACIÓN (debe salir: token_asesor | true | true) ──
select (select column_name from information_schema.columns where table_schema='public' and table_name='cartas_oferta' and column_name='token_asesor') as columna,
       (select position('asesor' in prosrc) > 0 from pg_proc where proname='carta_oferta_liga') as liga_asesor,
       (select position('token_asesor' in prosrc) > 0 from pg_proc where proname='carta_oferta_ver') as ver_asesor;
