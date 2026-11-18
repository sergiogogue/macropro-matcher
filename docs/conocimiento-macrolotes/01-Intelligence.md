# 01 · Intelligence (Guía Intelligence / GUÍA LOTES™ Intelligence)

> Documento de conocimiento técnico-comercial. Se basa solo en la lectura del código y los documentos de los repositorios.
> **Que algo esté en el código no prueba que funcione en producción.** Todas las referencias usan `macropro/<ruta>` y `landing/<ruta>`.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Fecha de revisión | 2026-11-18 |
| Entorno | Solo inspección de código y documentos. No se abrió ninguna URL de producción, no se consultó Supabase/HubSpot/BigQuery ni se envió ningún mensaje. |
| **Disponibilidad en producción** | **NO verificada.** Tampoco se verificó si las variables de entorno, los crons, el Worker de IA ni las migraciones SQL están configurados o se corrieron. |
| MacroPro | rama `claude/wizardly-cerf-QhtU1`, commit `aa8fb8b` ("SLA + Blindaje: SQL (Fase 1) y reloj en las tarjetas del Kanban (Fase 3) (#170)"); árbol limpio |
| Landing | rama `main`, commit `3f81213` ("SLA + Blindaje · Fase 2: avisos de GG-IA al 75 % y 100 % y resumen semanal de expedientes (#3172)"); árbol limpio |
| Ejecución local | Sí, de forma limitada: una prueba **offline** en Node 22. Se reemplazó `fetch` por un simulador, sin variables de entorno reales y con datos ficticios (ver §3, estado "Probada"). Se probaron las funciones `intelligence-acceso`, `intelligence-invitado-validar`, `intelligence-invitado-crear` y la función pura `fixOVTotals`. **No** se corrió el harness jsdom de MacroPro (`macropro/scripts/smoke_mount.js`) porque requiere `npm install` desde la red. |

### 1.1 Alcance inspeccionado (archivos)

- **Landing:** `landing/public/intelligence.html` (17,015 líneas), `landing/public/intelligence-prefill.js`, `landing/public/intelligence.webmanifest`, `landing/public/sw.js`, `landing/public/normas-zapopan.json`, `landing/src/pages/IntelligenceDocs.jsx`, `landing/src/components/AbrirIntelligence.jsx`, `landing/src/components/InteligenciaGuia.jsx`, `landing/src/components/GestionColaboradores.jsx`, `landing/src/components/Navbar.jsx`, `landing/src/components/FichaLote.jsx`, `landing/src/components/FichaAsesorLayout.jsx`, `landing/src/pages/Opcionadores.jsx`, `landing/src/pages/PortalDesarrollo.jsx`, `landing/src/components/publico/SeccionTecnologia.jsx`, `landing/src/App.jsx`, `landing/src/lib/auth.js` y `landing/src/config/navigation.js`.
- **Funciones de Netlify de la Landing:** `intelligence-acceso.js`, `intelligence-invitado-{crear,listar,revocar,validar}.js`, `dev-magiclink.js`, `dashboard-ceo.js`, `dashboard-ceo-config.js`, `informe-board.js`, `informe-narrativa.js`, `informe-decisiones.js`, `analytics-avanzado.js`, `cron-analytics(-cron).js`, `cron-tendencias(-cron).js`, `hubspot-deals-sync-cron.js`, `sync-macropro-cron.js`, `precio-posicion.js`, `guia-datalake.js`, `entorno.js` y `guia-agente.js` (solo las menciones). También la función de borde `landing/netlify/edge-functions/ia-intelligence.js` y el Worker `landing/workers/claude-proxy/{index.js,README.md}`.
- **SQL de la Landing:** `76_intelligence_acceso_2026-10-13.sql`, `intelligence_gobernanza_pr1_2026-10-13.sql`, `intelligence_invitados_pr3_2026-10-13.sql`, `intelligence_rol_ceo_2026-10-04.sql`, `intel_portal_desarrollador_2026-10-15.sql`, `intel_integracion_macropro.sql`, `intel_integracion_macropro_SCAFFOLD.sql`, `analisis_tendencias_2026-10-17.sql`, `rc_captura_2026-10-14.sql`, `rc_forecast_2026-10-21.sql`, `metas_expansion_2027.sql` y `mercado.sql`.
- **Documentos de la Landing:** `landing/INFORME_INTELLIGENCE.md`, `landing/docs/PANEL_CEO_Intelligence_Board_2026-10-16.md`, `landing/docs/DEMO_CEO_1pagina_2026-10-18.md`, `landing/docs/ALTA_desarrollador_intelligence_2026-10-15.md`, `landing/docs/intelligence-trazabilidad.md` y `landing/docs/mercado-tinsa.md`.
- **MacroPro:** `macropro/intelligence.html`, `macropro/public/intelligence.html`, `macropro/index.html` (puntos de enlace), `macropro/hub.html`, `macropro/admin.html`, `macropro/netlify.toml`, `macropro/vite.config.js` y `macropro/scripts/smoke_mount.js`.

### 1.2 Ambigüedad del nombre "Intelligence" (resolverla antes de vender)

El nombre "Intelligence" se usa para **varios artefactos distintos**. Este documento no los mezcla:

