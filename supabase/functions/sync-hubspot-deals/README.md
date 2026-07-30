# Import HubSpot → `hubspot_deals` (espejo del Kanban HubSpot)

Este es **el paso que falta**: HubSpot tiene los negocios, pero **nadie los ha copiado a
Supabase**. MacroPro solo lee la tabla `public.hubspot_deals`; esta función la llena con
TODOS los deals (todos los pipelines) usando el token del lado servidor.

## Pasos
1. **Tabla:** corre `sql/hubspot_deals_mirror.sql` en Supabase → SQL Editor.
2. **Token:** Supabase → Project Settings → Edge Functions → Secrets → `HUBSPOT_TOKEN`
   (scopes: `crm.objects.deals.read`, `crm.schemas.deals.read`, `crm.objects.owners.read`,
   `crm.objects.contacts.read`).
3. **Deploy:** `supabase functions deploy sync-hubspot-deals --no-verify-jwt`
4. **Correr una vez:** `supabase functions invoke sync-hubspot-deals` → `{ ok:true, synced:N }`.
5. **Automático (cada 10 min):** activa `pg_cron` + `pg_net` y:
```sql
select cron.schedule('sync-hubspot-deals','*/10 * * * *',
  $$ select net.http_post(
       url:='https://<TU-REF>.functions.supabase.co/sync-hubspot-deals',
       headers:=jsonb_build_object('Content-Type','application/json')); $$);
```

## Resultado
MacroPro (admin) → CRM → Kanban → **🔶 Kanban HubSpot** → **🔄 Actualizar**: aparecen los
negocios en columnas = etapa de HubSpot (todos los pipelines: Venta Desarrollo, Venta
Corretaje…), cada tarjeta con su asesor (owner). Idéntico a tu reporte de HubSpot.

## Ajuste
- `DESARROLLO_PROP` en `index.ts`: nombre interno de la propiedad de HubSpot con el desarrollo
  (si no tienes, déjalo; `desarrollo` quedará vacío).

> Nota: MacroPro también sabe leer de `landing_clientes.etapa_hubspot` si prefieres que la
> landing haga el import ahí. Cualquiera de las dos fuentes funciona; la que tenga datos manda.
