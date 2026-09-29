# Hallazgos RLS — base compartida (para el dev de la Landing)

_Fecha: 2026-09-29 · Proyecto Supabase `xugrrabebphdelgwqnwc` (compartido MacroPro + Landing)._

> **Contexto:** MacroPro auditó el RLS de `public`. **Las tablas de MacroPro están
> protegidas** (RLS activo). Los hallazgos de abajo son de tablas **de la Landing /
> valuador / comm / guía**, no de MacroPro. Se listan aquí para que el equipo de la
> Landing las revise y endurezca. **No se aplicó ningún cambio** desde MacroPro para
> no arriesgar romper la Landing.

## ✅ MacroPro — protegido (no requiere acción)
Todas con `rowsecurity = true` y políticas `authenticated`:
`app_config, asesores, captaciones, clientes, cotizaciones, crm_lotes, desarrollos,
hubspot_deals_pendientes, inventario_full, landing_clientes, lotes, ofertas,
solicitudes_asesor`. (captaciones deja `anon INSERT` a propósito, para el formulario público.)

## ⚠️ Tablas con RLS APAGADO (rowsecurity = false)
Cualquiera con la publishable/anon key puede leerlas/escribirlas:

| Tabla | Sugerencia |
|---|---|
| analitica_excluidos | Activar RLS; ¿la lee el valuador anónimamente? verificar antes |
| asesores_persona | Activar RLS (parece PII de personas) — **prioridad** |
| catalogo_mercados | Activar RLS; probablemente solo lectura pública si el valuador la necesita |
| catalogo_zonas | Igual que arriba |
| censo_comercios_v2 | Activar RLS; ¿la usa el valuador anónimo? si sí, dejar solo SELECT anon |
| censo_giros_referencia | Igual |
| equipos | Activar RLS — **prioridad** (parece interno) |
| mapeo_zona | Activar RLS |
| mercado_desarrollos_hist | Activar RLS |

**Cómo endurecer cada una (patrón):**
```sql
alter table public.<tabla> enable row level security;
-- si el valuador/landing la lee SIN login, deja solo lectura anónima:
create policy <tabla>_read_anon on public.<tabla> for select to anon, authenticated using (true);
-- si es interna, solo autenticados:
create policy <tabla>_auth_all on public.<tabla> for all to authenticated using (true) with check (true);
```
⚠ **Antes de activar RLS**, verificar qué flujos anónimos de la Landing/valuador las
leen, o esas pantallas dejarán de cargar.

## ⚠️ Políticas `{public}` demasiado abiertas (public = cualquiera, incl. anon)
Revisar si el acceso anónimo es intencional; si no, cambiar `to public` → `to authenticated`:

| Tabla | Política | Riesgo |
|---|---|---|
| comm_chat | comm_chat_ins / _del (public INSERT/DELETE) | Cualquiera inserta/borra chat |
| comm_conversaciones | conv_rw (public ALL) | Acceso total anónimo |
| especialistas_contacto | esp_admin_todo (public ALL) | Acceso total anónimo |
| guia_memoria | insert/update/delete_own (public) | Cualquiera escribe/borra memoria |
| cotizaciones | brokers_sin_cotizaciones / buyers_sin_cotizaciones (public ALL) | ALL anónimo sobre cotizaciones |
| acciones | acciones_read (public SELECT) | Lectura pública |
| desarrolladores | solo_interno_lectura (public SELECT) | Lectura pública |
| guia_auditoria | guia_aud_admin_lee (public SELECT) | Lectura pública de auditoría |

_Nota: algunas pueden ser intencionales (p. ej. catálogos públicos de la landing).
El dev de la Landing debe confirmar caso por caso antes de cambiar._

## Verificación posterior (por el dev de la Landing)
1. Reejecutar: `select tablename, rowsecurity from pg_tables where schemaname='public' and rowsecurity=false;` → debe quedar vacío (o solo tablas justificadas).
2. Probar la Landing/valuador **sin sesión**: las pantallas públicas siguen cargando; lo interno ya no es accesible sin login.