| # | Candidato | Qué es en realidad | ¿Lleva la marca "Intelligence"? |
|---|---|---|---|
| **C1** | `landing/public/intelligence.html` (+ `intelligence.webmanifest`, `intelligence-prefill.js`) | **El producto principal.** Es una app HTML independiente (PWA) titulada "GUÍA LOTES™ Intelligence" con valuador, informes IA, Mercado, Reporte Comercial, Panel CEO, Radar, portal del desarrollador e invitados. | Sí: `<title>` en la línea 6, "Intelligence Platform" en la línea 1224 y manifest `name: "Intelligence · Grupo Guía"`. |
| C2 | `macropro/intelligence.html` (83 líneas) | Una **redirección** a `https://macrolotes.grupoguia.mx/intelligence.html` que conserva `?fuente=…&c=…` y `#lote=…`. Comentario en las líneas 9–16: "APP RETIRADA — CONSOLIDACION EN UNA SOLA INTELLIGENCE (v341+)". | Sí (página de transición). |
| C3 | `macropro/public/intelligence.html` (7,069 líneas, "v75") | **Copia vieja** del valuador. Último commit: `b8cdde4`. Con el build de Netlify de MacroPro (`vite build` → `dist`), Vite copia `public/` a `dist/`, así que esa copia **podría** servirse si existe un despliegue en Netlify de MacroPro. No se verificó. | Sí ("Intelligence v75"). |
| C4 | `landing/src/pages/IntelligenceDocs.jsx` (ruta React `/valuador`) | Una pantalla aparte: "Opinión de valor con tus documentos". Usa el prompt "Eres Guía Intelligence, el valuador…" (línea 14). Su comentario dice que "No toca el intelligence.html existente". | Sí ("Guía Intelligence · documentos" en el menú). |
| C5 | `landing/src/components/InteligenciaGuia.jsx` (pestaña "Inteligencia Guía" del panel React) | Un hub React del Data Lake: Dash Mercado, Ficha del desarrollo, Ventas reales, Mercado, Desarrollos, Métricas 3 años y Asesores. El switch de Personas lo llama "Intelligence (Inteligencia Guía)". | Ambiguo: se rotula "Inteligencia Guía", pero el permiso se llama `intelligence_acceso`. |
| C6 | Funciones `dashboard-ceo*.js`, `analytics-avanzado.js` y `cron-analytics*.js` | Backend de "Intelligence · Paquete 2" (Specs 60/68). **No se encontró ningún consumidor** en `landing/src` ni en `landing/public`. | Solo en comentarios. |
| C7 | `informe-board.js`, `informe-narrativa.js`, `informe-decisiones.js` y `cron-tendencias*.js` | Backend que **sí** consume C1 (Panel CEO). `informe-narrativa`/`decisiones` también los usan componentes React (`NarrativaIA.jsx`, `CentroDecisiones.jsx`). | Se usan desde C1. |
| C8 | `landing/netlify/edge-functions/ia-intelligence.js` (`/api/ia-intelligence`) | Un proxy de IA "para Intelligence". **No se encontraron llamadas** en ningún repo. Hoy la IA pasa por un Worker de Cloudflare (ver §6). | Sí, en el nombre. |
| No es Intelligence | Rutas `/mercado` (`Conocimiento.jsx`), `/reporte-ventas` (`ReporteVentas.jsx` → `TableroNegocio`), `/terreno/:id/informe` (`InformeLote.jsx`) y `/portal-desarrollo` (`PortalDesarrollo.jsx`) | Son pantallas propias de la Landing. `/portal-desarrollo` **redirige al desarrollador real a `/intelligence.html`** (`PortalDesarrollo.jsx:609-617`), y `TableroNegocio` incrusta C5. | No. |

**Conclusión:** lo que hoy se marca y se enlaza como "Guía Intelligence" (desde MacroPro, el Hub, GG-IA y el menú del avatar de la Landing) es **C1**. C2 es solo un puente, C3 es un remanente y **C4 y C5 son productos distintos que comparten el nombre**. Salvo que se diga otra cosa, el resto del documento describe **C1**. C4 y C5 se mencionan solo cuando importan para el acceso o la venta. **Pendiente para Dirección:** fijar un nombre comercial único (ver §9).

---

## 2. Qué problema resuelve y para quién

Según el código, C1 junta dos grandes trabajos (igual que en `landing/INFORME_INTELLIGENCE.md` §1):

1. **Analizar un terreno (macrolote):** lee documentos (escritura, dictamen de usos/DTU, plano), extrae los datos clave, cruza normativa (COS/CUS/niveles), entorno, comparables e inventario propio, y produce una opinión de valor, una prefactibilidad, una pro forma y documentos imprimibles.
2. **Dirigir la operación comercial:** metas contra ventas reales (HubSpot), inventario, forecast, embudo, plan de acción, mercado por zona y un Panel CEO con decisiones.

Usuarios que aparecen en el código:

| Perfil | Relación con Intelligence (C1) | Evidencia |
|---|---|---|
| **Equipo Macrolotes / Dirección (owner, dirección, CEO)** | Usuario principal; es el único que entra a Mercado, Reporte Comercial y Panel CEO. | `intelligence-acceso.js:69-70,103`; `intelligence.html:11751,12959,14870-14886` |
| **Analista** (colaborador con `permisos.intelligence='analista'`) | Entra al valuador y a los informes IA. | `intelligence-acceso.js:104-108` |
| **Asesores** | Tienen botones "Guía Intelligence" en fichas y en Opcionar, pero **solo entran a C1 si se les dio rol** de analista o dirección. Sin rol, ven C4 (`/valuador`). | `FichaAsesorLayout.jsx:664`, `FichaLote.jsx:901,960`, `App.jsx:976` |
| **Desarrolladores** | Portal de solo lectura de **sus** desarrollos dentro de C1. | `intelligence-acceso.js:72-89`; `intel_portal_desarrollador_2026-10-15.sql` |
| **Invitados** (según el SQL: "asesor top o cliente institucional") | Ven en solo lectura una "foto" de **un** análisis de lote, con una liga que dura 7 días y está atada a su correo. | `intelligence_invitados_pr3_2026-10-13.sql:6-8` |
| **Propietarios/opcionadores** | **No entran.** Son sujeto del análisis: sus documentos llegan desde MacroPro, y existe un "Reporte de una hoja · Valor de la tierra (para el dueño)" que el equipo imprime. | `intelligence.html:10052`; `macropro/index.html:17650-17668` |
| **Brokers** | **Excluidos** de forma explícita: la Landing oculta `/valuador` y el botón cuando `esBroker`, y el Worker de IA solo acepta correos `@grupoguia.mx`. | `App.jsx:976`; `FichaAsesorLayout.jsx:646-649`; `workers/claude-proxy/index.js:111` |
| **Compradores** | No entran. Aparecen como datos (matching con `landing_clientes` y buyer personas). | `intelligence.html:4712`; `intelligence-prefill.js:168-169` |

