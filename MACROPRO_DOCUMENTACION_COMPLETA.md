# MacroPro — Documentación completa

_Grupo Guía · `sergiogogue/macropro-matcher` · estado a 2026-11-05 · rama `main`._
_Documento exhaustivo: qué es, qué hace, qué tiene, cómo funciona por dentro, qué comparte, sus riesgos y pendientes._

---

## 0. Índice
1. Resumen ejecutivo
2. Qué es MacroPro
3. Arquitectura
4. Despliegue y entornos
5. Navegación y vistas (todas)
6. Módulos a fondo
7. Motor de matching
8. Supabase (tablas, storage, auth, RLS)
9. Integraciones externas
10. Reportes y exportaciones
11. Persistencia local (localStorage / IndexedDB)
12. PWA / Service Worker
13. Seguridad
14. Validación y CI (harness)
15. Estructura del repositorio
16. Historial de funcionalidades recientes
17. Riesgos, deuda técnica y mejoras
18. Pendientes parqueados

---

## 1. Resumen ejecutivo
MacroPro es el **CRM + motor de matching inmobiliario** de Grupo Guía para macrolotes/terrenos y desarrollos. Cruza **clientes ⇄ lotes** en ambos sentidos, administra el pipeline comercial, la captación de terrenos, las metas, el dashboard ejecutivo y genera reportes (PDF/PPTX/iCal/Excel). Es una **PWA instalable**, construida como **un solo `index.html`** (React 18 + Babel en el navegador, sin build), desplegada en **GitHub Pages**, sincronizada con una **Supabase compartida**. La usan ~3 usuarios de confianza (gerencia/dirección); **todos ven y editan todo**.

---

## 2. Qué es MacroPro
- **Dominio:** macrolotes y desarrollos inmobiliarios (terrenos grandes).
- **Funciones núcleo:** matching Cliente→Lotes y Lote→Clientes, CRM (pipeline, prospectos, interacciones, seguimiento por asesor), captación de terrenos ("Opción"), metas por desarrollo, dashboard ejecutivo con semáforo de seguimiento, corretaje con mapa, comparador de lotes, panel de matches con score, y un valuador separado (Guía Intelligence).
- **Usuarios y permisos:** 3 usuarios de confianza. "Logueado = acceso total; sin login = nada." El campo `asesor` de los registros es **dato de negocio, no control de acceso** — no hay permisos por territorio.
- **Versión UI:** badge **v5.2** (hay referencias internas a v8.x; pendiente unificar).

---

## 3. Arquitectura
- **Todo en `index.html`** (~19,600 líneas). Un bloque `<script type="text/babel">` con React 18 + ReactDOM + **Babel-standalone transpilando JSX en el navegador** (runtime **clásico**, `React.createElement`). **No hay build step** para la app.
- **Componente raíz:** `MacroProMatcher()`. Vistas = componentes anidados (`ViewHome`, `ViewCRM`, `ViewEjecutivo`, `ViewMetas`, `ViewCorretaje`, `ViewCaptacion`, `ViewMatchClient`, `ViewMatchLot`, `ViewComparador`, `ViewMatches`, `ViewClients`, `ViewLots`, `ViewDocumentos`, `ViewDashboard`, `ViewAsesores`, `ViewQuickSearch`, `ViewAdmin`, `ReporteSemaforo`…).
- **Cliente Supabase = `sb`** (no `supabase`). Key *publishable*.
- **Librerías por CDN (versión fija):** React/ReactDOM 18.2.0, Babel-standalone 7.23.2, SheetJS/xlsx 0.18.5, Leaflet 1.9.4 (+markercluster 1.5.3), jsPDF 2.5.1 (+autotable 3.8.0), PDF.js 3.11.174, pptxgenjs, Supabase-js v2.
- **Idioma:** español (UI, comentarios, mensajes).
- **Otras páginas sueltas (no React):** `hub.html` (portal), `captar.html` (formulario público de captación), `buscar.html`, `admin.html`, `intelligence.html` (valuador, copia).

---

