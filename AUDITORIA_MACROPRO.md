# Auditoría técnica de MacroPro — informe completo

_Para revisión/auditoría por Claude · repo `sergiogogue/macropro-matcher` · `main` · generado 2026-08-13_
_Basado en lectura directa del código (`index.html`, ~19,260 líneas)._

---

## 0. Arquitectura general

- **App de una sola página, un solo archivo**: todo vive en `index.html`. **React 18 + ReactDOM + Babel-standalone** transpilan el JSX **en el navegador** (no hay build step para la app).
- **Componente raíz**: `MacroProMatcher()`. Montado dentro de un `AuthGate` (login) + `ErrorBoundary`.
- **Hosting**: **GitHub Pages** → `https://sergiogogue.github.io/macropro-matcher/` (sirve la raíz de `main`, sin build). **No es Netlify.** (`grupoguia-macrolotes.netlify.app` = otra app, la Landing.)
- **PWA instalable**: `service-worker.js` (cache `macropro-v4`, network-first) + `manifest.json`.
- **Backend**: **Supabase** proyecto `xugrrabebphdelgwqnwc` (cliente en el código se llama **`sb`** / `window.sb`, key **publishable** en `index.html` ~línea 198). Base **compartida** con la Landing y MacroCotizador.
- **Usuarios**: 3 de confianza; **todos admin** (`esAdmin` = `true` para todos). El campo `asesor` es dato de negocio, no control de acceso.
- **Sincronización**: **last-write-wins por registro** (upsert por `id`/`id_cliente`/`lote_id`), nunca reemplazo de tabla completa.

---

## 1. Interfaces / vistas (navegación)

Barra de navegación (estado `view`): **Inicio · Dashboard · CRM · Ejecutivo · Metas · Corretaje · Opción · Buscando · Búsqueda · Cliente→Lotes · Lote→Clientes · Clientes · Inventario** (+ Asesores y Administrador para admin).

| Vista (`view`) | Etiqueta | Qué hace |
|---|---|---|
| `home` | **Inicio** | Portada / resumen, accesos rápidos. |
| `dashboard` | **Dashboard** | Tablero ejecutivo (KPIs, gráficas). Reporte CEO/Cliente en PDF. |
| `crm` | **CRM** | Núcleo de seguimiento. Sub-vistas: **Kanban** (`kanban`) por etapa de pipeline, **Prospectos** (`prospectos`), **Mi Día** (`midia`, agenda/calendario de actividades), **Oportunidades** (`oportunidades`). Fichas de prospecto, interacciones, comentarios, actividades. |
| `ejecutivo` | **Ejecutivo** | "Semáforo · Seguimiento": tabla de prospectos agrupada por **canal** y **etapa**, con semáforo de contacto, último comentario, filtros (desarrollo/tipo/canal/asesor). **Genera el PDF de seguimiento.** |
| `metas` | **Metas** | Scorecard Plan vs Real por desarrollo, meta acumulada al mes, **apartados del mes**, scorecard al mes, tendencia mensual + momentum CRM. **Import Excel de metas** + **reporte imprimible (PDF 2 hojas)**. |
| `corretaje` | **Corretaje** | Clientes/canales por desarrollador; reporte `canales_clientes_*.pdf`. |
| `captacion` | **Opción** | Captación/opcionamiento de terrenos; autorización/negación; documentos (dictamen, predial) a Storage; PDFs de Opción y Reporte de Captación. |
| `quickSearch`/`result` | **Búsqueda** | Búsqueda en lenguaje natural ("gasolinera en Zapopan hasta 5M") → resultados. |
| `matchClient` | **Cliente→Lotes** | Dado un cliente, rankea lotes compatibles (motor de matching, con IA opcional). Exporta PPTX `Match_<cliente>_Lotes.pptx`. |
| `matchLot`/`lots` | **Lote→Clientes / Inventario** | Dado un lote, rankea clientes compatibles. Exporta PPTX `Match_<lote>_Clientes.pptx` y `FichaTecnica_<lote>.pptx`. Inventario = catálogo de lotes. |
| `clients` | **Clientes** | CRUD de clientes; ficha interna (match) + ficha de la Landing (`📇 Ficha`); import Excel; eliminar (baja lógica). |
| `asesores` | **Asesores** | Catálogo de asesores (admin). |
| `admin` | **Administrador** | Migración a la nube, config, importaciones. |
| `benchmark` | (interno) | Comparativos de mercado/competencia. |

Además hay **modales y drawers**: alta/edición de cliente, ficha de prospecto rápida, drawer de semáforo, modal de solicitud de asesor, modal de importación de metas/Excel, modal de migración a Supabase, drawer de lotes/inventario, modal de nota/interacción, etc.

---

## 2. Supabase — TODO lo que se comparte (tabla por tabla)