---

## 3. Inventario de funciones (agrupado por flujo)

Formato: **Nombre**: usuario · entrada → acción → resultado · quién lo ve · límites · **[estado]** · referencia.
Las referencias sin prefijo son de `landing/public/intelligence.html`.

### Flujo A — Acceso y gobierno

- **A1. Login y control de acceso por rol**: cualquier persona del equipo · pone correo y contraseña (Supabase Auth); el dominio solo filtra por experiencia de uso → el servidor `intelligence-acceso` decide entre owner, dirección, desarrollador, analista o denegado, y registra en bitácora (`landing_auditoria_accesos`) → entra o ve el mensaje "acceso por invitación explícita" · lo ve solo quien inicia sesión · el acceso NO se da por dominio. **Ojo:** el switch "Puede entrar a Intelligence" de Personas (`intelligence_acceso`) **no cuenta** para este control (ver contradicción en §9) · **[Probada en local con datos ficticios]**: con `fetch` simulado, analista → entra con lotes; colaborador inactivo → denegado; switch encendido sin `permisos.intelligence` → `sin_rol`; sin variables de entorno → `sin_config` y 0 llamadas. La pantalla de login no se probó · `1099-1240`; `landing/netlify/functions/intelligence-acceso.js:44-111`.
- **A2. Entrada sin conexión**: usuario ya autorizado · último acceso guardado en `localStorage` (`ggIntel_acceso`) → entra en "modo offline" con un aviso · solo en ese navegador · requiere una sesión de Supabase guardada · **[Implementada en código, no probada]** · `1154-1165, 1200-1212`; `landing/public/sw.js:22`.
- **A3. Invitado temporal (OTP)**: owner o dirección crean la invitación; el invitado la abre · correo del invitado + análisis abierto → liga `/intelligence.html?inv=<token>` que expira en 7 días (la interfaz no manda `dias`, y el servidor acepta 1–30) → el invitado confirma su correo por OTP y ve una foto de solo lectura (`lote_data` = datos + HTML del análisis) · el panel "Gestionar invitados" lista y revoca · el sistema no envía la liga: el que invita la copia y la manda · **[Probada en local con datos ficticios]**: liga vencida → `expirado`; otro correo → `correo_no_coincide`; sin OTP → `falta_otp` con el correo enmascarado; vigente → entrega la foto; `dias=90` → 7 días. La interfaz no se probó · `11307-11490`; `intelligence-invitado-*.js`; `supabase/intelligence_invitados_pr3_2026-10-13.sql` (RLS sin políticas, solo service role).
- **A4. Portal del desarrollador**: desarrollador con `desarrollos_visibles` que no esté vacío · al entrar → RPCs `intel_dev_lotes`/`intel_dev_metas`/`intel_dev_deals` (security definer, limitadas a lo suyo) → inventario, metas contra ventas, embudo HubSpot y narrativa IA de **sus** desarrollos · solo él · solo lectura; si no tiene alcance, ve "No hay inventario visible" · **[Implementada en código, no probada]** · `12113-12125`, `1166-1170`; `supabase/intel_portal_desarrollador_2026-10-15.sql`; doc `landing/docs/ALTA_desarrollador_intelligence_2026-10-15.md`.
- **A5. "Ver como desarrollador"**: solo owner · elige un correo de `usuario_desarrollos` → genera un *magic link* para ver el portal como lo ve el desarrollador · **[Implementada en código, no probada]** · `15475-15490`; `landing/netlify/functions/dev-magiclink.js:1-5`.
- **A6. Alcance por lotes del analista**: el servidor devuelve `lotes` (`residenciales_visibles`), pero `window.__GG_LOTES` **no se usa** en ninguna otra parte de C1. El SQL dice "PR-2 hará el scoping server-side real" · **[Parcial / en desarrollo]** · `1145`; `intelligence_gobernanza_pr1_2026-10-13.sql:55`.

### Flujo B — Valuador: analizar un terreno

