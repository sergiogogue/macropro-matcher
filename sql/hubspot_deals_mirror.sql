-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Kanban HubSpot · tabla ESPEJO de los negocios (deals) de HubSpot
-- La llena un import servidor (Edge Function sync-hubspot-deals) con el token.
-- MacroPro SOLO la lee (solo lectura). Correr UNA vez en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.hubspot_deals (
  deal_id            text primary key,   -- id del deal en HubSpot
  dealname           text,               -- nombre del negocio
  dealstage_id       text,               -- id interno de la etapa
  dealstage_label    text,               -- etiqueta visible de la etapa (columna del Kanban)
  pipeline           text,               -- nombre del pipeline (ej. "Venta Desarrollo" / "Venta Corretaje")
  amount             numeric,            -- monto
  hubspot_contact_id text,               -- contacto asociado
  desarrollo         text,               -- desarrollo (propiedad de HubSpot, si existe)
  owner              text,               -- ASESOR dueño del negocio (nombre)
  updated_at         timestamptz default now()
);

create index if not exists hubspot_deals_stage_idx on public.hubspot_deals (dealstage_label);
create index if not exists hubspot_deals_pipe_idx  on public.hubspot_deals (pipeline);

-- RLS: lectura para usuarios logueados (los de MacroPro). La escritura la hace el import
-- servidor con service_role (omite RLS).
alter table public.hubspot_deals enable row level security;
drop policy if exists hubspot_deals_read on public.hubspot_deals;
create policy hubspot_deals_read on public.hubspot_deals for select to authenticated using (true);
