# Auditoría técnica — MacroPro (Grupo Guía)

_Documento para auditoría y detección de mejoras · Estado a 2026-09-29 · rama `main` de `sergiogogue/macropro-matcher`._

> Este informe describe **qué hace MacroPro, cómo funciona por dentro, qué comparte con Supabase, sus integraciones, sus reportes, y sus riesgos/deuda técnica**, con recomendaciones de mejora priorizadas al final.

---

## 1. Qué es MacroPro

CRM inmobiliario de Grupo Guía para **macrolotes y desarrollos**. Es un **motor de matching** (Cliente→Lotes y Lote→Clientes) con CRM, dashboard ejecutivo, metas, mapas, captación de terrenos, búsqueda y exportación a PDF/PPTX/iCal, sincronizado con Supabase. Es una **PWA instalable** (funciona offline con caché).

- **Usuarios:** ~3 usuarios de confianza (gerencia/dirección). **Todos ven y editan todo**; no hay permisos por territorio. El campo `asesor` es dato de negocio, no control de acceso.
- **Versión:** badge en UI **v5.2**; el repo/documentación referencia una línea **v8.x**. (Conviene unificar el número — ver §9.)

---

## 2. Arquitectura

- **Toda la app vive en un solo `index.html`** (~19,300 líneas dentro de un bloque `<script type="text/babel">`). **No hay build step**: React 18 + ReactDOM + **Babel-standalone** transpilan el JSX **en el navegador** (runtime clásico, `React.createElement`).
- **Componente raíz:** `MacroProMatcher()`.
- **Librerías por CDN:** jsPDF (+autotable), PDF.js, Leaflet (mapas), XLSX/SheetJS, pptxgenjs, cliente Supabase v2. Fallback entre varios CDNs.
- **PWA:** `service-worker.js` (estrategia **network-first**, cae a caché si no hay red) + `manifest.json`.
- **Cliente Supabase se llama `sb`** (no `supabase`) — convención del proyecto.
- **Idioma:** todo en español (UI, comentarios, mensajes).

### 2.1 Deploy

- **GitHub Pages**, sirviendo la **raíz** de `main` → `https://sergiogogue.github.io/macropro-matcher/`. Cada push a `main` dispara "pages build and deployment".
- **`macrolotes.grupoguia.mx` NO es MacroPro** — es la **Landing** (otro repo, `grupoguiamacrolotes-landing`, desplegado en Netlify). Comparten el mismo Supabase. El valuador `intelligence.html` que vive en ese dominio lo publica la Landing.
- Archivos públicos que sirve MacroPro (raíz): `index.html` (la app), `hub.html`, `captar.html` (formulario público de captación), `buscar.html`, `admin.html`, `intelligence.html` (copia), `guia-asesores.pdf`, íconos/favicons.

---

## 3. Módulos / vistas (navegación principal)

| Vista | Qué hace |
|---|---|
| 🏠 **Inicio** | Portada / accesos rápidos. |
| 📄 **Documentos** | Centro de Documentos: agrupa los generadores de PDF/PPTX por audiencia (junta / desarrollador / cliente / captación) y lleva a la pantalla donde se produce cada uno. |
| 📊 **Dashboard** | Tablero general del inventario/CRM. |
| 🤝 **CRM** | Núcleo comercial. Tabs: Dashboard, Mi día, Prospectos, **Kanban**, Oportunidades, Asesores, Benchmark. El Kanban tiene: **Pipeline de HubSpot** (solo lectura, arriba) + **Tablero propio** editable (abajo, `crm_lotes`). |
| ○ **Ejecutivo** | Dashboard Ejecutivo + **Semáforo · Seguimiento** (reporte por canal→etapa, con último comentario, semáforo de seguimiento, filtro de Vendidos y exportación PDF). |
| 🎯 **Metas** | Scorecard por desarrollo (anual y al mes), tendencia mensual con momentum del CRM, ventas reales, apartados del mes; importación de Excel de metas y persistencia en la nube; impresión/PDF. |
| 🏢 **Corretaje** | Inventario de corretaje + mapa de macrolotes coloreado por uso de suelo. |
| 🎯 **Opción** (captaciones) | Pipeline de captación de terrenos (Nueva opción → Viabilidad → Documentación → Contrato). Ficha con dictamen PDF, cruce con clientes, **checklist de documentos con subida/descarga**, y pase a inventario. |
| 🔎 **Buscando** / 🔎 **Búsqueda** | Motores de matching y búsqueda de lotes/clientes. |
| 👤 **Cliente→Lotes** / 📍 **Lote→Clientes** | Matching bidireccional (IA + reglas). |
| 👥 **Clientes** | Catálogo de clientes/prospectos. |
| 🏗 **Inventario** | Catálogo de lotes/macrolotes. |