- **B1. Lectura de documentos con IA**: dirección o analista · PDF, imagen, Excel o CSV → la IA extrae nombre, superficie, uso de suelo, COS, CUS, niveles, estatus jurídico y coordenadas; junta los datos de varios documentos → ficha del lote. Si no logra leer nada, ofrece captura manual · resultado privado del usuario · las coordenadas son obligatorias antes de analizar · **[Implementada en código, no probada]** · `4941-5070`, `5286-5316`, `1371-1423`, `5549-5757`.
- **B2. Analizar desde el inventario**: abre desde la ficha de un lote en la Landing (`#lote=…`) → el *prefill* trae `v_landing_lotes`, `v_landing_corretaje`, `landing_clientes`, `landing_criterios` y `mercado_desarrollos` con la sesión del usuario (aplica RLS) · **[Implementada en código, no probada]** · `landing/public/intelligence-prefill.js:1-11,115-176`; `4440`; `AbrirIntelligence.jsx:26-38`.
- **B3. Semáforo normativo/legal, buyer personas y argumentario**: textos de IA (verde/amarillo/rojo, perfiles de comprador y argumentos de venta) · son interpretación de la IA, no dictamen · **[Implementada en código, no probada]** · `5318-5373`.
- **B4. Opinión de valor**: la IA calcula precio mínimo, de cierre y de lista por m² y en total. Se ancla en los comparables de `MI_DATA`, el valor residual, el entorno y el precio del vendedor; luego `fixOVTotals` recalcula total = $/m² × superficie · **Estimación.** El prompt trae una regla fija: "En GDL un macrolote H3/H4 vale ~4,000-12,000 MXN/m2" (línea 5387), y cuando el vendedor pide mucho menos que el residual pide "veredicto: comprar" (línea 5413) · **[Implementada en código, no probada]**; `fixOVTotals` está **[Probada en local con datos ficticios]** (10,000 m² × $5,000 = $50,000,000) · `5374-5503`.
- **B5. Valor residual de la tierra, pro forma (TIR/ROI), sensibilidad 1D/2D, tornado y mejor uso**: cálculo determinista con **supuestos** (precio de venta, costo de obra, blandos, utilidad del desarrollador) · son escenarios, no promesa · **[Implementada en código, no probada]** · `1950-2072`, `2457-2786`.
- **B6. Normativa COS/CUS**: si el dictamen trae el dato, ese manda. Si no, se usa un **catálogo de valores estimados** por municipio (Zapopan, Guadalajara, Tlaquepaque, Tonalá, Chapala, Benito Juárez; "confianza media"). El selector de "norma municipal real" lee `normas-zapopan.json`, que **solo contiene 1 zona DEMO** ("NO es dato normativo real") · **[Parcial / en desarrollo]** · `1970-2011`, `7638-7672`, `7103-7186`; `landing/public/normas-zapopan.json`.
- **B7. Entorno**: servicios cercanos (OpenStreetMap/Overpass, en vivo), negocios formales (INEGI DENUE vía proxy) y demografía (INEGI Censo 2020). El propio backend advierte que un indicador de población llega a nivel estatal y no municipal · **[Implementada en código, no probada]** · `2871-3100`; `landing/netlify/functions/entorno.js:143-165`.
- **B8. Comparables**: (a) del inventario propio (Supabase); (b) "internos" capturados y guardados en `localStorage`; (c) "web": un prompt a la IA con la herramienta `web_search` que pide "comparables **reales o estimados**" y, si falla, vuelve a pedirlos **sin** búsqueda web · los de (c) **son estimaciones de la IA y no están verificados** · **[Implementada en código, no probada]** · `9868-10050` (prompt en `9892`, *fallback* en `9952-9969`).
- **B9. Benchmark de mercado (MI_DATA) e indicadores Tinsa INCOIN**: lee un Excel o CSV "Mercado GDL–Chapala" que se sube (el texto dice "cada trimestre") o lo trae de `mercado_desarrollos` → mediana y cuartiles de $/m² por zona y producto. **Solo el precio ponderado $/m² se calcula.** Meses de inventario, absorción, plusvalía anual y días en mercado salen **❌ "Requiere…"**; cap rate sale como ⚠️ supuesto · **[Implementada en código, no probada]** · `1578-1600`, `1802-1900`, `7189-7220`; plantilla en `landing/docs/mercado-tinsa.md`.
- **B10. Mercado en vivo (posición de precio)**: un $/m² + zona + uso → arriba, en línea o abajo del mercado, comparado con Inmuebles24 (Data Lake/BigQuery) y con comparables propios · solo equipo; sin sesión o sin permiso no muestra cifras · **[Implementada en código, no probada]** · `7222-7360`; `landing/netlify/functions/precio-posicion.js:1-14`.
- **B11. Riesgos, score 0–100 y veredicto Compra/Revisar/No compra, estrategia de salida**: reglas deterministas con "compuertas duras" y pesos marcados como **supuestos configurables** · **[Implementada en código, no probada]** · `7362-7638`; `landing/docs/intelligence-trazabilidad.md` §"Fórmulas de decisión".
- **B12. Matching lote → clientes**: compara el lote con los criterios de compradores en `landing_clientes`/`landing_criterios` · interno · **[Implementada en código, no probada]** · `4623-4905`.
- **B13. Chat sobre el lote**: preguntas libres a la IA con el contexto de los documentos · **[Implementada en código, no probada]** · `5687-5756`.
- **B14. Autorización de macrolote**: dirección o analista eligen AUTORIZADO / REVISAR / NO AUTORIZADO, con folio, foto de evidencia y comentarios → documento imprimible y estadística. Se guarda en `localStorage` y se copia a la nube (`intelligence_autorizaciones`). "Se envía al asesor" quiere decir que **se imprime o se guarda en PDF y se manda a mano** · **[Implementada en código, no probada]** · `6057-6305`, `10741-10794`, `11243`.
- **B15. Estudios guardados**: se reabren desde `localStorage` y se sincronizan con `intelligence_estudios` · **[Implementada en código, no probada]** · `6448-6522`, `11228-11272`.
- **B16. Exportables del análisis**: PDF (`exportPDF`, `9361`), PPTX (`9643`), Opinión de Valor HTML/imprimible (`5975`), "Valor de la Tierra" en una hoja para el dueño (`10052`), Prefactibilidad (`7815`) y Dossier institucional (`8127`) · se generan en el navegador; el usuario decide a quién se los da · **[Implementada en código, no probada]**.
- **B17. Respaldo/restaurar y CRM expediente local**: **[Implementada en código, no probada]** · `11176-11227`, `10301-10666`.

### Flujo C — "Informes IA" (botones del encabezado)

- **C-1. Comunicación**: la IA redacta asunto y mensaje; **no envía nada** · prohíbe "plusvalía, rendimiento, retorno…" (cumplimiento PROFECO) · **[Implementada en código, no probada]** · `6627`, `6670`, `10822-10893`.
- **C-2. Opinión de valor factual**: se suben documentos propios → la IA da una opinión "solo hechos". Prohíbe recomendar comprar o vender, dar score o veredicto y usar "plusvalía/rendimiento/retorno" · **[Implementada en código, no probada]** · `6693-6777`, `6758`.
- **C-3. Plan de atracción**: buyer persona y plan por giro para marketing · **[Implementada en código, no probada]** · `6778-6843`.
- **C-4. Prefactibilidad**: tipologías viables según COS, CUS y niveles, con tabla de inversión, ingreso y margen · depende de B6 (normas DEMO o estimadas) · **[Implementada en código, no probada]** · `6844-7103`, `7687`.
- **C-5. Programa maestro, multiuso, escenarios y plano maestro SVG**: motor determinista · **[Implementada en código, no probada]** · `8800-9347`.
- **C-6. Render del proyecto**: hoy es un *stub* local (canvas con un volumen indicativo y etiqueta legal). El render "real" con un modelo de imagen depende de una ruta `/render` del Worker y de su llave; si no están, se usa el *stub* · **[Parcial / en desarrollo]** · `8220-8421`, `11017-11063`.
- **C-7. (C4) IntelligenceDocs `/valuador`**: cualquier usuario de la Landing que no sea broker · sube documentos (máx. 4 MB) o los carga solos con `?cot=<id>` desde `documentos_opcionador` → opinión de valor factual con los mismos candados anti-plusvalía · **[Implementada en código, no probada]** · `landing/src/pages/IntelligenceDocs.jsx:11-16,35-62,75-101`; `App.jsx:448-458,976`.

