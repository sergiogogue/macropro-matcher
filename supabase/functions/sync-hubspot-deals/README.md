# Sync HubSpot → `hubspot_deals` (espejo del Kanban HubSpot)

MacroPro **solo lee** la tabla `public.hubspot_deals`. Esta función es la que la **llena**
con TODOS los negocios (deals) de HubSpot. El token vive aquí (servidor), nunca en MacroPro.

## 1) Crear la tabla (una vez)
Corre `sql/hubspot_deals_mirror.sql` en Supabase → SQL Editor.

## 2) Guardar el token como secreto
Supabase → Project Settings → Edge Functions → Secrets:
- `HUBSPOT_TOKEN` = tu token privado de HubSpot (scope `crm.objects.deals.read` y `crm.schemas.deals.read`).
(`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase.)

## 3) Desplegar la función
Con Supabase CLI (en tu compu):
```bash
supabase functions deploy sync-hubspot-deals --no-verify-jwt
```

## 4) Correrla
- Manual (para probar): `supabase functions invoke sync-hubspot-deals` o abre su URL pública.
  Debe responder `{ "ok": true, "synced": N }`.
- Automática cada 10 min: Supabase → Database → Extensions → activa `pg_cron` y `pg_net`, luego:
```sql
select cron.schedule(
  'sync-hubspot-deals', '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://<TU-REF>.functions.supabase.co/sync-hubspot-deals',
       headers := jsonb_build_object('Content-Type','application/json')
     ); $$
);
```

## 5) Ajustes dentro de `index.ts`
- `DESARROLLO_PROP`: nombre INTERNO de la propiedad de HubSpot que guarda el desarrollo
  (para el filtro en MacroPro). Si no tienes una, déjalo y `desarrollo` quedará vacío.
- `PIPELINE_LABEL`: por defecto filtra el pipeline "Venta Desarrollo". Deja "" para traer todos.

## Resultado
En MacroPro (admin) → CRM → Kanban → **🔶 Kanban HubSpot** → **🔄 Actualizar**: aparecen los
deals en sus 12 columnas. Si alguna etapa cae en "⚠ Otra etapa", pásame los `dealstage` internos
(los ves en la columna `dealstage_id` de la tabla) y los fijo en `HUBSPOT_STAGE_IDS`.