## 4. Despliegue y entornos
- **GitHub Pages**, sirve la **RAÍZ** de `main` → `https://sergiogogue.github.io/macropro-matcher/`. Cada push a `main` dispara "pages build and deployment" (no corre Vite; publica los archivos tal cual). **No hay CNAME** (no es dominio propio).
- **⚠ `macrolotes.grupoguia.mx` NO es MacroPro** — es la **Landing** (repo aparte `grupoguiamacrolotes-landing`, en Netlify). Comparten la misma Supabase. El `intelligence.html` que vive en ese dominio lo publica la Landing. **Regla: no tocar la Landing.**
- **Trampa:** existen `package.json` (Vite), `vite.config.js`, `src/*.jsx` y `netlify.toml`, pero **NO son lo que corre** — la app es el `index.html` crudo de Pages. Todo cambio va en `index.html`.
- **Flujo de deploy usado:** commit en rama → `git push origin HEAD:main` → Pages despliega. Actualización al usuario: hard reload / banner "Actualizar" (PWA).

---

## 5. Navegación y vistas (todas)
Menú superior, en orden: **🏠 Inicio · 📄 Documentos · 📊 Dashboard · 🎯 CRM(n) · ⬡ Ejecutivo · 🎯 Metas · 🗺️ Corretaje · 🌱 Opción · 🤝 Buscando · 🔍 Búsqueda · 👤 Cliente→Lotes · 🏗 Lote→Clientes · 📋 Matches(n) · 👥 Clientes · 📦 Inventario**.

Vistas internas registradas (`VISTAS`): `home, dashboard, ejecutivo, metas, clients, lots, crm, admin, matchClient, matchLot, quickSearch, asesores, captacion, corretaje, comparador, matches`.

---

## 6. Módulos a fondo

### 6.1 Inicio (`ViewHome`)
Portada con accesos rápidos a inventario, clientes y matching; indicadores de carga.

### 6.2 Documentos (`ViewDocumentos`)
Centro de Documentos: agrupa los generadores de PDF/PPTX por **audiencia** (junta/dirección, desarrollador, cliente, captación) y lleva a la pantalla donde se produce cada reporte. Es el "gancho" para que gerencia sepa qué presentar.

### 6.3 Dashboard (`ViewDashboard`)
Tablero general de inventario + CRM (KPIs, distribución).

### 6.4 CRM (`ViewCRM`) — núcleo comercial
Tabs: **Dashboard · Mi día · Prospectos · Kanban · Oportunidades · Asesores · Benchmark**.
- **Kanban**: dos tableros apilados —
  1. **🔶 Pipeline de HubSpot** (solo lectura, arriba): lee `hubspot_deals_pendientes` (de la Landing, sync horario), **agrupa 17 etapas crudas en 7 columnas** (Prospecto/Contactado/Interesado/Apartado/Contrato/Cerrado/Perdido) + "Sin etapa"; muestra frescura ("sincronizado hace X", ámbar >3h); **no arrastrable**; respeta los filtros del CRM (empresa/desarrollo/asesor/búsqueda).
  2. **📋 Tablero propio** (editable, abajo): `crm_lotes.pipeline`; arrastrar cambia la etapa. **No toca** `lotes.status_inventario` ni HubSpot.
- **Pipeline propio (13 etapas):** Prospecto, Por Contactar, Contactado, Cita, Visita, **Cotización**, En análisis, En negociación, Propuesta, Apartado, Contrato, Vendido, Descartado.
- **Semáforo de seguimiento:** verde (≤30 días sin contacto), amarillo (≤60), rojo (>60), gris (sin seguimiento / vendido / descartado).
- Filtros: empresa (TYA/Corretaje/Favier/HITO/Garvi…), desarrollo, asesor, semáforo, canal, búsqueda. Mapeo empresa→desarrollo.
- Acciones por lote: ficha, historial, seguir por asesor, asignar cliente, cotizar, match, comparar.

### 6.5 Ejecutivo (`ViewEjecutivo` + `ReporteSemaforo`)
- **Dashboard Ejecutivo:** KPIs (terrenos, valor inventario, ventas año, monto vendido, ticket promedio, prospectos activos, negociación/propuesta), gráficas (valor por uso de suelo, por tamaño, por etapa/pipeline), performance por desarrollador, tendencia.
- **Semáforo · Seguimiento:** reporte por **canal → etapa**, con último comentario, semáforo, y **control de Vendidos** (Con / Ocultar / Solo vendidos para reporte). Exportación a PDF. Filtro de desarrollador con **auto-sanación** (si queda en un valor sin datos, vuelve a "Todos").
- **Informe del desarrollador** (botón dedicado).