### Flujo D — Dirección: mercado, operación y consejo

- **D1. Inteligencia de Mercado** (menú "Mercado"): solo owner y dirección · pestañas: Mis Desarrollos, Por desarrollador, Evolución del mercado, Secundario/Precios, Características del Stock, Sociodemográfico y Macrolotes. **Crédito, Rentas/Cap, Decisión y Prefactibilidad están marcadas "soon"**. El indicador "ICG" de cada pestaña es un **valor fijo en el código** (85 %, 90 %, 88 %, 70 %, 75 %, 72 %), no un cálculo · **[Parcial / en desarrollo]** · `11611-11760`, `11773-11774`, `11756`, `11877`.
- **D2. Reporte Comercial** (board-ready por desarrollo o desarrollador): solo owner y dirección · Dashboard, Resultado (meta, real y forecast), Inventario, Cliente, Embudo, No compra, Plan de ventas, Buyer Persona, Forecast/Plan, Acciones y plan (Cap-Do), Marketing, Mercado por zona, Prefactibilidad y Ranking de desarrolladores · "Real de ventas = cierres REALES de HubSpot (firma de contrato)" · botón para sincronizar HubSpot "AHORA" · captura editable con RLS solo de dirección · funciona sin conexión con una cola en IndexedDB · exporta PDF y PPT (captura de pantalla de cada *slide*) · **[Implementada en código, no probada]** · `12603-14856` (gate `12958-12960`; HubSpot `13068-13080`, `12984`; forecast `13310`; captura `14491-14497`; offline `12774`; export `12856-12862`); SQL `rc_captura_2026-10-14.sql:47-60`, `rc_forecast_2026-10-21.sql:5,23-26`.
- **D3. Panel CEO · Intelligence Board**: owner, dirección o CEO · ¿Vamos a llegar? (semáforo por cumplimiento), ventas por desarrollo, apartados y pipeline, capital estancado, mercado (veredicto por zona desde `analisis_tendencias`), oportunidades y amenazas con IA ("la IA solo prioriza y redacta; validador anti-invención"), acciones, Registro de decisiones y exportar PDF con marca de agua. "Compartir" **solo copia la URL** (quien la recibe necesita acceso) · **[Implementada en código, no probada]** · `14857-15340`, `15299`, `14901`; `informe-board.js:1-13,57`; `informe-decisiones.js:1-5`. El doc `PANEL_CEO_Intelligence_Board_2026-10-16.md:15,85` dice "todas en producción, validado"; **es una afirmación del documento y no se verificó.**
- **D4. Radar de Expansión · Semáforo de Metas 2027**: abre desde el menú lateral · cruza `analisis_tendencias`, `datos_mercado_zona`, `lotes`, Data Lake y HubSpot → semáforo por ciudad/desarrollo, narrativa IA y "Plan de ataque" · guarda *snapshots* en `metas_expansion`. **En el cliente no revisa el rol** (cualquiera que pase A1 puede abrirlo; el RLS de `metas_expansion` deja leer y escribir a cualquier autenticado) · **[Implementada en código, no probada]** · `15708-17012`; `metas_expansion_2027.sql:44`.
- **D5. Integración MacroPro → Intelligence (bandera `?macropro=1`)**: inyecta tarjetas "🔌 MacroPro" desde `v_intel_cotizaciones`, `v_intel_comisiones` y `v_intel_captaciones_inventario` · apagada por defecto · **[Parcial / en desarrollo]**; el SQL "SCAFFOLD" dice que `cotizaciones_opcionador` y `acuerdos_comision` "NO existen", y el SQL definitivo las usa como reales (contradicción, §9) · `15515-15633`; `supabase/intel_integracion_macropro.sql`, `…_SCAFFOLD.sql:6-13`.
- **D6. Opcionador → Valuador**: con `?fuente=opcionador&c=<captación>`, lee `captaciones.documentos_urls`, regenera las URLs (pública o firmada) y carga los documentos en el valuador · **[Implementada en código, no probada]** · `15634-15707`. MacroPro lo dispara (ver §6).

### Flujo E — Backend sin consumidor visible / automatizaciones

- **E1. `dashboard-ceo`, `dashboard-ceo-config` y `analytics-avanzado`**: APIs de lectura de KPIs, rankings, tendencias y estacionalidad, protegidas con `intelligence_puede_analytics` (admin o CEO). **Ningún front las llama** · **[Implementada en código, no probada]** · `dashboard-ceo.js:1-15,39`; `analytics-avanzado.js:1-5,28`.
- **E2. Crons**: ver la tabla de frecuencias en §6 · **[Implementada en código, no probada]**.
- **E3. `/api/ia-intelligence` (función de borde)**: sin llamadas · **[Implementada en código, no probada]** · `landing/netlify/edge-functions/ia-intelligence.js:1-19,172`.

---

## 4. Pantallas y recorrido por perfil

