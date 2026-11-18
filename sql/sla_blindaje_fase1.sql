-- ════════════════════════════════════════════════════════════════════════════
-- SLA + BLINDAJE · FASE 1 (base de datos) · 2026-11-18
--
-- Mide el tiempo de cada proceso que Grupo Guía promete en la presentación de valor y
-- PAUSA el reloj mientras el expediente del opcionador (8 documentos) no esté al 100%.
--
--   sla_config     → los SLA prometidos (horas) y en qué momento arranca cada reloj.
--   sla_controles  → un reloj por captación y proceso: inicio, límite, estado, pausa.
--   sla_docs_faltantes(docs) → qué documentos faltan (misma regla que los recordatorios).
--   sla_recalcular(captacion_id | null) → arranca / pausa / reanuda / cierra relojes y
--                    calcula el estado. Lo llama un trigger al cambiar la tarjeta y el cron.
--   sla_tablero()  → lo que pinta MacroPro (🟢 🟡 🔴 ⏸️) con % y horas restantes.
--
-- Reglas:
--   · El reloj arranca cuando la tarjeta ENTRA a la etapa (trigger sobre captaciones).
--   · REGLA DE ORO: si faltan documentos del expediente → estado 'pausado' y el tiempo NO
--     corre (se suma a segundos_pausados y la fecha límite se recorre lo mismo).
--   · ≥ 75 % del tiempo efectivo → 'advertencia'; ≥ 100 % → 'vencido'.
--   · Al salir de la etapa (o al cumplirse el entregable) el reloj se cierra: 'cumplido'
--     (o 'cumplido_tarde' si ya estaba vencido) → evidencia para no recibir reclamos.
--   · Tarjetas que YA estaban en una etapa al correr esto arrancan hoy (sin castigo retroactivo).
-- Idempotente: se puede correr varias veces. Al final, una consulta de verificación.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Configuración de los SLA prometidos ─────────────────────────────────
create table if not exists public.sla_config (
  etapa           text primary key,                 -- clave del proceso
  nombre          text not null,                    -- cómo se muestra
  horas           int  not null check (horas > 0),  -- tiempo prometido
  inicia_con      text not null,                    -- 'pipeline:<etapa del Kanban>' | 'firmado'
  termina_con     text,                             -- 'sale_de_etapa' | 'pipeline:<etapa>' | null (cierre manual)
  activo          boolean not null default true,
  orden           int not null default 0,
  actualizado_at  timestamptz not null default now()
);

-- Valores prometidos. Mapeo PROPUESTO a las etapas reales del Kanban de captación
-- (Nueva opción → Viabilidad → … → Documentación → Contrato → Firmado). Se ajusta con un
-- UPDATE a sla_config, sin tocar código.
insert into public.sla_config (etapa, nombre, horas, inicia_con, termina_con, orden) values
  ('semaforo',     'Semáforo de viabilidad',   48, 'pipeline:Viabilidad',    'sale_de_etapa', 1),
  ('legal',        'Envío a Legal',            48, 'pipeline:Documentación', 'sale_de_etapa', 2),
  ('contrato',     'Contrato / Publicación',   72, 'pipeline:Contrato',      'sale_de_etapa', 3),
  ('estudios',     'Estudios / Buyer Persona', 48, 'firmado',                null,            4),
  ('fotografia',   'Fotografía / Material',   120, 'firmado',                null,            5)
on conflict (etapa) do nothing;

-- ── 2) Relojes ──────────────────────────────────────────────────────────────
create table if not exists public.sla_controles (
  id                  uuid primary key default gen_random_uuid(),
  captacion_id        text not null,
  etapa_actual        text not null references public.sla_config(etapa),
  fecha_inicio        timestamptz not null default now(),
  fecha_limite        timestamptz not null,
  fecha_fin           timestamptz,                         -- cuando se cumplió / salió de la etapa
  estado              text not null default 'en_tiempo'
                      check (estado in ('en_tiempo', 'advertencia', 'vencido', 'pausado', 'cumplido', 'cumplido_tarde', 'cancelado')),
  motivo_pausa        text,
  pausado_desde       timestamptz,                         -- pausa en curso
  segundos_pausados   bigint not null default 0,           -- pausas ya cerradas
  docs_faltantes      text[] not null default '{}',
  pct                 numeric(6,1) not null default 0,     -- % del tiempo efectivo consumido
  alerta_75_at        timestamptz,                         -- para que el cron avise UNA vez
  alerta_100_at       timestamptz,
  creado_at           timestamptz not null default now(),
  actualizado_at      timestamptz not null default now(),
  unique (captacion_id, etapa_actual)
);
-- (si la tabla ya existía con la lista anterior de estados, se actualiza la regla)
do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid = 'public.sla_controles'::regclass and contype = 'c'
            and pg_get_constraintdef(oid) ilike '%en_tiempo%' and pg_get_constraintdef(oid) not ilike '%cancelado%'
  loop execute format('alter table public.sla_controles drop constraint %I', r.conname);
       alter table public.sla_controles add constraint sla_controles_estado_check
         check (estado in ('en_tiempo', 'advertencia', 'vencido', 'pausado', 'cumplido', 'cumplido_tarde', 'cancelado'));
  end loop;
