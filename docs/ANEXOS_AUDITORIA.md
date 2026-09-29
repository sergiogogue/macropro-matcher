# Anexos de auditoría — MacroPro

_Complemento de `AUDITORIA_MACROPRO_2026-09.md` · Actualizado 2026-09-29._

---

## Anexo A — Inventario RLS
_Auditado 2026-09-29. **Todas las tablas de MacroPro tienen RLS activo (rowsecurity=true)**
con políticas `authenticated` (captaciones deja `anon INSERT` para el formulario público) →
MacroPro está protegido, no requiere acción. Las exposiciones detectadas son de tablas
de la Landing/valuador — ver `docs/HALLAZGOS_RLS_COMPARTIDA.md`._

| Tabla | RLS activo | Políticas | Lectura anon | Escritura anon | Notas |
|---|---|---|---|---|---|
| lotes | ⬜ | | ⬜ | ⬜ | Catálogo compartido; MacroPro solo lee |
| clientes | ⬜ | | ⬜ | ⬜ | Compartido; MacroPro solo lee |
| desarrollos | ⬜ | | ⬜ | ⬜ | Compartido; MacroPro solo lee |
| crm_lotes | ⬜ | | ⬜ | ⬜ | App: lee/escribe |
| app_config | ⬜ | | ⬜ | ⬜ | App: metas_v1 |
| ofertas | ⬜ | | ⬜ | ⬜ | App: lee/escribe |
| solicitudes_asesor | ⬜ | | ⬜ | ⬜ | App: lee/escribe |
| captaciones | ⬜ | | ⬜ (INSERT) | ⬜ | anon INSERT desde captar.html |
| inventario_full | ⬜ | | ⬜ | ⬜ | Compartido |
| cotizaciones | ⬜ | | ⬜ | ⬜ | Lee |
| asesores | ⬜ | | ⬜ | ⬜ | Lee |
| hubspot_deals_pendientes | ⬜ | | ⬜ | ⬜ | De la Landing; MacroPro lee (política hsdp_admin: authenticated) |
| landing_clientes / landing_criterios / v_landing_lotes | ⬜ | | ⬜ | ⬜ | Compartidas con la Landing |

---

## Anexo B — Inventario localStorage

| Clave | Contenido | Criticidad | ¿Sincroniza a Supabase? |
|---|---|---|---|
| `macropro_inventory_v1` | Inventario de lotes | Alta | Lee de `lotes` |
| `macropro_clients_v1` | Clientes/prospectos | Alta | Lee de `clientes` |
| `macropro_crm_v1` | CRM (pipeline, prospectos, interacciones) | Alta | ⇄ `crm_lotes` |
| `macropro_captacion_v1` | Captaciones | Alta | ⇄ `captaciones` |
| `macropro_metas_v1` | Metas | Alta | ⇄ `app_config/metas_v1` |
| `macropro_apartados_v1` | Apartados del mes (captura manual) | Media | No (solo local) |
| `macropro_ofertas_v1` | Historial cliente↔lote | Media | ⇄ `ofertas` |
| `macropro_solicitudes_asesor_v1` | Solicitudes de brokers | Media | ⇄ `solicitudes_asesor` |
| `macropro_desarrollos_v1` / `_dev_v1` | Desarrollos y mapeo desarrollo→desarrollador | Media | Lee de `desarrollos` |
| `macropro_cotizaciones_v1` | Cotizaciones | Baja | Lee |
| `macropro_asesores_v1` | Catálogo de asesores | Baja | Lee |
| `macropro_templates_v1` | Plantillas WhatsApp/email | Baja | No |
| `macropro_api_key` | ⚠ **API key Anthropic** | **Crítica** | **Debe eliminarse (R-01)** |
| `macropro_inegi_token` | Token INEGI (demografía) | Media | No |
| `macropro_drive_token(_exp)` | OAuth Google Drive (backup) | Media | No |
| `macropro_*_filtro_*` (ejec/metas/solicitud) | Filtros persistidos | Baja | No (ver R-09) |
| `macropro_view_v1`, `macropro_active` | Vista/tab activa | Baja | No |