### 6.6 Metas (`ViewMetas`)
- **Scorecard por desarrollo** (anual) + **Scorecard al mes** (acumulado Ene→mes actual) con Plan U/$, Real U/$, % cumplimiento, estatus.
- **Columna "🔖 Apartados del mes"** (unidades + monto $ con 2 decimales, captura manual, color naranja).
- **Tendencia mensual con momentum del CRM** (plan + real + lotes en Apartado/Contrato) y **gráfica de ventas reales** ($/m² por mes).
- **Importa Excel de metas** (hojas por desarrollador: Plan/SGG/Real en UNIDADES y MONTO; usa "Captura Ventas" como fuente autoritativa; mapea desarrollador desde ⚙️ Catálogos) y **persiste en la nube** (`app_config/metas_v1`) → no re-subir.
- **Filtro de desarrollador con auto-sanación** (evita scorecard vacío por filtro viejo tipo "HITO").
- **Imprimir / PDF** (2 hojas).

### 6.7 Corretaje (`ViewCorretaje`)
Inventario de corretaje + **mapa Leaflet** de macrolotes coloreados por uso de suelo; demanda vs oferta por uso.

### 6.8 Opción / Captación (`ViewCaptacion`)
Pipeline de captación de terrenos: **Nueva opción → Viabilidad → Documentación → Contrato**. Ficha por terreno con:
- Datos (propietario, contacto, zona/ciudad/estado, superficie, precio dueño, uso, liga Maps, tipo de acuerdo, comisión, notas).
- **Dictamen PDF** (AUTORIZADO / REVISAR / NO AUTORIZADO) → se sube a Storage `captaciones-docs`.
- **Responder al asesor** (WhatsApp/correo) y comentarios.
- **Checklist de documentos con subida/descarga** (Spec de documentos): 📷 Fotos (4+), 📜 Certificado de uso de suelo, 🗺 Plano, 🧾 Boleta registral/predial, 📍 Liga de Google Maps. Estado "📥 Docs N/5" / "✅ Listo para analizar" (badge también en la tarjeta). "Otros archivos" conserva dictamen + lo que suba el dueño por `captar.html`. Botón **🗑 Depurar documentos** (retención manual).
- **Cruzar con clientes** (demanda) y **Pasar a inventario**.
- La hoja PDF "Documentos para la opinión de valor" pide siempre: Plano, **Certificado de uso de suelo**, Dictamen de trazos, Boleta predial, INE, 4 fotos, Avalúo.

### 6.9 Cliente→Lotes (`ViewMatchClient`)
Navegador: elige **un cliente** (lista con filtros status/asesor/búsqueda) → filtra inventario y ve los lotes que le encajan. **Banner proactivo** al seleccionar cliente: "✨ Este cliente encaja con N lotes · mejor: X (score) → Ver" (lleva a 📋 Matches). Si 0 ≥60 → nota gris.

### 6.10 Lote→Clientes (`ViewMatchLot`)
Navegador inverso: elige **un lote** → ve los clientes que encajan (pre-filtra por compatibilidad). **Banner proactivo** al seleccionar lote: "✨ Este lote encaja con N clientes · mejor: X (score) → Ver".

### 6.11 Comparador Inteligente (`ViewComparador`) — Spec 61
Compara **2–5 lotes lado a lado**. Filas: Ubicación, Superficie, Precio, Precio/m² (color vs mercado), Uso, COS/CUS, Desarrollador, Amenidades/Servicios (💧⚡🚽🛣️), Posición vs mercado (%), Competencia cercana, Absorción ("sin dato"). Mejor celda por fila resaltada; ganador con borde dorado. **Recomendación por algoritmo** (precio/m² vs mercado + servicios + CUS + viv_max + status) con razón. Acciones: 📱 WhatsApp · ✉️ Correo · 💾 Guardar (localStorage) · 👤 Enviar al cliente · 📄 PDF. Selección por **checkbox ⚖️ en tarjetas del Inventario** + **barra flotante** "Comparar (N)". Buscador propio para agregar lotes.

### 6.12 Matches (`ViewMatches`) — Spec 67
Hub central: por cada **cliente** sus mejores lotes con **score 0–100** (≥ umbral, default 60, ajustable 50–90), ordenados. Chip de color (🟢≥80 · 🟡60–79 · ⚪<60) + razones. Por match: estado **Pendiente/Contactado/Cerrado** (historial en localStorage), **Ver lote**, **Abrir en Cliente→Lotes**, **✉️ Avisar** (mailto al cliente). Sección **🔔 Lotes nuevos con clientes que encajan** (alerta reactiva) + badge "📋 Matches (N)" en el nav. Filtro "Solo pendientes".