end $$;
create index if not exists ix_sla_abiertos on public.sla_controles (estado) where fecha_fin is null;
create index if not exists ix_sla_captacion on public.sla_controles (captacion_id);

-- ── 3) Expediente del opcionador: los 8 documentos ──────────────────────────
-- Misma regla que los recordatorios (netlify/lib/recordatorios-amarillos.mjs, DOCS_PROPIETARIO):
-- un documento cuenta si su "tipo" coincide y su estatus NO es 'rechazado'.
-- p_liga_maps: la UBICACIÓN también cuenta con la liga de Google Maps de la captación (como en el
-- convenio: "liga de Google Maps / Earth o KMZ").
drop function if exists public.sla_docs_faltantes(jsonb);
create or replace function public.sla_docs_faltantes(p_docs jsonb, p_liga_maps text default null)
returns text[] language sql immutable as $$
  with req(nombre, patron, orden) as (values
    ('Escrituras',            'escritura',                                         1),
    ('Uso de suelo',          'uso de suelo|usos y destinos|trazos|dictamen de autorizacion', 2),
    ('Libertad de gravamen',  'gravamen',                                          3),
    ('INE',                   '(^|[^a-z])ine([^a-z]|$)|identificacion|instituto nacional electoral', 4),
    ('Plano',                 'plano|levantamiento|medicion',                      5),
    ('Predial',               'predial',                                           6),
    ('Ubicación (KMZ)',       'kmz|kml|ubicacion',                                 7),
    ('Fotos',                 'foto|photo|fachada|interior|whatsapp image|\.(jpe?g|png|jfif|heic|webp)$', 8)),
  docs as (
    -- Si el documento no trae "tipo", se clasifica por su nombre o por el nombre del archivo.
    select lower(translate(coalesce(nullif(btrim(d->>'tipo'), ''), nullif(btrim(d->>'nombre'), ''),
                                    regexp_replace(coalesce(d->>'url', ''), '^.*/', '')),
                           'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) as tipo,
           lower(coalesce(d->>'estatus', '')) as estatus
      from jsonb_array_elements(case when jsonb_typeof(p_docs) = 'array' then p_docs else '[]'::jsonb end) d)
  select coalesce(array_agg(r.nombre order by r.orden), '{}')
    from req r
   where not exists (select 1 from docs where docs.tipo ~ r.patron and docs.estatus <> 'rechazado')
     and not (r.orden = 7 and coalesce(p_liga_maps, '') ~* '^https?://\S*(google\.[a-z.]+/maps|maps\.app\.goo\.gl|goo\.gl/maps|maps\.google|earth\.google)');
$$;

-- ── 4) Motor: arrancar · pausar · reanudar · cerrar · calcular estado ────────
create or replace function public.sla_recalcular(p_captacion_id text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  c record; cfg record; k public.sla_controles; v_falt text[]; v_now timestamptz := now();
  v_activa boolean; v_firmado boolean; v_ef numeric; v_tot numeric; v_pct numeric; v_est text; v_n int := 0;
  v_pausa_seg numeric;
begin
  for c in
    select x.id, x.pipeline, x.documentos_urls, x.liga_maps, coalesce(x.eliminado, false) as eliminado,
           (nullif(btrim(coalesce(x.firma_nombre, '')), '') is not null) as firma_local
      from public.captaciones x
     where p_captacion_id is null or x.id = p_captacion_id
  loop
    v_falt := public.sla_docs_faltantes(c.documentos_urls, c.liga_maps);
    -- ¿Convenio firmado? (en la captación o en su acuerdo de comisión)
    v_firmado := c.firma_local;
    if not v_firmado then
      begin
        select exists (select 1 from public.acuerdos_comision a
                        where a.captacion_id = c.id and a.estado in ('firmado', 'validado', 'forzado_6040'))
          into v_firmado;
      exception when undefined_table then v_firmado := false; end;
    end if;

    for cfg in select * from public.sla_config where activo loop
      -- ¿Este proceso aplica ahora a la tarjeta?
      v_activa := not c.eliminado and coalesce(c.pipeline, '') <> 'Descartado' and (
                    (cfg.inicia_con like 'pipeline:%' and c.pipeline = substr(cfg.inicia_con, 10))
                 or (cfg.inicia_con = 'firmado' and v_firmado));

      select * into k from public.sla_controles where captacion_id = c.id and etapa_actual = cfg.etapa;

      -- Arranca el reloj al entrar a la etapa.
      if k.id is null then
        if not v_activa then continue; end if;
        insert into public.sla_controles (captacion_id, etapa_actual, fecha_inicio, fecha_limite)
        values (c.id, cfg.etapa, v_now, v_now + make_interval(hours => cfg.horas))
        returning * into k;
      end if;
      if k.fecha_fin is not null then continue; end if;   -- ya cerrado: es evidencia, no se toca

      -- Cierre: salió de la etapa (o la tarjeta se descartó/eliminó).
      if not v_activa and (cfg.termina_con = 'sale_de_etapa' or c.eliminado or coalesce(c.pipeline, '') = 'Descartado') then
        update public.sla_controles
           set fecha_fin = v_now,
               segundos_pausados = segundos_pausados + case when pausado_desde is not null then extract(epoch from v_now - pausado_desde)::bigint else 0 end,
               pausado_desde = null,
               -- Descartada/eliminada = CANCELADO (no es entrega); salió de la etapa = cumplido.
               estado = case when c.eliminado or coalesce(c.pipeline, '') = 'Descartado' then 'cancelado'
                             when estado = 'vencido' or v_now > fecha_limite then 'cumplido_tarde' else 'cumplido' end,
               actualizado_at = v_now
         where id = k.id;
        v_n := v_n + 1; continue;
      end if;
      if cfg.termina_con like 'pipeline:%' and c.pipeline = substr(cfg.termina_con, 10) then
        update public.sla_controles set fecha_fin = v_now,
               estado = case when v_now > fecha_limite then 'cumplido_tarde' else 'cumplido' end, actualizado_at = v_now
         where id = k.id;
        v_n := v_n + 1; continue;
      end if;

      -- REGLA DE ORO: expediente incompleto → pausa; completo → reanuda.
      if array_length(v_falt, 1) > 0 then
        if k.pausado_desde is null then k.pausado_desde := v_now; end if;
      elsif k.pausado_desde is not null then
        k.segundos_pausados := k.segundos_pausados + extract(epoch from v_now - k.pausado_desde)::bigint;
        k.pausado_desde := null;
      end if;

      -- Tiempo efectivo (sin pausas) y estado.
      v_pausa_seg := k.segundos_pausados + case when k.pausado_desde is not null then extract(epoch from v_now - k.pausado_desde) else 0 end;
      v_tot := cfg.horas * 3600.0;
      v_ef  := greatest(0, extract(epoch from v_now - k.fecha_inicio) - v_pausa_seg);
      v_pct := round(least(999, v_ef / v_tot * 100)::numeric, 1);
      v_est := case when k.pausado_desde is not null then 'pausado'
                    when v_pct >= 100 then 'vencido'
                    when v_pct >= 75 then 'advertencia'
                    else 'en_tiempo' end;

      update public.sla_controles
         set pausado_desde = k.pausado_desde,
             segundos_pausados = k.segundos_pausados,
             fecha_limite = k.fecha_inicio + make_interval(hours => cfg.horas) + make_interval(secs => v_pausa_seg),
             estado = v_est,
             motivo_pausa = case when v_est = 'pausado' then 'Faltan documentos del expediente: ' || array_to_string(v_falt, ', ') else null end,
             docs_faltantes = v_falt,
             pct = v_pct,
             actualizado_at = v_now
       where id = k.id;
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end; $$;

-- ── 5) Trigger: el reloj arranca / se pausa en el momento exacto del cambio ──
create or replace function public.sla_trg_captacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.pipeline is distinct from old.pipeline
     or new.documentos_urls is distinct from old.documentos_urls
     or new.liga_maps is distinct from old.liga_maps
     or new.firma_nombre is distinct from old.firma_nombre
     or new.eliminado is distinct from old.eliminado then
    begin
      perform public.sla_recalcular(new.id);
    exception when others then
      raise warning 'SLA: no se pudo recalcular %: %', new.id, sqlerrm;   -- nunca bloquea guardar la tarjeta
    end;
  end if;
  return new;
end; $$;
drop trigger if exists trg_sla_captacion on public.captaciones;
create trigger trg_sla_captacion after insert or update on public.captaciones
  for each row execute function public.sla_trg_captacion();

-- ── 6) Lo que pinta MacroPro ────────────────────────────────────────────────
-- Recalcula y devuelve los relojes ABIERTOS (y los cerrados de los últimos 30 días).
create or replace function public.sla_tablero(p_captacion_id text default null)
returns table (captacion_id text, etapa text, nombre text, horas int, estado text, semaforo text,
               pct numeric, horas_restantes numeric, fecha_inicio timestamptz, fecha_limite timestamptz,
               fecha_fin timestamptz, motivo_pausa text, docs_faltantes text[])
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  perform public.sla_recalcular(p_captacion_id);
  return query
    select s.captacion_id, s.etapa_actual, g.nombre, g.horas, s.estado,
           case s.estado when 'en_tiempo' then '🟢' when 'advertencia' then '🟡' when 'vencido' then '🔴'
                         when 'pausado' then '⏸️' when 'cumplido' then '✅' when 'cancelado' then '✖️' else '☑️' end,
           s.pct,
           case when s.fecha_fin is null and s.estado <> 'pausado'
                then round((extract(epoch from s.fecha_limite - now()) / 3600.0)::numeric, 1) end,
           s.fecha_inicio, s.fecha_limite, s.fecha_fin, s.motivo_pausa, s.docs_faltantes
      from public.sla_controles s join public.sla_config g on g.etapa = s.etapa_actual
     where (p_captacion_id is null or s.captacion_id = p_captacion_id)
       and (s.fecha_fin is null or s.fecha_fin > now() - interval '30 days')
     order by case s.estado when 'vencido' then 0 when 'advertencia' then 1 when 'pausado' then 2 when 'en_tiempo' then 3 else 4 end,
              s.fecha_limite;
