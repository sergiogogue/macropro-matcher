-- ════════════════════════════════════════════════════════════════════
-- CARTAS OFERTA · Grupo Guía → Comprador → Grupo Guía → Vendedor (con contrapropuestas)
-- ────────────────────────────────────────────────────────────────────
-- Un REGISTRO por carta (ligado al terreno de Captación) y una fila por RONDA de
-- negociación. Ninguna ronda pisa a la anterior. Firmas electrónicas con fecha,
-- hora, IP y navegador (los toma el servidor, no el navegador).
--
--   Interno (MacroPro, solo admins · landing_es_admin):
--     tablas por RLS + carta_oferta_liga()  → genera/reusa la liga (10 días)
--                    + carta_oferta_autorizar() → firma de Grupo Guía + datos del vendedor
--   Público (liga sin cuenta, /oferta/<token> en macrolotes.grupoguia.mx):
--     carta_oferta_ver(token)        → lo que ve ESE rol (la otra parte va confidencial)
--     carta_oferta_responder(token…) → aceptar · contrapropuesta · rechazar
--
-- El APARTADO lo pone Grupo Guía al crear la carta; nadie lo cambia después.
-- Idempotente. Correr COMPLETO en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

create sequence if not exists public.cartas_oferta_folio_seq;

create table if not exists public.cartas_oferta (
  id                  uuid primary key default gen_random_uuid(),
  folio               text unique,
  captacion_id        text,
  lote_id             text,
  terreno_nombre      text not null,
  terreno_ubicacion   text,
  superficie_m2       numeric not null check (superficie_m2 > 0),
  apartado            numeric not null default 0 check (apartado >= 0),
  comprador_nombre    text,
  comprador_empresa   text,
  comprador_email     text,
  comprador_telefono  text,
  vendedor_nombre     text,
  vendedor_email      text,
  vendedor_telefono   text,
  asesor_nombre       text,
  estado              text not null default 'borrador' check (estado in (
                        'borrador','enviada_comprador','firmada_comprador','autorizada',
                        'enviada_vendedor','contrapropuesta_vendedor','contrapropuesta_comprador',
                        'aceptada','rechazada')),
  ronda_actual        int  not null default 1,
  token_comprador     text unique,
  token_comprador_exp timestamptz,
  token_vendedor      text unique,
  token_vendedor_exp  timestamptz,
  gg_firma_email      text,
  gg_firma_at         timestamptz,
  gg_firma_ip         text,
  rechazo_por         text,
  rechazo_motivo      text,
  rechazo_at          timestamptz,
  rechazo_ip          text,
  creado_por          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_cartas_oferta_captacion on public.cartas_oferta (captacion_id);

create table if not exists public.cartas_oferta_rondas (
  id                     uuid primary key default gen_random_uuid(),
  carta_id               uuid not null references public.cartas_oferta(id) on delete cascade,
  ronda                  int  not null,
  propone                text not null check (propone in ('grupo_guia','vendedor','comprador')),
  precio_m2              numeric not null check (precio_m2 > 0),
  total                  numeric,
  forma_pago             text not null check (forma_pago in ('Contado','Financiamiento','Diferido')),
  condiciones            text,
  comentarios            text,
  comprador_firma_nombre text, comprador_firma_email text, comprador_firma_at timestamptz,
  comprador_firma_ip     text, comprador_firma_ua text,
  vendedor_firma_nombre  text, vendedor_firma_email text, vendedor_firma_at timestamptz,
  vendedor_firma_ip      text, vendedor_firma_ua text,
  created_at             timestamptz not null default now(),
  unique (carta_id, ronda)
);

-- ── Folio CO-AAAA-0001 y updated_at ──
create or replace function public._co_folio() returns trigger language plpgsql as $$
begin
  if new.folio is null then
    new.folio := 'CO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.cartas_oferta_folio_seq')::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_co_folio on public.cartas_oferta;
create trigger trg_co_folio before insert on public.cartas_oferta for each row execute function public._co_folio();

-- Superficie y apartado se congelan en cuanto la carta sale de borrador.
create or replace function public._co_guardia() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if old.estado <> 'borrador' and (new.superficie_m2 is distinct from old.superficie_m2 or new.apartado is distinct from old.apartado) then
    raise exception 'La superficie y el apartado ya no se pueden cambiar: la carta ya se envió.';
  end if;
  return new;
end $$;
drop trigger if exists trg_co_guardia on public.cartas_oferta;
create trigger trg_co_guardia before update on public.cartas_oferta for each row execute function public._co_guardia();

-- Total = superficie × precio por m² (siempre en el servidor). Una ronda firmada no cambia.
create or replace function public._co_ronda() returns trigger language plpgsql as $$
declare s numeric;
begin
  select superficie_m2 into s from public.cartas_oferta where id = new.carta_id;
  new.total := round(coalesce(s, 0) * new.precio_m2, 2);
  if tg_op = 'UPDATE' and (old.comprador_firma_at is not null or old.vendedor_firma_at is not null)
     and (new.precio_m2 is distinct from old.precio_m2 or new.forma_pago is distinct from old.forma_pago
          or new.condiciones is distinct from old.condiciones) then
    raise exception 'Esta ronda ya está firmada: sus condiciones no se pueden cambiar.';
  end if;
  return new;