---

## 4. Datos compartidos con Supabase

**Proyecto:** `xugrrabebphdelgwqnwc` (org "Grupo Guía", plan Free). Cliente `sb` con key *publishable*.

### 4.1 Tablas (lectura/escritura desde MacroPro)

| Tabla | MacroPro | Notas |
|---|---|---|
| `crm_lotes` | **Lee y escribe** | Fuente del Kanban propio (pipeline/etapa, prospectos, interacciones, seguimiento por asesor). Upsert por `lote_id`. |
| `app_config` | **Lee y escribe** | Clave `metas_v1` (persistencia de metas en la nube). |
| `ofertas` | **Lee y escribe** | Historial cliente↔lote (ofrecido/análisis/descartado/vendido). |
| `solicitudes_asesor` | **Lee y escribe** | Solicitudes de brokers/intermediarios. |
| `captaciones` | **Lee y escribe** | Terrenos en opción + `documentos_urls` (jsonb con las ligas de documentos). |
| `lotes` | **Lee** (escritura **neutralizada**) | Inventario. Escritura bloqueada por `MP_READONLY_SHARED` (ver §6). |
| `clientes` | **Lee** (escritura **neutralizada**) | Catálogo de clientes. |
| `desarrollos` | **Lee** (escritura **neutralizada**) | Catálogo de desarrollos. |
| `inventario_full` | escritura **neutralizada** | Espejo completo del inventario. |
| `cotizaciones` | Lee | Cotizaciones. |
| `asesores` | Lee | Catálogo de asesores. |
| `hubspot_deals_pendientes` | **Lee** (paginado) | **Tabla de la Landing** (la llena la Landing cada hora). Fuente del "Pipeline de HubSpot". |
| `landing_clientes`, `landing_criterios`, `v_landing_lotes` | Lee | Datos compartidos con la Landing. |

### 4.2 Storage

- **Bucket `captaciones-docs`** (público): documentos de captación (fotos, uso de suelo, plano, boleta/predial) + PDF del dictamen. Políticas: subida anónima (formulario público) + subida/lectura para usuarios logueados.

### 4.3 Auth

- Supabase Auth (email/contraseña): `getSession` / `onAuthStateChange` / `signInWithPassword` / `signOut`. "Logueado = acceso total; sin login = nada".

---

## 5. Integraciones externas

| Integración | Uso | Cómo |
|---|---|---|
| **HubSpot** | Pipeline comercial (solo lectura) | **No se llama directo.** La Landing sincroniza HubSpot → `hubspot_deals_pendientes` (cada hora); MacroPro solo lee esa tabla. Las 17 etapas crudas se **agrupan en 7 columnas** (config editable). |
| **Anthropic (Claude API)** | Matching con IA, valuador | API key en `localStorage` (`macropro_api_key`) usada **desde el navegador** contra `api.anthropic.com` (⚠ riesgo, ver §6). |
| **INEGI / DENUE** | Demografía del entorno | token `macropro_inegi_token`. |
| **Google Drive** | Respaldo (JSON) | OAuth (`macropro_drive_token`). |
| **Google Maps** | Ligas de ubicación | campo `liga_maps` por lote/captación. |