| Perfil | Ver | Editar | Generar | Compartir | NO puede |
|---|---|---|---|---|---|
| **Owner** | Todo C1: valuador, informes IA, Mercado, Reporte Comercial, Panel CEO, Radar, portal "como desarrollador" | Metas, forecast, Cap-Do, No compra (RLS `landing_es_direccion`; `rc_forecast` solo admin) | Análisis, PDF/PPTX, autorizaciones, dossier, invitaciones | Liga de invitado (7 días); copiar URL del Board | — |
| **Dirección / CEO** | Igual que owner, salvo "Ver como desarrollador" | Igual que owner; el forecast depende de `landing_es_admin` | Igual | Invitaciones (si `landing_es_admin` o `permisos.intelligence='direccion'`). **Ojo:** `landing_es_direccion()` por sí sola deja **entrar**, pero **no invitar** (`intelligence-invitado-crear.js:24-36`) | — |
| **Analista** | Valuador, informes IA, estudios, autorizaciones, Radar (sin bloqueo de rol) | Sus estudios y autorizaciones | Análisis y exportables | No | Mercado, Reporte Comercial, Panel CEO (aviso "es de dirección") |
| **Asesor sin rol de Intelligence** | Botón "Guía Intelligence" en la ficha → C1 lo **rechaza** ("no está autorizada… Solicítalo a dirección"); C4 `/valuador`; C5 si tiene el switch | — | Opinión de valor con documentos (C4) | — | C1 |
| **Desarrollador** | Su portal: inventario, metas contra ventas, embudo y narrativa de **sus** desarrollos | Nada (solo lectura) | — | — | Valuador, Mercado, Reporte, otros desarrolladores |
| **Invitado** | Una foto estática de un análisis de lote | Nada | Nada | Nada | Analizar lotes nuevos |
| **Propietario/opcionador, comprador, broker** | Nada dentro de C1 | — | — | — | Todo (el propietario puede **recibir** el PDF que genera el equipo) |

**Público / privado / interno:** C1 es **privado**: requiere sesión y rol, y el `robots` de la copia de MacroPro es `noindex`. El **único contenido público** relacionado es la tarjeta de marketing "Intelligence — Analítica de mercado y plusvalía para decidir con datos" (`landing/src/components/publico/SeccionTecnologia.jsx:7`). Los documentos que genera el equipo (PDF/PPTX) son **material entregable**; el portal es **interno**.

---

## 5. Reparto de tareas

| Tarea | Usuario | Equipo / Dirección | Automatización | IA |
|---|---|---|---|---|
| Subir documentos y capturar coordenadas y precio del vendedor | ✔ | | | |
| Extraer datos del documento, semáforo, buyer persona, argumentario, OV, chat | | | | ✔ (Claude, vía Worker) |
| Valor residual, pro forma, score, riesgos, prefactibilidad, totales de OV | | | ✔ determinista (supuestos) | |
| Decidir AUTORIZADO / REVISAR / NO AUTORIZADO | | ✔ (humano) | | |
| Otorgar rol (`permisos.intelligence`), alta de desarrolladores, invitar o revocar | | ✔ owner/dirección | | |
| Cargar metas (`landing_metas`) y Excel de mercado; verificar `datos_mercado_zona` | | ✔ | | |
| Sincronizar HubSpot, tendencias, rankings, clientes MacroPro | | (también botón manual) | ✔ crons | |
| Priorizar y redactar oportunidades/amenazas y narrativa | | revisa | | ✔ (`informe-board`, `informe-narrativa`) |
| Registrar decisiones del Board | | ✔ | | |
| Enviar ligas, PDFs y correos redactados | ✔ manual | | ✗ el sistema no envía | |

**Política operativa por confirmar:** (a) quién revisa una opinión de valor de la IA antes de entregarla a un propietario → **Dirección + Legal**; (b) si el veredicto "Comprar" y la TIR pueden salir en material externo, dado el candado PROFECO de otros módulos → **Legal**; (c) quién tiene rol de analista o dirección y cada cuánto se revisa → **Dirección**; (d) quién sube el Excel de mercado y cada cuánto → **Equipo Macrolotes**; (e) el límite diario de IA (por defecto 500 llamadas por usuario en el Worker) → **TI/Dirección**.

---

## 6. Dependencias y conexiones (verificadas en código; configuración no verificada)

| Intercambio | Origen → Destino | Disparador | Quién lo ve | Si no está disponible |
|---|---|---|---|---|
| Autenticación y rol | Supabase Auth + `intelligence-acceso` → C1 | Al abrir o al hacer login | El usuario | "No se pudo verificar… Reintenta"; o modo offline con el acceso guardado (`1171-1180`, `1204-1209`) |
| IA (extracción, OV, informes) | C1/C4 → Worker Cloudflare → Anthropic; registro en `intelligence_uso` | Cada análisis o informe | Usuario `@grupoguia.mx` | Error visible; OV opcional (`5498-5501`); si la extracción falla → captura manual. **Correos de otros dominios del grupo pasan A1 pero el Worker los rechaza (401)** (`index.js:111` contra `intelligence.html:1109`) |
| Inventario, clientes, mercado | Supabase (`v_landing_lotes`, `landing_clientes`, `mercado_desarrollos`…) → valuador | Al abrir con `#lote=` | Según RLS del usuario | Cada conjunto falla por separado y vuelve a mostrar la carga manual (`intelligence-prefill.js:8-9`) |
| Benchmark | Excel/CSV del usuario → `MI_DATA` | Carga manual | Usuario | "SIN DATOS"; la OV se calcula sin comparables |
| Posición de precio | `precio-posicion` → `guia-datalake` (BigQuery, Inmuebles24) + inventario propio | Al analizar | Solo equipo | "Sin sesión/permiso/comparables" sin cifras. El Data Lake queda "dormido" si falta la credencial (`guia-datalake.js:6-7`) |
| Entorno | Navegador → Overpass (OSM); proxy DENUE; `entorno` (INEGI) | Al analizar | Usuario | Cada fuente es independiente; reintentos y *timeout* |
| Cierres y pipeline | HubSpot → `hubspot_deals_pendientes` | Cron `*/15 * * * *` + botón "sync" | Dirección, desarrollador (lo suyo) | "Pipeline vacío" (❌ honesto) |
| Tendencias de mercado | Data Lake → `analisis_tendencias` (`cron-tendencias`) | Cron `0 9 1 * *` (día 1, 03:00 CDMX), mensual; o manual con `intelligence_puede_analytics` | Dirección/CEO (RLS) | Veredicto de zona en ❌ hasta el siguiente corte |
| Rankings de asesores | RPC → `analisis_rankings` (`cron-analytics`) | Cron `0 9 * * *` diario | Admin/CEO; **sin consumidor en el front** | — |
| Clientes MacroPro | `public.clientes` → `landing_clientes` (`sync-macropro-cron`) | Cron `*/15 * * * *` | Matching interno | Matching con datos viejos |
| Metas | Excel de MacroPro subido por Dirección → `landing_metas`; `rc_metas` por año | Manual | Dirección/desarrollador | Semáforo sin meta |
| Perfil de zona | `datos_mercado_zona` (semilla INEGI "por verificar", columna `verificado`) | Manual (admin) | Equipo autenticado | "sin dato", baja confianza |
| MacroPro → Valuador | Ficha de captación (MacroPro) → `…/intelligence.html?fuente=opcionador&c=<id>` | Botón "🧠 Analizar en Intelligence" (`macropro/index.html:17650-17668, 18658-18668, 19144-19155, 23622`) | Usuario con sesión **en el dominio de la Landing** | MacroPro valida antes que estén los documentos obligatorios (uso de suelo, plano, predial, ubicación); C1 los lee frescos de Supabase. El `localStorage` que escribe MacroPro no cruza dominios (el comentario lo reconoce) |
| Hub y Admin de MacroPro | `macropro/hub.html:150,327` → C1 ("Analítica y metas") | Clic | — | `macropro/admin.html:298-304` marca "⏳ Intelligence" como destino **pendiente** de los datos cargados |
| GG-IA | `guia-agente.js:4177` remite a `/intelligence.html` (metas, forecast, decisiones). `centro_decisiones` usa `intelligence_puede_analytics` (`:1054`). Oportunidades/Amenazas: "se está conectando… muy pronto" (`:3777-3780`) | Pregunta a GG-IA | Dirección | GG-IA manda la liga |
| IA del Board | `informe-board`/`informe-narrativa` → Anthropic (env de Netlify) | Botón "✦ Afinar con IA" | Dirección/CEO | "El frontend conserva el análisis base" (`informe-board.js:4`) |