end $$;
drop trigger if exists trg_co_ronda on public.cartas_oferta_rondas;
create trigger trg_co_ronda before insert or update on public.cartas_oferta_rondas for each row execute function public._co_ronda();

-- ── RLS: solo admins (los asesores del landing comparten este Supabase) ──
alter table public.cartas_oferta enable row level security;
alter table public.cartas_oferta_rondas enable row level security;
drop policy if exists cartas_oferta_admin on public.cartas_oferta;
create policy cartas_oferta_admin on public.cartas_oferta for all to authenticated
  using (landing_es_admin()) with check (landing_es_admin());
drop policy if exists cartas_oferta_rondas_admin on public.cartas_oferta_rondas;
create policy cartas_oferta_rondas_admin on public.cartas_oferta_rondas for all to authenticated
  using (landing_es_admin()) with check (landing_es_admin());
grant select, insert, update, delete on public.cartas_oferta, public.cartas_oferta_rondas to authenticated;
grant usage on sequence public.cartas_oferta_folio_seq to authenticated;

-- ── IP y navegador de quien firma (cabeceras de la petición, del lado del servidor) ──
create or replace function public._co_ip() returns text language sql stable as $$
  select nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1)), '')
$$;
create or replace function public._co_ua() returns text language sql stable as $$
  select left(coalesce(nullif(current_setting('request.headers', true), '')::json->>'user-agent', ''), 300)
$$;
create or replace function public._co_token() returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- ── INTERNO · liga para el comprador o el vendedor (vigencia 10 días) ──
-- Reusa la liga vigente (copiarla dos veces no invalida la que ya mandaste);
-- p_renovar = true genera una nueva (p. ej. si venció).
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
  end if;
  raise exception 'rol inválido';
end $$;

-- ── INTERNO · firma de Grupo Guía (autorizado) + datos del vendedor ──
create or replace function public.carta_oferta_autorizar(p_id uuid, p_vendedor_nombre text, p_vendedor_email text default null, p_vendedor_telefono text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare c public.cartas_oferta;
begin
  if not landing_es_admin() then raise exception 'no autorizado'; end if;
  select * into c from public.cartas_oferta where id = p_id for update;
  if not found then raise exception 'carta no encontrada'; end if;
  if c.estado <> 'firmada_comprador' then raise exception 'Primero debe firmar el comprador (estado: %).', c.estado; end if;
  if coalesce(btrim(p_vendedor_nombre), '') = '' then raise exception 'Captura el nombre del vendedor.'; end if;
  update public.cartas_oferta
     set vendedor_nombre = btrim(p_vendedor_nombre),
         vendedor_email = nullif(lower(btrim(coalesce(p_vendedor_email, ''))), ''),
         vendedor_telefono = nullif(btrim(coalesce(p_vendedor_telefono, '')), ''),
         gg_firma_email = lower(auth.jwt() ->> 'email'), gg_firma_at = now(), gg_firma_ip = public._co_ip(),
         estado = 'autorizada'
   where id = p_id;
end $$;

-- ── PÚBLICO · lo que ve la liga (la otra parte va CONFIDENCIAL) ──
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
           'vendedor_firma_nombre',  case when rol = 'vendedor' then x.vendedor_firma_nombre end,
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
    'vendedor',  case when rol = 'vendedor'  then c.vendedor_nombre else null end,
    'gg_firmado_at', c.gg_firma_at,
    'rechazo_por', c.rechazo_por, 'rechazo_at', c.rechazo_at,
    'rondas', rondas);
end $$;

-- ── PÚBLICO · responder: aceptar · contrapropuesta · rechazar ──
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
      update public.cartas_oferta set estado = case when r.propone = 'vendedor' then 'aceptada' else 'firmada_comprador' end,
             comprador_email = coalesce(comprador_email, em) where id = c.id;
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

revoke execute on function public.carta_oferta_liga(uuid, text, boolean) from public, anon;
grant  execute on function public.carta_oferta_liga(uuid, text, boolean) to authenticated;
revoke execute on function public.carta_oferta_autorizar(uuid, text, text, text) from public, anon;
grant  execute on function public.carta_oferta_autorizar(uuid, text, text, text) to authenticated;
grant  execute on function public.carta_oferta_ver(text) to anon, authenticated;
grant  execute on function public.carta_oferta_responder(text, text, text, text, numeric, text, text, text) to anon, authenticated;
revoke execute on function public._co_token() from public, anon;

-- ── VERIFICACIÓN (debe salir 2 tablas y 4 funciones) ──
select 'tabla' as tipo, table_name as nombre from information_schema.tables
 where table_schema = 'public' and table_name in ('cartas_oferta','cartas_oferta_rondas')
union all
select 'funcion', proname from pg_proc
 where proname in ('carta_oferta_liga','carta_oferta_autorizar','carta_oferta_ver','carta_oferta_responder');