---

## 6. Seguridad y candados

- **`MP_READONLY_SHARED = true`** (bandera de módulo): neutraliza en código **todas las escrituras a tablas compartidas** (`lotes`, `clientes`, `desarrollos`, `inventario_full`, `landing_clientes`) para no revertir la limpieza de datos de la Landing. Se conservan escribibles: `crm_lotes`, `app_config`, `ofertas`, `solicitudes_asesor`, `captaciones`. **Reversible con la bandera.**
- **⚠ RLS:** varias tablas históricamente estuvieron sin RLS (UNRESTRICTED). El endurecimiento es trabajo abierto. **El candado real debe estar en la base (RLS), no solo en el código** (la bandera protege desde la app, pero cualquier cliente con la key podría escribir si la base lo permite).
- **⚠ API key de Anthropic en el navegador:** el matching por IA usa la key guardada en `localStorage` llamando a `api.anthropic.com` directo desde el cliente. Cualquiera con acceso al navegador la ve. **Recomendado moverla a un proxy servidor** (Edge Function) que guarde el token.
- **Deduplicación:** incidentes históricos de duplicación masiva (mayúscula/minúscula en `id` de lotes, upserts con claves nulas). Mitigado con `loteKey()` (minúsculas) e índice único en `lotes`. **No cambiar el case sin migrar referencias.**

---

## 7. Reportes y exportaciones

- **PDF (jsPDF):** ~10 generadores — dictamen de captación (AUTORIZADO/REVISAR/NO AUTORIZADO), reporte de seguimiento (Semáforo Ejecutivo, con último comentario completo), scorecard de Metas (2 hojas), reporte de captación, semáforo para opción (con QR a `captar.html`), instrucciones de solicitud, informe de demanda, etc.
- **PPTX (pptxgenjs):** presentaciones ejecutivas/estrategia comercial.
- **iCal (.ics):** recordatorios/seguimientos al calendario.
- **Excel (SheetJS):** importación de inventario, clientes, metas y competencia (benchmark).

---

## 8. Persistencia local (localStorage / IndexedDB)

Prefijo `macropro_`. Claves clave: `inventory_v1`, `clients_v1`, `crm_v1`, `captacion_v1`, `metas_v1`, `apartados_v1`, `ofertas_v1`, `solicitudes_asesor_v1`, `desarrollos_v1`, `cotizaciones_v1`, `asesores_v1`, `templates_v1`, filtros (`ejec_filtro_*`, `metas_filtro_*`), tokens (`api_key`, `inegi_token`, `drive_token`), `view_v1`, `active`, `autobackup`. **Patrón:** la app trabaja sobre localStorage y sincroniza por registro (last-write-wins) con Supabase; nunca reemplaza tablas completas.

---

## 9. Riesgos y deuda técnica (para la auditoría)

1. **Un solo archivo de ~19k líneas sin build ni pruebas.** Difícil de mantener; el JSX se transpila en el navegador (costo de arranque + `Babel` en cada carga). Riesgo alto de regresiones.
2. **Listas de etapas duplicadas a mano (~15 lugares).** Causaron el bug de "Cotización" (una etapa que no estaba en todas las listas hacía desaparecer prospectos). *Ya corregido en todas*, pero la causa raíz (no hay una sola fuente de verdad) sigue viva → riesgo de que se repita al agregar etapas. **Recomendación fuerte: derivar todas de `PIPELINE_STAGES`.**
3. **API key de Anthropic en el cliente** (§6).
4. **RLS incompleto** (§6): el candado debe vivir en la base.
5. **Filtros persistidos que esconden datos.** El scorecard de Metas quedaba vacío por un filtro viejo ("HITO"). *Ya se auto-corrige*, pero conviene auditar otros filtros persistidos con el mismo patrón.
6. **Dependencia de la Landing para HubSpot.** Si la Landing deja de sincronizar `hubspot_deals_pendientes`, el Pipeline de HubSpot se congela. La frescura se muestra (ámbar si >3 h), pero no hay alerta activa.
7. **Vínculo deal→lote inexistente en HubSpot.** El Pipeline de HubSpot muestra **negocios, no inventario**: casi ningún deal trae `lote_id`, así que no dice qué lote está comprometido. (Declarado en pantalla.)
8. **Versión inconsistente** (badge v5.2 vs. v8.x en repo).
9. **Sin CI ni validación automática de "no se cae".** La validación es manual (harness jsdom local: Babel compila + monta sin crash). No cubre bugs de lógica (dato filtrado de más). 
10. **Duplicados de archivos** en el repo (`public/intelligence.html`, `public/intelligence (8).html`) de subidas por la interfaz de GitHub.

