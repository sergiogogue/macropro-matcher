-- ════════════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA v9 · ACEPTACIÓN DEL VENDEDOR REGISTRADA POR GRUPO GUÍA (Dirección, 2026-11-23)
-- Cuando el vendedor acepta por WhatsApp o correo (no en su liga), un ADMIN lo registra en MacroPro con
-- una CAPTURA como evidencia (obligatoria). Queda como "Aceptación registrada por Grupo Guía", NUNCA como
-- firma electrónica: se guarda quién la registró, cuándo, el nombre de quien aceptó, la nota y la captura.
-- La carta queda ACEPTADA y sigue el flujo normal (solicitud de documentos al comprador, etc.).
--   · cartas_oferta_rondas: vendedor_acepto_via ('grupo_guia'), vendedor_evidencia (jsonb), vendedor_registro_por, vendedor_nota
--   · bucket PRIVADO cartas-evidencias (solo admins)
--   · RPC carta_oferta_aceptar_vendedor(p_id, p_nombre, p_evidencia, p_nota)
--   · carta_oferta_ver: además entrega vendedor_acepto_via (para que la carta lo diga así)
-- Requiere cartas_oferta.sql … v8. Idempotente.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.cartas_oferta_rondas add column if not exists vendedor_acepto_via   text;
alter table public.cartas_oferta_rondas add column if not exists vendedor_evidencia    jsonb;
alter table public.cartas_oferta_rondas add column if not exists vendedor_registro_por text;
alter table public.cartas_oferta_rondas add column if not exists vendedor_nota         text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('cartas-evidencias', 'cartas-evidencias', false, 10485760)
on conflict (id) do update set public = false;
drop policy if exists "cartas_evid_admin_sel" on storage.objects;
create policy "cartas_evid_admin_sel" on storage.objects for select using (bucket_id = 'cartas-evidencias' and landing_es_admin());
drop policy if exists "cartas_evid_admin_ins" on storage.objects;
create policy "cartas_evid_admin_ins" on storage.objects for insert with check (bucket_id = 'cartas-evidencias' and landing_es_admin());

create or replace function public.carta_oferta_aceptar_vendedor(p_id uuid, p_nombre text, p_evidencia jsonb, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare c public.cartas_oferta; r public.cartas_oferta_rondas; quien text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  if p_evidencia is null or coalesce(btrim(p_evidencia ->> 'path'), '') = '' then
    return jsonb_build_object('error', 'Sube la captura de la respuesta del vendedor (es la evidencia).');
  end if;
  select * into c from public.cartas_oferta where id = p_id for update;
  if not found then return jsonb_build_object('error', 'Carta no encontrada.'); end if;
  if c.estado not in ('enviada_vendedor', 'firmada_comprador', 'autorizada') then
    return jsonb_build_object('error', 'En este momento la carta no está esperando al vendedor (estado: ' || c.estado || ').');
  end if;
  select * into r from public.cartas_oferta_rondas where carta_id = c.id and ronda = c.ronda_actual for update;
  if not found then return jsonb_build_object('error', 'La carta no tiene la ronda vigente.'); end if;
  if r.vendedor_firma_at is not null then return jsonb_build_object('error', 'El vendedor ya había aceptado esta ronda.'); end if;
  if r.comprador_firma_at is null then return jsonb_build_object('error', 'El comprador aún no firma esta ronda.'); end if;
  update public.cartas_oferta_rondas
     set vendedor_firma_at = now(), vendedor_firma_nombre = nullif(left(btrim(coalesce(p_nombre, c.vendedor_nombre, '')), 160), ''),
         vendedor_firma_ip = _co_ip(), vendedor_firma_ua = _co_ua(),
         vendedor_acepto_via = 'grupo_guia', vendedor_evidencia = p_evidencia,
         vendedor_registro_por = quien, vendedor_nota = nullif(left(btrim(coalesce(p_nota, '')), 500), '')
   where id = r.id;
  update public.cartas_oferta set estado = 'aceptada' where id = c.id;
  return jsonb_build_object('ok', true, 'ronda', r.ronda, 'registro_por', quien);
end $$;
revoke execute on function public.carta_oferta_aceptar_vendedor(uuid, text, jsonb, text) from public;
grant execute on function public.carta_oferta_aceptar_vendedor(uuid, text, jsonb, text) to authenticated;

-- ── La carta pública dice "aceptación registrada por Grupo Guía" (no "firmado electrónicamente") ──
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
           'vendedor_firma_ip',      case when rol = 'vendedor' then x.vendedor_firma_ip end,
           -- v9: aceptación del vendedor REGISTRADA por Grupo Guía (respondió por WhatsApp/correo) — no es firma electrónica.
           'vendedor_acepto_via',    x.vendedor_acepto_via
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

-- Verificación
select 'columnas nuevas' as que, count(*)::text as valor from information_schema.columns where table_name = 'cartas_oferta_rondas' and column_name in ('vendedor_acepto_via','vendedor_evidencia','vendedor_registro_por','vendedor_nota')
union all select 'bucket cartas-evidencias', count(*)::text from storage.buckets where id = 'cartas-evidencias'
union all select 'función carta_oferta_aceptar_vendedor', count(*)::text from pg_proc where proname = 'carta_oferta_aceptar_vendedor';
