-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Sincronización de CLIENTES por id_cliente (incluye sin correo)
-- Correr UNA VEZ en Supabase → SQL Editor, ANTES de usar la sync de clientes.
-- Idempotente y seguro (no borra datos salvo duplicados exactos por id_cliente).
-- ════════════════════════════════════════════════════════════════════

-- 1) Rellenar id_cliente donde falte: usa el correo si existe
update public.clientes
set id_cliente = lower(btrim(email))
where (id_cliente is null or btrim(id_cliente) = '')
  and email is not null and btrim(email) <> '';

-- 2) Para los que NO tienen correo: clave determinística por nombre+teléfono
--    (misma fórmula que usa la app: 'np:' + nombre en minúsculas + '|' + solo dígitos del tel)
update public.clientes
set id_cliente = 'np:' || lower(btrim(coalesce(nombre,''))) || '|' || regexp_replace(coalesce(telefono,''), '\D', '', 'g')
where (id_cliente is null or btrim(id_cliente) = '')
  and (coalesce(nombre,'') <> '' or coalesce(telefono,'') <> '');

-- 3) Si quedaron duplicados por id_cliente, conservar el de menor id (para poder crear el índice único)
delete from public.clientes a
using public.clientes b
where a.id_cliente = b.id_cliente
  and a.id_cliente is not null
  and a.id > b.id;

-- 4) Índice único: habilita el upsert por id_cliente (clave de sincronización)
create unique index if not exists clientes_id_cliente_uniq on public.clientes (id_cliente);

-- Verificación rápida (opcional):
--   select count(*) total, count(id_cliente) con_id, count(*)-count(id_cliente) sin_id from public.clientes;
