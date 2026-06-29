-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Historial de OFERTAS cliente↔lote (ofrecido / análisis / descartado)
-- Sync por registro (id = clave cliente+lote). Correr en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.ofertas (
  id                text primary key,   -- cKey || "||" || loteKey
  c_key             text,               -- identidad del cliente (id o n:nombre)
  cliente_nombre    text,
  lote_id           text,               -- loteKey normalizado
  lote_nombre       text,
  estado            text,
  motivo            text,               -- catálogo (precio alto, ubicación, etc.)
  obs               text,               -- observación libre del descarte               -- razón del descarte (precio alto, ubicación, etc.)               -- 'ofrecido' | 'analisis' | 'descartado'
  fecha             date,
  eliminado         boolean default false,
  updated_at        timestamptz default now(),
  created_at        timestamptz default now()
);

-- Índices de apoyo para consultas por cliente o por lote
create index if not exists ofertas_c_key_idx on public.ofertas (c_key);
create index if not exists ofertas_lote_id_idx on public.ofertas (lote_id);

-- RLS: logueado = acceso total; sin login = nada (3 usuarios, todos ven/editan)
alter table public.ofertas enable row level security;
drop policy if exists ofertas_auth_all on public.ofertas;
create policy ofertas_auth_all
  on public.ofertas
  for all
  to authenticated
  using (true)
  with check (true);