### 6.13 Clientes (`ViewClients`)
Catálogo de clientes/prospectos (nombre, empresa, asesor, correo, teléfono, tipo_comprador, ciudad_interes[], uso_interes[], presupuesto min/max, sup min/max, status, deal_breakers). Carga por Excel.

### 6.14 Inventario (`ViewLots`)
Catálogo de lotes con análisis + lista filtrable (ciudad, desarrollo, uso, precio…). Tarjeta con datos + acciones (ficha, historial, seguir, asignar, cotizar, match, **⚖️ comparar**, borrar). Carga por Excel.

### 6.15 Buscando (`ViewAsesores`) y Búsqueda (`ViewQuickSearch`)
Seguimiento de solicitudes de brokers/intermediarios y búsqueda rápida de lotes/clientes.

### 6.16 Admin (`ViewAdmin`) + `admin.html`
Subida masiva a Supabase (inventario, clientes, metas), conteos, mantenimiento.

---

## 7. Motor de matching
- **`buscarMatchesParaSolicitud(solicitud, inventory)`** (núcleo): puntúa cada lote vs una solicitud. Pesos: superficie 20 · frente 15 · precio 20 · estado 15 · ciudad 15 (fuzzy, incluye ZMG Guadalajara) · uso 15 → ~100. Devuelve `{lot, score, razones, descalificadores, descalificado}`. Hay **descalificadores duros** (superficie/precio fuera de rango, zona distinta).
- **`cruzarTerrenoConDemanda(terreno, clientes, solicitudes)`**: cruza un terreno contra la demanda (clientes + solicitudes); internamente usa `buscarMatchesParaSolicitud`.
- **`scoreClienteLote(cliente, lote)`** (Spec 67, extiende el núcleo): mapea el cliente (arrays `ciudad_interes`/`uso_interes`, `presupuesto_max`, `sup_min/max`) a "solicitud", toma el **mejor combo** ciudad×uso, y **normaliza a 0–100** sobre los criterios que el cliente sí especificó. Explicable (razones). **No reescribe el núcleo** — lo envuelve.
- **IA (opcional):** matching/valuador podían llamar a `api.anthropic.com` con key en localStorage (a migrar a proxy, ver §13). El Comparador y Matches usan **algoritmo**, sin IA.
- **Catálogos de uso/comprador:** `uso_interes` (10 valores) y `tipo_comprador` (4) con normalización por texto exacto (acentos/espacios) para cruzar con la Landing.

---

## 8. Supabase
**Proyecto:** `xugrrabebphdelgwqnwc` (org Grupo Guía, plan Free). Cliente `sb`, key publishable. **Compartida** con la Landing y el valuador.

### 8.1 Tablas que MacroPro usa
| Tabla | MacroPro | Notas |
|---|---|---|
| `crm_lotes` | **lee/escribe** | Kanban propio (pipeline, prospectos, interacciones, seguimiento). Upsert por `lote_id`. |
| `app_config` | **lee/escribe** | `metas_v1` (persistencia de metas). |
| `ofertas` | **lee/escribe** | Historial cliente↔lote (ofrecido/análisis/descartado/vendido). |
| `solicitudes_asesor` | **lee/escribe** | Solicitudes de brokers. |
| `captaciones` | **lee/escribe** | Terrenos en opción + `documentos_urls` (jsonb). |
| `lotes` | **lee** (escritura neutralizada) | Inventario. `status_inventario` solo se llena por Excel (admin). |
| `clientes` | **lee** (escritura neutralizada) | Catálogo de clientes. |
| `desarrollos` | **lee** (escritura neutralizada) | Catálogo de desarrollos. |
| `inventario_full` | escritura neutralizada | Espejo del inventario. |
| `cotizaciones` | lee | Cotizaciones. |
| `asesores` | lee | Catálogo de asesores. |
| `hubspot_deals_pendientes` | **lee** (paginado) | Tabla de la Landing (sync horario). Pipeline de HubSpot. |
| `landing_clientes`, `landing_criterios`, `v_landing_lotes` | lee | Compartidas con la Landing. |

### 8.2 Storage
- Bucket **`captaciones-docs`** (público): documentos de captación (fotos, uso de suelo, plano, boleta/predial) + PDF del dictamen. Políticas: `anon INSERT` (formulario público), `authenticated` insert/update + lectura pública.

### 8.3 Auth
Supabase Auth email/contraseña (`getSession`, `onAuthStateChange`, `signInWithPassword`, `signOut`).