---

## 7. Ejemplos de uso (DATOS FICTICIOS)

> Todos los nombres, cifras y correos son **inventados**. Los pasos marcados con "(no probado)" vienen de leer el código.

**Ejemplo 1 · Dirección valúa un predio con documentos.**
1. "Dirección Demo" abre Intelligence e inicia sesión. El servidor le asigna el rol `direccion` *(lógica probada con un simulador; el login real no se probó)*.
2. Sube "Escritura_PredioDemo.pdf" y "DTU_Demo.pdf" y captura las coordenadas ficticias 20.70, -103.40 con un radio de 3 km *(no probado)*.
3. La IA extrae: "Predio Demo Las Palmas", 10,000 m², H4, COS 0.7, CUS 2.1 *(no probado; si el DTU no trae CUS, se usa el **catálogo estimado** de Zapopan)*.
4. La opinión de valor propone $5,000/m² como precio mínimo, y el sistema recalcula el total en **$50,000,000 MXN** *(el recálculo `fixOVTotals` sí se probó con estos números)*.
5. Dirección revisa riesgos y score, marca "REVISAR" en Autorización, imprime el PDF y lo comparte a mano *(no probado)*.
   Lo que se muestra se divide en tres capas: **dato fuente** = superficie y uso del documento; **estimación** = OV, comparables "web" y COS/CUS de catálogo; **escenario** = pro forma y TIR.

**Ejemplo 2 · Asesor desde MacroPro.**
1. En MacroPro, la captación ficticia "Rancho Demo" tiene uso de suelo, plano, predial y una liga de Maps. El asesor pulsa "🧠 Analizar en Intelligence" (el flujo lo cubre `macropro/scripts/smoke_mount.js:178-208`, **que no se corrió**).
2. Se abre `/intelligence.html?fuente=opcionador&c=…`. Si el asesor **no** tiene `permisos.intelligence`, la pantalla de acceso lo rechaza.
3. La alternativa que el código sí permite es "Guía Intelligence · documentos" (`/valuador?cot=…`, C4): carga los documentos del opcionador y da una opinión de valor factual *(no probado)*.

**Ejemplo 3 · Invitar a un inversionista institucional.**
1. Con un análisis abierto, Dirección pulsa "Compartir", escribe `invitado.demo@ejemplo.test` y genera la liga. Expira a los 7 días *(backend probado con simulador)*.
2. Dirección copia la liga y la manda por su cuenta. El sistema no la envía.
3. El invitado abre la liga y confirma su correo con OTP. Si entra con otro correo, recibe "correo_no_coincide"; con su correo ve la foto del análisis en solo lectura *(backend probado)*. Dirección puede revocarla desde "Gestionar invitados" *(no probado)*.

---

## 8. Traducción a ventas

**Mostrable al prospecto contra interno.** Se puede **mostrar**: la opinión de valor, el reporte de una hoja de Valor de la Tierra, la prefactibilidad, el dossier y el PDF/PPTX del análisis, siempre revisados por una persona. Es **interno**: el portal, los roles, la bitácora, los nombres de tablas, los proveedores de IA, los crons, el Data Lake, las métricas de asesores y el Panel CEO.

| Perfil | Beneficio respaldado por código | Frase que SÍ se puede usar | Afirmación que REQUIERE confirmación |
|---|---|---|---|
| **Propietario/opcionador** | Hay un análisis de su terreno con documentos, normativa y comparables, y un reporte de una hoja (`10052`) | "Revisamos los documentos de tu terreno y te entregamos una opinión de valor por escrito, con las fuentes que la sustentan." | "Valuación" o "avalúo" (no es un avalúo pericial), el **plazo** de entrega, que la cifra "es el valor de mercado" → **Legal/Dirección** |
| **Desarrollador** | Portal de solo lectura de sus desarrollos: metas contra ventas, embudo e inventario (A4) | "Tendrás un portal privado donde ves tu inventario, el avance contra metas y tu embudo, solo de tus desarrollos." | "En tiempo real" (HubSpot se sincroniza cada 15 min según el código, sin verificar en producción); cantidad de desarrolladores activos → **TI/Equipo Macrolotes** |
| **Comprador / inversionista institucional** | Acceso temporal de solo lectura a un análisis (A3); prefactibilidad y pro forma como **escenarios** | "Te podemos compartir el análisis del predio en una liga privada atada a tu correo." | TIR, ROI, "veredicto: comprar", **plusvalía** → **Legal** (ver contradicción PROFECO en §9) |
| **Asesores / brokers** | Botón desde la ficha; opinión de valor con documentos (C4) | "Desde la ficha puedes pedir una lectura de valor sobre los documentos del terreno." | Que todos los asesores entren a C1 (requiere rol); a los brokers **no** se les debe ofrecer → **Dirección** |
| **Dirección (interna)** | Panel CEO, Reporte Comercial con cierres de HubSpot, PDF para consejo | "Metas contra ventas reales de HubSpot en una pantalla, con PDF para consejo." | "Las 7 fases en producción" (solo lo dice el documento) → **TI** |

