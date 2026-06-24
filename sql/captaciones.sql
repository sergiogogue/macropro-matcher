-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Sprint 6 · Tabla CAPTACIONES (terrenos en opcionamiento)
-- Patrón calcado de solicitudes_asesor: columnas snake_case + sync por id.
-- Correr en Supabase → SQL Editor. Idempotente (IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.captaciones (
  id                       text primary key,
  pipeline                 text default 'Ofrecido',
  fecha_creacion           timestamptz,
  fecha_ultima_actividad   timestamptz,
  asesor_responsable_gg    text,
  -- propietario / contacto
  propietario              text,
  contacto                 text,
  telefono                 text,
  email                    text,
  -- ubicación
  estado                   text,
  ciudad                   text,
  zona                     text,
  ubicacion                text,
  liga_maps                text,
  -- características del terreno
  uso_suelo                text,
  poligono                 text,
  superficie               numeric,
  frente                   numeric,
  -- comercial / acuerdo
  precio_dueno             numeric,
  precio_m2                numeric,
  tipo_acuerdo             text,
  comision                 text,
  vigencia                 text,
  -- viabilidad (semáforo)
  viabilidad               text,
  -- documentos / notas
  documentos               text,
  notas                    text,
  -- vínculo a inventario al pasar a venta
  lote_inventario_id       text,
  -- control de sync (borrado lógico + last-write-wins)
  eliminado                boolean default false,
  fecha_eliminacion        timestamptz,
  updated_at               timestamptz default now(),
  created_at               timestamptz default now()
);

-- ── RLS: logueado = acceso total; sin login = nada (decisión de producto: 3 usuarios, todos ven/editan todo) ──
alter table public.captaciones enable row level security;

drop policy if exists captaciones_auth_all on public.captaciones;
create policy captaciones_auth_all
  on public.captaciones
  for all
  to authenticated
  using (true)
  with check (true);
