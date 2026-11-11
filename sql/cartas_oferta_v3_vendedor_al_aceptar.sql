-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v3 · el COMPRADOR ve al vendedor SOLO cuando la oferta queda ACEPTADA
-- ────────────────────────────────────────────────────────────────────
-- Requiere: sql/cartas_oferta.sql (ya corrido). Solo re-crea carta_oferta_ver:
--   · liga del VENDEDOR: igual que antes (el comprador siempre va confidencial).
--   · liga del COMPRADOR: el nombre del vendedor (y el de su firma) aparece hasta
--     que la carta está en estado 'aceptada'; antes sale "Propietario confidencial".
-- Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

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
    if not found then return jsonb_build_object('error', 'liga_invalida'); end if;
    rol := 'vendedor'; exp := c.token_vendedor_exp;
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
           'comprador_firma_nombre', case when rol = 'comprador' then x.comprador_firma_nombre end,
           'comprador_firma_email',  case when rol = 'comprador' then x.comprador_firma_email end,
           'comprador_firma_ip',     case when rol = 'comprador' then x.comprador_firma_ip end,
           'vendedor_firmado_at', x.vendedor_firma_at,
           'vendedor_firma_nombre',  case when rol = 'vendedor' or c.estado = 'aceptada' then x.vendedor_firma_nombre end,
           'vendedor_firma_email',   case when rol = 'vendedor' then x.vendedor_firma_email end,
           'vendedor_firma_ip',      case when rol = 'vendedor' then x.vendedor_firma_ip end
         ) order by x.ronda), '[]'::jsonb)
    into rondas from public.cartas_oferta_rondas x where x.carta_id = c.id;
  return jsonb_build_object(
    'rol', rol, 'folio', c.folio, 'estado', c.estado, 'ronda_actual', c.ronda_actual,
    'vigente', vig, 'vence', exp, 'puede_responder', puede, 'puede_contraproponer', contra,
    'terreno_nombre', c.terreno_nombre, 'terreno_ubicacion', c.terreno_ubicacion,
    'superficie_m2', c.superficie_m2, 'apartado', c.apartado, 'fecha', c.created_at,
    'comprador', case when rol = 'comprador' then nullif(concat_ws(' · ', nullif(c.comprador_nombre, ''), nullif(c.comprador_empresa, '')), '') else null end,
    'vendedor',  case when rol = 'vendedor' or c.estado = 'aceptada' then c.vendedor_nombre else null end,
    'gg_firmado_at', c.gg_firma_at,
    'rechazo_por', c.rechazo_por, 'rechazo_at', c.rechazo_at,
    'rondas', rondas);
end $$;

grant execute on function public.carta_oferta_ver(text) to anon, authenticated;

-- ── VERIFICACIÓN (debe salir 1 fila: carta_oferta_ver · usa estado aceptada = true) ──
select proname, position('aceptada' in prosrc) > 0 as muestra_vendedor_al_aceptar
  from pg_proc where proname = 'carta_oferta_ver';