### 8.4 RLS (auditado 2026-09)
**Todas las tablas que MacroPro usa tienen RLS activo** con políticas `authenticated` (captaciones deja `anon INSERT`). **MacroPro está protegido.** Las exposiciones detectadas (9 tablas con RLS off + varias políticas `{public}`) son de la **Landing/valuador** → `docs/HALLAZGOS_RLS_COMPARTIDA.md` (para su dev; no se tocó para no romper la Landing).

---

## 9. Integraciones externas
| Integración | Uso | Cómo |
|---|---|---|
| **HubSpot** | Pipeline comercial (solo lectura) | No directo: la Landing sincroniza → `hubspot_deals_pendientes` (horario); MacroPro lee. |
| **Anthropic (Claude)** | Matching IA / valuador | API key en `localStorage` (`macropro_api_key`) → llamada directa del navegador (a migrar a Edge Function `anthropic-proxy`). |
| **INEGI / DENUE** | Demografía del entorno | token `macropro_inegi_token`. |
| **Google Drive** | Respaldo JSON | OAuth (`macropro_drive_token`). |
| **Google Maps** | Ubicación | `liga_maps` / lat-lng por lote/captación. |
| **MacroCotizador** | Cotizar lote | enlace desde la ficha del lote. |

---

## 10. Reportes y exportaciones
- **PDF (jsPDF + autotable):** dictamen de captación, reporte de seguimiento (Semáforo Ejecutivo, con último comentario completo), scorecard de Metas (2 hojas), reporte de captación, "semáforo para opción" (con QR a `captar.html`), instrucciones de solicitud, informe de demanda, **comparativa de lotes** (Comparador). (~10 generadores.)
- **PPTX (pptxgenjs):** presentaciones ejecutivas / estrategia comercial.
- **iCal (.ics):** recordatorios/seguimientos al calendario (`descargarICS`).
- **Excel (SheetJS):** importación de inventario, clientes, metas y competencia (benchmark).
- **Compartir:** WhatsApp (`wa.me`) y correo (`mailto`) en dictámenes, comparativas y matches.

---

## 11. Persistencia local (localStorage / IndexedDB)
Prefijo `macropro_`. Claves actuales:
- **Datos:** `inventory_v1`, `clients_v1`, `crm_v1`, `captacion_v1`, `metas_v1`, `apartados_v1`, `ofertas_v1`, `solicitudes_asesor_v1`, `desarrollos_v1`, `desarrollos_dev_v1`, `cotizaciones_v1`, `asesores_v1`, `fichas_v1`, `planos_v1`, `mapeo_desarrolladores_v1`, `mercado_competencia`, `templates_v1`, `canales_v1`.
- **Spec 61/67:** `comparativas_v1` (comparativas guardadas), `matches_hist_v1` (estado de matches), `match_seen_lotes` (snapshot para alertas de lote nuevo).
- **Filtros:** `ejec_filtro_dev/desarrollo/asesor/etapa`, `metas_filtro_dev/desarrollo`, `solicitud_filtro_pipeline`, `filter`, `vista_midia`, `view_v1`, `active`.
- **Tokens/estado:** `api_key` (⚠ Anthropic), `inegi_token`, `drive_token(_exp)`, `drive_last_backup`, `oauth_state`, `sync_auto`, `autobackup`, `cal_mode`, `id`, `idb`, `mi_asesor`.
- **Patrón:** trabaja sobre localStorage y sincroniza **por registro** (last-write-wins), nunca reemplaza tablas completas.

---

## 12. PWA / Service Worker
- `service-worker.js` (CACHE `macropro-v4`), estrategia **network-first** (online siempre trae lo nuevo; offline usa caché). `skipWaiting` + `clients.claim`.
- Banner "🔄 Hay una versión nueva · Actualizar ahora" → `SKIP_WAITING` → recarga única (`controllerchange`). `reg.update()` cada 60s.
- `manifest.json` instalable; íconos (favicon.svg/ico, apple-touch-icon, icon-192/512).

---

## 13. Seguridad
- **`MP_READONLY_SHARED = true`**: neutraliza en código las escrituras a tablas compartidas (lotes, clientes, desarrollos, inventario_full, landing_clientes) para no revertir la limpieza de la Landing. Escribibles: crm_lotes, app_config, ofertas, solicitudes_asesor, captaciones. Reversible con el flag.
- **RLS:** MacroPro protegido (§8.4). Hardening de tablas de la Landing pendiente (su dev).
- **⚠ API key de Anthropic en el navegador** (`macropro_api_key`) → riesgo; mitigación escrita: Edge Function `anthropic-proxy` (R-01, por desplegar).
- **Deduplicación:** `loteKey()` fuerza ids en minúscula; índice único en `lotes`. No cambiar el case sin migrar referencias.
- **Secretos:** repo limpio (sin keys reales en árbol ni historial).