end; $$;

-- Marcar como CUMPLIDO un entregable que no depende del Kanban (Fotografía, Estudios…).
create or replace function public.sla_cumplir(p_captacion_id text, p_etapa text)
returns text language plpgsql security definer set search_path = public as $$
declare v_est text;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  update public.sla_controles
     set fecha_fin = now(),
         segundos_pausados = segundos_pausados + case when pausado_desde is not null then extract(epoch from now() - pausado_desde)::bigint else 0 end,
         pausado_desde = null,
         estado = case when estado = 'vencido' or now() > fecha_limite then 'cumplido_tarde' else 'cumplido' end,
         actualizado_at = now()
   where captacion_id = p_captacion_id and etapa_actual = p_etapa and fecha_fin is null
  returning estado into v_est;
  if v_est is null then raise exception 'No hay un reloj abierto de % para esa captación.', p_etapa; end if;
  return v_est;
end; $$;

-- ── 7) Acceso: solo usuarios con sesión (los 3 de confianza ven todo) ───────
alter table public.sla_config    enable row level security;
alter table public.sla_controles enable row level security;
drop policy if exists sla_config_leer on public.sla_config;
create policy sla_config_leer on public.sla_config for select to authenticated using (true);
drop policy if exists sla_controles_leer on public.sla_controles;
create policy sla_controles_leer on public.sla_controles for select to authenticated using (true);
revoke all on function public.sla_recalcular(text) from public, anon;
grant execute on function public.sla_recalcular(text) to authenticated, service_role;
revoke all on function public.sla_tablero(text) from public, anon;
grant execute on function public.sla_tablero(text) to authenticated, service_role;
revoke all on function public.sla_trg_captacion() from public, anon, authenticated;
revoke all on function public.sla_cumplir(text, text) from public, anon;
grant execute on function public.sla_cumplir(text, text) to authenticated, service_role;

-- ── 8) Arranque: relojes para las tarjetas que hoy ya están en una etapa ──────
select public.sla_recalcular(null) as relojes_procesados;

-- ── 9) Verificación ──────────────────────────────────────────────────────────
select
  (select count(*) from public.sla_config where activo)                              as procesos_sla,       -- 5
  (select count(*) from public.sla_controles where fecha_fin is null)                as relojes_abiertos,
  (select count(*) from public.sla_controles where estado = 'pausado')               as pausados_por_docs,
  (select count(*) from public.sla_controles where estado in ('advertencia','vencido')) as en_riesgo,
  (select count(*) from pg_trigger where tgname = 'trg_sla_captacion')               as trigger_activo;     -- 1
