-- ════════════════════════════════════════════════════════════════════
-- MacroPro ↔ Landing · Sincronizar clientes de MacroPro a la landing
-- MISMA base de Supabase (proyecto xugrrabebphdelgwqnwc).
-- MacroPro escribe la tabla public.clientes (clave única: id_cliente).
-- ════════════════════════════════════════════════════════════════════

-- 0) MacroPro ahora sube también el correo del asesor dueño en clientes.asesor_email.
--    Asegura que la columna exista:
alter table public.clientes add column if not exists asesor_email text;

-- 1) Columnas relevantes de public.clientes (las que escribe MacroPro):
--    id_cliente (PK lógico), email, nombre, empresa, telefono,
--    asesor (NOMBRE del asesor), asesor_email (correo del asesor dueño),
--    tipo_comprador, ciudad_interes (text[]), uso_interes (text[]),
--    presupuesto_min, presupuesto_max, sup_min, sup_max,
--    status, plazo_cierre, deal_breakers (text[]), activo (bool).

-- 2) Sincronizar hacia landing_clientes (ajusta nombres de columna a tu esquema).
--    Routing del dueño: por asesor_email (correo) y, si falta, por nombre.
insert into public.landing_clientes
  (id_cliente, nombre, empresa, email, telefono, asesor_nombre, asesor_email, ciudad_interes, uso_interes, presupuesto_max, status, actualizado)
select
  c.id_cliente,
  c.nombre,
  c.empresa,
  c.email,
  c.telefono,
  c.asesor,
  coalesce(
    c.asesor_email,
    (select a.email from public.asesores a
       where lower(btrim(a.nombre)) = lower(btrim(c.asesor)) limit 1)
  ) as asesor_email,
  c.ciudad_interes,
  c.uso_interes,
  c.presupuesto_max,
  c.status,
  now()
from public.clientes c
where coalesce(c.activo, true) = true
on conflict (id_cliente) do update set
  nombre        = excluded.nombre,
  empresa       = excluded.empresa,
  email         = excluded.email,
  telefono      = excluded.telefono,
  asesor_nombre = excluded.asesor_nombre,
  asesor_email  = excluded.asesor_email,
  ciudad_interes= excluded.ciudad_interes,
  uso_interes   = excluded.uso_interes,
  presupuesto_max = excluded.presupuesto_max,
  status        = excluded.status,
  actualizado   = now();

-- 3) (Opcional) Automatizar: en vez de correr esto a mano, crea un trigger en
--    public.clientes que haga el mismo upsert a landing_clientes en cada INSERT/UPDATE.
--    O una vista:  create view landing_clientes_v as select ... from public.clientes;