**Frases a evitar** mientras Legal no lo apruebe: "analítica de **plusvalía**" (el texto público actual en `SeccionTecnologia.jsx:7` choca con el candado anti-plusvalía de `6527`, `6670` y `IntelligenceDocs.jsx:11-14`, y con el KPI "Plusvalía anual ❌" en `7214`); "absorción" o "meses de inventario" por zona (❌ en el valuador; solo existen si `datos_mercado_zona`/Tinsa tienen datos); "IA que no se equivoca"; "24/7"; "cumplimiento normativo garantizado" (la norma municipal es DEMO).

---

## 9. Pendientes (no son funciones)

| # | Pendiente / contradicción | Evidencia | Preguntar a |
|---|---|---|---|
| 1 | **Nombre**: C1, C4 y C5 se presentan como "Intelligence" o "Inteligencia Guía". Hay que definir cuál se vende con ese nombre. | §1.2 | Dirección |
| 2 | **Dos modelos de acceso**: el switch de Personas (`intelligence_acceso`, "Intelligence: solo quien actives aquí", `GestionColaboradores.jsx:604-606,776`) controla C5, **no** C1, que usa `permisos.intelligence` y RPCs de admin/dirección (comprobado en la prueba local). | `76_intelligence_acceso…sql`; `intelligence-acceso.js:102-111` | Dirección + TI |
| 3 | Los asesores ven botones a C1, pero sin rol los rechazan; `INFORME_INTELLIGENCE.md:20-26` menciona un rol "asesor" e invitados "con código" que **no existen** en `intelligence-acceso.js` (el invitado usa OTP por correo). | — | TI |
| 4 | Dominios del grupo distintos de `@grupoguia.mx`: pasan el filtro de login, pero el Worker de IA los rechaza. | `intelligence.html:1109`; `workers/claude-proxy/index.js:111` | TI |
| 5 | Alcance por lotes del analista: no se aplica (A6). | `1145` | TI |
| 6 | **Candado PROFECO contra TIR, ROI, veredicto "Comprar" y regla fija de $/m²** en el valuador; además, el texto público habla de "plusvalía". | `5387`, `5413`, `2457-2560`, `7416`; `SeccionTecnologia.jsx:7` | **Legal** + Dirección |
| 7 | La norma municipal real no está cargada (`normas-zapopan.json` = 1 zona DEMO) y el COS/CUS por catálogo es estimado. | B6 | Equipo Macrolotes (fuente: Plan Parcial) |
| 8 | Los comparables "web" son de la IA ("reales o estimados"): falta saber si se etiquetan así en el PDF que se entrega. | `9892` | Dirección + Legal |
| 9 | KPIs Tinsa (absorción, meses de inventario, plusvalía, DOM) sin fuente; plantilla con datos de muestra. | `7189-7220`; `docs/mercado-tinsa.md` | Equipo Macrolotes |
| 10 | ICG fijo en el código para las pestañas de Mercado. | `11756`, `11877` | TI |
| 11 | Configuración no verificada: Worker (llave, `LIMITE_DIARIO`, tabla `intelligence_uso`), `ANTHROPIC_API_KEY`, credencial del Data Lake, `CRM_CRON_SECRET`, HubSpot, crons registrados y si las migraciones SQL se corrieron. | §6 | TI |
| 12 | No se encontró migración ni RLS en los repos para `intelligence_estudios` ni `intelligence_autorizaciones` (C1 escribe y borra ahí). | `11241-11263` | TI |
| 13 | El Radar de Expansión no revisa el rol, y `metas_expansion` deja leer y escribir a cualquier autenticado. Hay que definir si el analista debe verlo. | `17005`; `metas_expansion_2027.sql:44` | Dirección |
| 14 | `hubspot-deals-sync-cron.js`: el comentario dice "cada hora", el código dice `*/15`. | líneas 1-2 y 13 | TI |
| 15 | Integración MacroPro (D5): el SCAFFOLD dice que `cotizaciones_opcionador` y `acuerdos_comision` no existen, y el SQL definitivo las usa. | `intel_integracion_macropro*_SCAFFOLD.sql:6-13` | TI |
| 16 | Remanentes: `macropro/public/intelligence.html` v75 (¿se sirve en algún despliegue de Netlify?); función de borde `/api/ia-intelligence` y APIs `dashboard-ceo*`/`analytics-avanzado` sin consumidor. | §1.2 | TI |
| 17 | Versión inconsistente: `<title>` v101, insignia v368, comentarios "v341". | `6`, `1239` | TI |
| 18 | Sesión entre dominios: MacroPro (GitHub Pages) abre C1 en el dominio de la Landing; el usuario necesita una sesión aparte ahí. | `macropro/index.html:17665-17667` | TI |
| 19 | Que los PDFs para el propietario se revisen por una persona antes de entregarlos; que el uso de datos del propietario (INE, escritura) por la IA tenga aviso de privacidad. | B4, C-7; `macropro/index.html:17662` | **Legal** |
| 20 | Afirmaciones de los documentos "en producción, validado" (Panel CEO, primer corte de tendencias). | `PANEL_CEO_Intelligence_Board_2026-10-16.md:15,81-93` | TI / Dirección |