---

## 10. Mejoras recomendadas (priorizadas)

**P1 — Robustez / que no se rompa (alto impacto, bajo riesgo):**
- **Fuente única de etapas:** que `ORDEN_ETAPAS`, `ETAPAS_MOSTRAR`, mapas de color/probabilidad, etc. se generen de `PIPELINE_STAGES`. Elimina de raíz la clase de bug "etapa desaparecida".
- **Guard automático pre-publicación:** un check que detecte listas de etapas incompletas y filtros que escondan todo. (Ya existe el patrón del chequeo; falta dejarlo como script en el repo.)
- **Auditar filtros persistidos** (Ejecutivo, Metas, CRM) para que ninguno pueda dejar una pantalla vacía sin avisar.

**P2 — Seguridad:**
- Mover la **API key de Anthropic a un proxy servidor** (Edge Function con el token en secreto).
- **Endurecer RLS** en Supabase (candado en la base, no solo `MP_READONLY_SHARED`).
- Revocar escrituras anónimas donde no se necesiten.

**P3 — Mantenibilidad:**
- **Partir `index.html`** en módulos con un build ligero (Vite) — sin cambiar el modelo de deploy si se quiere, pero con transpilación en build en vez de en el navegador (arranque más rápido, menos frágil).
- **Pruebas automáticas** mínimas: montar cada vista sin crash + validaciones de datos (que ningún prospecto/lote se pierda por filtros).
- Unificar el **número de versión** y mostrarlo real en la UI.
- Limpiar archivos duplicados del repo.

**P4 — Producto:**
- **Panel de conciliación deal→lote** (ligar los ~pocos deals de apartado/contrato/escriturado a su lote) para que el Pipeline de HubSpot sí diga qué inventario está comprometido.
- **Alerta activa** cuando `hubspot_deals_pendientes` lleve X horas sin sincronizar.
- **Metas por asesor** (además de por desarrollo/desarrollador).
- **Retención automática** de documentos de captación (hoy es manual con "Depurar documentos").

---

## 11. Cambios recientes (esta línea de trabajo)

- **Pipeline de HubSpot revivido** (solo lectura) desde `hubspot_deals_pendientes`, 7 columnas agrupadas, frescura visible, respeta los filtros del CRM (empresa/desarrollo/asesor/búsqueda).
- **Subida de documentos de captación** desde la ficha de Opción **y** desde el formulario público `captar.html` (mismos tipos → palomean el checklist), con estado "Listo para analizar" y depuración manual.
- **Bug "Cotización"** (prospecto desaparecido del Ejecutivo) corregido en **todas** las listas de etapas.
- **Control de Vendidos** en Ejecutivo (Con / Ocultar / Solo vendidos).
- **Metas:** persistencia en la nube (no re-subir Excel), scorecard al mes, apartados del mes, y **auto-corrección de filtro atorado** (ya no queda el scorecard vacío por un filtro viejo).
- **Captación:** dictamen PDF a Storage + "certificado de uso de suelo" siempre solicitado.

---

_Fin del informe. Para profundizar en cualquier módulo (código exacto, líneas, tablas y columnas), se puede extender por sección._
