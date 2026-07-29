-- ════════════════════════════════════════════════════════════════════
-- MacroPro · Kanban HubSpot (solo lectura) · Tabla ESPEJO de deals
-- La LANDING (que tiene el HUBSPOT_TOKEN / Flujo A) sincroniza aquí los
-- negocios (deals) del pipeline "Venta Desarrollo". MacroPro SOLO LEE.
-- MacroPro NUNCA escribe a HubSpot ni a esta tabla.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.hubspot_deals (
  deal_id            text primary key,          -- id del deal en HubSpot
  dealname           text,                       -- nombre del negocio
  dealstage_id       text,                       -- ID INTERNO del dealstage (autoritativo)
  dealstage_label    text,                       -- etiqueta visible de la etapa (respaldo de match)
  pipeline           text,                       -- "Venta Desarrollo" o su id
  amount             numeric,                    -- monto del deal
  hubspot_contact_id text,                       -- vínculo con landing_clientes.hubspot_contact_id
  desarrollo         text,                       -- para el filtro (Kulkana, Capital Norte, etc.)
  owner              text,                       -- asesor dueño del deal (opcional)
  close_date         timestamptz,                -- opcional
  updated_at         timestamptz default now()
);

-- Índices útiles para lectura por etapa / desarrollo
create index if not exists hubspot_deals_stage_idx on public.hubspot_deals (dealstage_id);
create index if not exists hubspot_deals_dev_idx   on public.hubspot_deals (desarrollo);

-- RLS: lectura para usuarios logueados (los 3 de MacroPro). La escritura la hace la
-- landing con su rol de servicio (service_role omite RLS), NO el cliente.
alter table public.hubspot_deals enable row level security;

drop policy if exists hubspot_deals_read on public.hubspot_deals;
create policy hubspot_deals_read
  on public.hubspot_deals for select
  to authenticated
  using (true);

-- MacroPro empareja cada deal a una de estas 12 columnas por dealstage_id (si está
-- mapeado) o por dealstage_label. Los nombres visibles esperados (orden del Kanban):
--   1 Prospecto nuevo
--   2 Cliente sin contactar
--   3 Cliente contactado
--   4 Cita programada
--   5 Visita hecha
--   6 Cliente interesado
--   7 Preapartado
--   8 Apartado
--   9 Firma de carta oferta
--  10 Firma de contrato compraventa
--  11 Escriturado
--  12 Venta Perdida / Descartado
--
-- PENDIENTE del lado landing: confirmar los IDs INTERNOS de cada dealstage con
--   GET https://api.hubapi.com/crm/v3/pipelines/deals
-- y (a) guardarlos en dealstage_id de cada fila, y/o (b) pasármelos para fijarlos en
-- HUBSPOT_STAGE_IDS dentro de index.html (match exacto por id, no por etiqueta).