> Cliente `sb` con key **publishable**. Operaciones detectadas en el código:

### Tablas del esquema `public` (propias de MacroPro)
| Tabla | Operaciones | Uso |
|---|---|---|
| **`lotes`** | `select`, `upsert` | Inventario real de lotes. Se **lee en vivo** (`recargarInventarioCloud`), filtra `dado_baja_at==null` y excluye ids `GEN_`. Escritura vía upsert (id minúscula = `loteKey`). |
| **`crm_lotes`** | `select`, `upsert` | CRM por lote. Columnas: `lote_id`, `pipeline`, `asesor_asignado`, **`prospectos`(jsonb[])**, **`interacciones`(jsonb[])**, `dev_feedback`(jsonb), `seguimientos_asesor`(jsonb), `updated_at`. Bajada **fusiona** (union por nombre/dedup), nunca borra local. |
| **`clientes`** | `select`, `upsert` | Clientes de MacroPro (`public.clientes`). Upsert `onConflict: id_cliente`. Ver columnas abajo. Baja lógica `activo=false`. |
| **`solicitudes_asesor`** | `select`, `upsert` | Solicitudes de asesores externos/brokers (pipeline de solicitudes). |
| **`ofertas`** | `select`, `upsert`, `update` | Estados de oferta por lote-cliente (`ofrecido/analisis/descartado/vendido`); borrado lógico `eliminado=true`. |
| **`captaciones`** | `select`, `upsert` | Captación/opción de terrenos (formulario Opción). |
| **`inventario_full`** | `upsert` | Espejo completo del inventario (datos crudos por lote: `{id, datos, updated_at}`). |
| **`desarrollos`** | `select`, `insert`, `update` | Catálogo de desarrollos. |
| **`cotizaciones`** | (select/uso) | Cotizaciones por cliente/lote (imágenes/PDF para fichas). |
| **`asesores`** | `select` | Catálogo de asesores (memoria; no contamina el catálogo manual `AS-`). |
| **`app_config`** | `select`, `update`, `insert` | Config clave→datos. **`metas_v1`** = metas guardadas en la nube (para no re-subir el Excel). |
| **`hubspot_deals`** | `select` | Espejo de HubSpot. **⚠ Lector DESCONECTADO de la UI** (se quitó el tab "Kanban HubSpot"); es dead code hasta reconectar. |

### Tablas / vistas de la **Landing** (compartidas)
| Objeto | Operaciones | Uso |
|---|---|---|
| **`landing_clientes`** | `select`, `update` | Ficha rica del cliente de la Landing (`giro/direccion/etapa/monto/origen`, `etapa_hubspot`, `macropro_id`). MacroPro lee y edita la ficha desde `📇 Ficha`. |
| **`landing_criterios`** | `select` | Criterios de la Landing. |
| **`landing_colaboradores`** | `select` | Colaboradores/asesores de la Landing (mapa `asesor_id → nombre`). |
| **`v_landing_lotes`** | `select` | Vista de lotes de la Landing (fallback del inventario). |

### RPC / Storage / Auth
- **RPC `landing_import_lotes`** — importación de lotes.
- **Storage bucket `captaciones-docs`** — PDFs de captación (**dictamen de usos**, **boleta predial**), con etiqueta `tipo`.
- **Auth Supabase**: `getSession`, `onAuthStateChange`, `signInWithPassword`, `signOut` — login email/contraseña de los 3 usuarios.

### Columnas que MacroPro escribe en `public.clientes` (`clienteToSupabase`)
`email` · `id_cliente` (llave upsert) · `nombre` · `empresa` · `telefono` · `asesor` · `asesor_email` · `tipo_comprador` · `ciudad_interes` (text[]) · `uso_interes` (text[]) · `presupuesto_min/max` (numeric) · `sup_min/max` (numeric) · `status` · `plazo_cierre` · `deal_breakers` (text[]) · **`activo`** (bool, baja lógica) · **`updated_at`** (sello last-write-wins).
> **Catálogos EXACTOS compartidos** (match por texto): `uso_interes` (10 cadenas) y `tipo_comprador` (4). No se crean columnas nuevas en `public.clientes` (giro/direccion/etapa/monto/origen viven solo en `landing_clientes`).

---

## 3. Reportes y exportaciones (DETALLADO)