---

## Anexo C — Mapeo HubSpot (17 etapas crudas → 7 columnas)

| Etapa cruda (HubSpot) | Columna agrupada | Orden |
|---|---|---|
| Prospecto · Prospecto nuevo · Cliente sin contactar | **Prospecto** | 1 |
| Contactado · Cliente contactado · Cita programada | **Contactado** | 2 |
| Interesado · Cliente interesado · Visita hecha | **Interesado** | 3 |
| Apartado · Carta oferta enviada · Firma de carta oferta | **Apartado** | 4 |
| Firma de contrato compraventa · Firma de contrato de compraventa | **Contrato** | 5 |
| Escriturado | **Cerrado** | 6 |
| Descartado · Venta Perdida | **Perdido** | 7 |
| (null / desconocida) | **Sin etapa** | — |

_Config editable en `index.html` (`_HS_GRUPO_MAP`). Normaliza acentos, mayúsculas y la preposición "de"._

---

## Anexo D — Generadores (PDF / PPTX / iCal / Excel)

| Nombre | Tipo | Disparador | Notas |
|---|---|---|---|
| Dictamen de captación (AUTORIZADO/REVISAR/NO AUTORIZADO) | PDF | Ficha de Opción → "Generar y guardar dictamen" | Se sube a `captaciones-docs` |
| Reporte de seguimiento (Semáforo Ejecutivo) | PDF | Ejecutivo → Exportar PDF | Por canal→etapa, último comentario completo |
| Scorecard de Metas (2 hojas) | PDF | Metas → Imprimir/PDF | Cards + scorecard anual + al mes + tendencia + ventas |
| Reporte de captación | PDF | Opción → reporte | KPIs de captación |
| Semáforo para opción | PDF | Captación | Incluye QR a `captar.html` |
| Informe de demanda | PDF | Corretaje | Demanda por zona/uso |
| Presentaciones ejecutivas / estrategia | PPTX | Documentos | pptxgenjs |
| Recordatorios / seguimientos | iCal (.ics) | CRM | Al calendario |
| Import inventario / clientes / metas / competencia | Excel (SheetJS) | Admin / Metas / Benchmark | Lectura |

_(Completar "campos obligatorios" por generador durante la auditoría de datos.)_

---

## Anexo E — Dependencias CDN (index.html)

| Librería | Versión (pinneada) | CDN |
|---|---|---|
| React | 18.2.0 | cdnjs |
| ReactDOM | 18.2.0 | cdnjs |
| Babel standalone | 7.23.2 | cdnjs |
| SheetJS (xlsx) | **0.18.5** (community, no propietaria) | cdnjs |
| Leaflet | 1.9.4 | cdnjs |
| Leaflet.markercluster | 1.5.3 | cdnjs |
| jsPDF | 2.5.1 | cdnjs |
| jspdf-autotable | 3.8.0 | cdnjs |
| pdf.js (+worker) | 3.11.174 | cdnjs |
| pptxgenjs | _(verificar)_ | cdnjs |
| @supabase/supabase-js | @2 (major; **pinnear exacto pendiente**) | jsdelivr |

_Estado R-04: las librerías core están pinneadas a versión exacta. Pendiente: pinnear `supabase-js@2` a una versión exacta y verificar la versión de pptxgenjs._

---

## Anexo F — Procedimiento de restauración (backup → restore)

| Fecha | Origen | Destino | Resultado | Tiempo |
|---|---|---|---|---|
| _(pendiente R-21)_ | | | | |

**Procedimiento a documentar:** export de Supabase → restaurar en proyecto de prueba → verificar integridad (conteos por tabla) → registrar tiempo. Plan Free no tiene PITR; definir export periódico + keep-alive (evitar pausa por inactividad 7 días).