---

## 14. Validación y CI (harness)
- **`scripts/validate.js`** (guard): Babel compila el bloque JSX + verifica que **toda lista de etapas del pipeline esté completa** respecto a `PIPELINE_STAGES` (previene la clase de bug "Cotización desaparecida"; detectó y corrigió el bug de acento "En negociación").
- **`scripts/mount.js`**: monta la app en jsdom (render de 1 pasada) → "monta sin crash".
- **`.github/workflows/validate.yml`**: corre ambos en cada push/PR a `main`.
- Regla del proyecto: cada cambio se valida con Babel + guard + monta-sin-crash antes de publicar.

---

## 15. Estructura del repositorio
```
index.html              ← LA APP (React+Babel, ~19.6k líneas)
hub.html, captar.html, buscar.html, admin.html, intelligence.html
service-worker.js, manifest.json, supabase.js (bundle)
scripts/   validate.js, mount.js            ← guard/CI
.github/workflows/validate.yml
sql/       (15 archivos)                     ← migraciones/políticas Supabase
supabase/functions/  anthropic-proxy, sync-hubspot-deals  ← Edge Functions
docs/      ANEXOS_AUDITORIA.md, HALLAZGOS_RLS_COMPARTIDA.md
src/, public/, netlify/, netlify.toml, vite.config.js, package.json  ← NO sirven la app
*.md       CLAUDE.md, AUDITORIA_MACROPRO(_2026-09), CHANGELOG, README, INFORME_SESION, SPRINT6…
íconos, guia-asesores.pdf, las-rosas-square.svg
```

---

## 16. Historial de funcionalidades recientes
- **Metas:** apartados del mes, scorecard al mes, persistencia en nube, auto-sanación de filtro.
- **Captación:** dictamen PDF a Storage, "certificado de uso de suelo" siempre solicitado, **subida de documentos** desde la ficha y desde `captar.html` (checklist + depuración).
- **Pipeline de HubSpot** revivido (solo lectura, 7 columnas, respeta filtros del CRM).
- **Bug "Cotización"** corregido en todas las listas de etapas + **guard anti-recurrencia** + **CI**.
- **Ejecutivo:** control de Vendidos; auto-sanación de filtro.
- **Spec 61 · Comparador Inteligente** (2–5 lotes, recomendación por algoritmo, acciones, PDF).
- **Spec 67 · Motor de Matching** (score 0–100 explicable, vista 📋 Matches, alertas 🔔, historial, banners proactivos inline).

---

## 17. Riesgos, deuda técnica y mejoras
1. **Monolito de ~19.6k líneas, Babel en navegador, sin build** → arranque pesado, frágil. *Mejora:* partir en módulos con Vite (R-14/R-15).
2. **Listas de etapas duplicadas** → mitigado con el guard; *mejora:* fuente única `PIPELINE_STAGES`.
3. **API key de Anthropic en el cliente** → *mejora:* proxy (R-01).
4. **RLS de tablas compartidas (Landing)** abierto → *mejora:* hardening coordinado (R-03).
5. **Dependencia de la Landing** para HubSpot (si deja de sincronizar, el pipeline se congela; hay frescura visible, falta alerta activa).
6. **Deal→lote** inexistente en HubSpot (el pipeline muestra negocios, no inventario).
7. **Versión inconsistente** (v5.2 vs v8.x).
8. **Sin servidor/cron** → "automático/correo" se resuelve reactivo + mailto.

---

## 18. Pendientes parqueados
- **R-01 · `anthropic-proxy`** (Edge Function escrita; falta desplegar + rotar key + cablear la app).
- **R-02 · bucket privado + URLs firmadas** (coordinar código + consola).
- **R-03 · hardening RLS de la Landing** (`docs/HALLAZGOS_RLS_COMPARTIDA.md` para su dev).
- Opcionales de producto: panel de conciliación deal→lote, metas por asesor, retención automática de documentos, alerta de frescura HubSpot, observabilidad.

---

_Fin. Para profundizar en cualquier módulo (líneas exactas, columnas por tabla, fórmula de un score, un generador PDF concreto), se puede extender esa sección._