### 3.1 PDF (jsPDF 2.5.1 + jspdf-autotable 3.8.0, + PDF.js para incrustar cotizaciones/fichas)
| Reporte | Archivo | Dónde | Contenido |
|---|---|---|---|
| **Seguimiento (Semáforo)** | `reporte_seguimiento_*.pdf` | Ejecutivo | Por canal: tabla (etapa, cliente, empresa, lote, sup, $/m², total, asesor, **último comentario COMPLETO** con fila de alto dinámico) + **fichas** de clientes en etapas avanzadas (con cotización y ficha técnica) + **Resumen Ejecutivo** (KPIs + gráficas de barras por uso y por etapa). Landscape A4, multipágina. |
| **Ejecutivo CEO/Cliente** | `MacroPro_Reporte_CEO/Cliente.pdf` | Dashboard | Reporte ejecutivo en 2 modos. |
| **Demanda** | `informe_demanda.pdf` | (demanda por uso) | Demanda de clientes por uso/ciudad. |
| **Canales/Clientes** | `canales_clientes_*.pdf` | Corretaje | Clientes por desarrollador/canal. |
| **Entorno del lote (DENUE)** | `Entorno_<lote>.pdf` | Lote | Entorno/POIs alrededor del lote (INEGI/DENUE + mapa). |
| **Opción — semáforo** | `Semaforo_para_Opcion_GrupoGuia.pdf` | Opción | Formulario de viabilidad. |
| **Solicitud de macrolote** | `Solicitud_de_Macrolote_GrupoGuia.pdf` | Opción/Buscar | Solicitud de terreno. |
| **Reporte de captación** | `Reporte_Captacion_GrupoGuia.pdf` | Opción | Captaciones registradas. |
| **Informe por desarrollador** | `informe_<dev>.pdf` | Corretaje/Dev | Informe ejecutivo por desarrollador. |
| **Ficha/Match de cliente** | (dinámico, `fname`) | Match | Ficha o match en PDF. |
| **Instrucciones para compartir liga** | (PDF con logo) | Opción/Buscar | Guía para compartir Captar/Buscar. |

### 3.2 PowerPoint (pptxgenjs — bundle local `public/pptxgen.bundle.js`)
- **`FichaTecnica_<lote>.pptx`** — ficha técnica del lote en diapositivas.
- **`Match_<cliente>_Lotes.pptx`** — presentación Cliente→Lotes (los mejores lotes para un cliente).
- **`Match_<lote>_Clientes.pptx`** — presentación Lote→Clientes (los mejores clientes para un lote).

### 3.3 Impresión (window.print) → PDF por diálogo del navegador
- **Reporte de Metas** (`imprimirReporteMetas`): **2 hojas** — (1) resumen (Unidades/Monto/Meta al mes) + Scorecard anual + Scorecard al mes; (2) Tendencia mensual + gráfica de Ventas reales + KPIs. Incluye columna **🔖 Apartados**.
- Botón **🖨️ Imprimir** genérico en otra vista.

### 3.4 Calendario (iCal `.ics`)
- Exporta eventos de **Mi Día** (actividades/agenda) como archivo `.ics` (pie con "Generado por MacroPro").

### 3.5 Excel (SheetJS/XLSX 0.18.5)
- **Importación**: clientes, inventario de lotes, **metas** (Plan/Real), mercado/competencia. Los import normalizan catálogos (uso/tipo_comprador) al texto exacto.

---

## 4. Persistencia local (localStorage) — 42 claves `macropro_*`

**Datos de negocio (espejo local):** `inventory_v1`, `clients_v1`, `crm_v1`, `metas_v1`, `apartados_v1`, `cotizaciones_v1`, `fichas_v1`, `planos_v1`, `ofertas_v1`, `captacion_v1`, `solicitudes_asesor_v1`, `desarrollos_v1`, `desarrollos_dev_v1`, `mapeo_desarrolladores_v1`, `asesores_v1`, `canales_v1`, `templates_v1`, `mercado_competencia`.
**Estado de UI/filtros:** `view_v1`, `activeTab_v1`, `vista_midia`, `cal_mode`, `filterDesarrolloGlobal_v1`, `filterDevCompania_v1`, `ejec_filtro_dev/desarrollo/asesor/etapa`, `metas_filtro_dev/desarrollo`, `solicitud_filtro_pipeline`, `mi_asesor`.
**Integraciones / secretos (⚠ en el navegador):** `api_key`, `inegi_token`, `drive_token`, `drive_token_exp`, `drive_last_backup`, `oauth_state`, `autobackup`, `sync_auto`, `id`, `idb`.

---

## 5. Librerías externas / CDNs
| Librería | Versión | Fuente |
|---|---|---|
| React / ReactDOM | 18.2.0 | cdnjs |
| Babel standalone | 7.23.2 | cdnjs |
| SheetJS (XLSX) | 0.18.5 | cdnjs |
| Leaflet + markercluster | 1.9.4 / 1.5.3 | cdnjs |
| jsPDF + autotable | 2.5.1 / 3.8.0 | cdnjs |
| PDF.js | 3.11.174 | cdnjs |
| pptxgenjs | (bundle local) | `public/pptxgen.bundle.js` |
| Supabase JS v2 | — | CDN (con fallback) |

