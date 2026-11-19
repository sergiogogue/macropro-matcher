-- ════════════════════════════════════════════════════════════════════════════
-- Documentos en DOS instancias (Dirección, 2026-11-19) · MacroPro + Landing
--   1ª instancia (VIABILIDAD, se piden con la cotización): Uso de suelo, Plano,
--     Ubicación (KMZ o liga de Maps) y Fotos.
--   Complementarios (se piden ya confirmada la viabilidad): Escrituras, Libertad de
--     gravamen, INE y Predial.
-- Cambios:
--   1) sla_recalcular: el reloj del "Semáforo de viabilidad" se PAUSA solo si faltan
--      documentos de viabilidad (antes esperaba los 8). Los demás relojes, igual.
--   2) legal_estado: el expediente (/expediente/<token>) también ve los documentos que
--      llegaron por /aceptar o por la ficha del asesor (solo su tipo y estatus, sin el
--      archivo), para no pedirle al propietario algo que ya entregó.
-- Idempotente. Al final recalcula los relojes y muestra una verificación.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.sla_recalcular(p_captacion_id text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  c record; cfg record; k public.sla_controles; v_falt text[]; v_falt_todos text[]; v_now timestamptz := now();
  v_activa boolean; v_firmado boolean; v_ef numeric; v_tot numeric; v_pct numeric; v_est text; v_n int := 0;
  v_pausa_seg numeric;
begin
  for c in
    select x.id, x.pipeline, x.documentos_urls, x.liga_maps, coalesce(x.eliminado, false) as eliminado,
           (nullif(btrim(coalesce(x.firma_nombre, '')), '') is not null) as firma_local
      from public.captaciones x
     where p_captacion_id is null or x.id = p_captacion_id
  loop
    v_falt_todos := public.sla_docs_faltantes(c.documentos_urls, c.liga_maps);
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
      -- 1ª instancia: el semáforo de VIABILIDAD solo espera los 4 documentos de viabilidad;
      -- los demás procesos esperan el expediente completo.
      v_falt := case when cfg.etapa = 'semaforo'
                     then array(select x from unnest(v_falt_todos) x where x in ('Uso de suelo', 'Plano', 'Ubicación (KMZ)', 'Fotos'))
                     else v_falt_todos end;
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

create or replace function public.legal_estado(p_token uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_cap record; v json;
begin
  select id, zona, ciudad, estado, uso_suelo, superficie, pipeline,
         aprobada_publicar, publicada_lote_id, token_expira_at, documentos_urls,
         propietario, contacto
    into v_cap
    from public.captaciones where liga_token = p_token limit 1;
  if v_cap.id is null then raise exception 'Token inválido'; end if;
  select json_build_object(
    'captacion', json_build_object(
      'id', v_cap.id, 'zona', v_cap.zona, 'ciudad', v_cap.ciudad, 'estado', v_cap.estado,
      'uso_suelo', v_cap.uso_suelo, 'superficie', v_cap.superficie,
      'propietario', v_cap.propietario, 'contacto', v_cap.contacto,
      'pipeline', v_cap.pipeline, 'aprobada_publicar', v_cap.aprobada_publicar,
      'publicada_lote_id', v_cap.publicada_lote_id,
      'token_expira_at', v_cap.token_expira_at,
      'expirado', (v_cap.token_expira_at is not null and v_cap.token_expira_at < now())),
    'documentos', coalesce((
      select json_agg(json_build_object(
        -- Los que NO subió el propietario por esta liga se muestran como "subido" sin exponer su archivo.
        'id', case when e->>'origen' = 'legal' then e->>'url' end, 'tipo_documento', e->>'tipo',
        'url', case when e->>'origen' = 'legal' then e->>'url' end,
        'estatus', coalesce(e->>'estatus', 'pendiente'),
        'created_at', nullif(e->>'fecha', '')::timestamptz) order by e->>'fecha')
      from jsonb_array_elements(coalesce(v_cap.documentos_urls, '[]'::jsonb)) e
      where e->>'origen' = 'legal' or nullif(btrim(coalesce(e->>'tipo', '')), '') is not null), '[]'::json)
  ) into v;
  return v;
end $$;
grant execute on function public.legal_estado(uuid) to anon, authenticated;

-- Recalcular relojes con la regla nueva.
select public.sla_recalcular() as relojes_recalculados;

-- Verificación: semáforos abiertos y qué documentos esperan (solo deben salir de viabilidad).
select c.captacion_id, c.estado, c.docs_faltantes
  from public.sla_controles c
 where c.etapa_actual = 'semaforo' and c.fecha_fin is null
 order by c.captacion_id;