> **⚠ Punto único de falla**: casi todo carga de **cdnjs.cloudflare.com**. Si esa red se bloquea, la app no arranca (ya ocurrió en sesión). El service worker cachea **unpkg** (no cdnjs) → el cache no cubre lo que la app realmente usa.

---

## 6. Integraciones externas
- **Supabase** — Auth + DB + Storage (detalle en §2).
- **Google Drive Backup** — respaldo opcional a carpeta "MacroPro Backups". OAuth **implicit** (`response_type=token`, scope `drive.file`), tokens ~1h, `redirect_uri = github.io/macropro-matcher/`. Token en localStorage. **⚠ La IA/valuador usa un proxy Netlify que NO corre en github.io** (eso es `intelligence.html`, app aparte).
- **HubSpot** — espejo `hubspot_deals` (import por Edge Function externa). **Lector desconectado de la UI.**
- **INEGI / DENUE** — entorno del lote (POIs), token en `macropro_inegi_token`.
- **Mapas** — Leaflet + tiles OSM.

---

## 7. Auth y permisos
- Login **Supabase email/contraseña** (`AuthGate`). 3 usuarios.
- **`esAdmin = true` para todos** (misma versión y velocidad para los 3).
- El RLS solo distingue "logueado = acceso; sin login = nada".

---

## 8. Modelo de datos / claves canónicas
- **`loteKey()` / `superNormId()`** → id de lote en **minúscula**, sin separadores raros (`cn-001`). Postgres es case-sensitive → mayúscula duplicaría. Hay índice único en la base para blindarlo.
- **`cliKey`** → cliente por **email en minúsculas** (llave de dedup).
- **CRM**: actividades/interacciones **ligadas por NOMBRE**, no por `id_cliente` (deuda: ligar por id para sincronizar bitácora con la Landing = "Fase 2").

---

## 9. Hallazgos / puntos de auditoría (RIESGOS y deuda técnica)

1. **RLS**: varias tablas están/estuvieron **UNRESTRICTED** (RLS off) según CLAUDE.md — endurecer es tarea del Sprint 6. **Prioridad de seguridad.**
2. **Secretos en el navegador**: `macropro_api_key`, `macropro_inegi_token`, key publishable de Supabase, token de Drive — todos accesibles en el cliente. Revisar qué es `api_key` y si debe estar ahí.
3. **`hubspot_deals`**: lector completo pero **desconectado** (dead code). Decidir reconectar o eliminar.
4. **Google Drive OAuth**: flujo *implicit* (deprecado por Google), tokens de ~1h; `redirect_uri` en github.io.
5. **Dependencia de cdnjs** (single point of failure) + **service worker que cachea el CDN equivocado** (unpkg vs cdnjs). Recomendable multi-CDN o librerías locales.
6. **Bitácora ligada por nombre** (no `id_cliente`) → frágil ante homónimos/cambios de nombre; bloquea sync fino con la Landing.
7. **Footguns de sincronización**: upsert con ids en mayúscula re-duplicaba lotes (mitigado con índice único); upsert con NULLs en `email`/`clave_unica` duplicó masivamente (incidentes pasados). Validar claves no nulas antes de subir.
8. **Sin build ni tests automáticos**: se valida a mano (harness jsdom). Riesgo de regresión por scope de hooks (compila en Babel pero crashea en runtime).
9. **Mucho estado en localStorage** (18+ espejos de negocio) → riesgo de estado stale entre dispositivos; la nube debe mandar.
10. **PWA/caché**: los usuarios pueden quedar en versión vieja (hard reload / Safari fuerza la última).
11. **Reportes pesados**: `index.html` ~2.2 MB + PDFs que incrustan imágenes (cotizaciones/fichas) → memoria/tiempo en dispositivos modestos (iPad).

---

## 10. Cosas que funcionan bien (fortalezas)
- Motor de **matching bidireccional** (Cliente↔Lote) con IA opcional.
- **CRM completo** (Kanban, prospectos, Mi Día/agenda, interacciones, semáforo).
- **Metas** con scorecards anual y al-mes, apartados, tendencia + momentum, reporte imprimible.
- **Reportería rica** (PDF, PPTX, iCal, Excel).
- **Sincronización por registro** (last-write-wins) que evita pisarse entre usuarios.
- **Ficha unificada con la Landing** (misma base Supabase).

---

_Fin del informe. Para profundizar en cualquier sección, pedir a Claude que abra `index.html` y busque las funciones citadas (`clienteToSupabase`, `crmFila`, `recargarInventarioCloud`, `exportarPDF`, `imprimirReporteMetas`, `cargarHubspot`, `connectDrive`, `subirMetasCloud`, etc.)._
