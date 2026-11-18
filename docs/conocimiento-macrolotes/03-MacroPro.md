# 03 · MacroPro: back-office interno de Grupo Guía Macrolotes

> Documento de conocimiento elaborado a partir de la inspección del código. Describe lo que **está en el repositorio**, no lo que corre en producción. Cada afirmación importante incluye su referencia (`macropro/<ruta>:<línea>` o `landing/<ruta>:<línea>`). Cuando el código y la documentación anterior no coinciden, se señala.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Herramienta | **MacroPro** (en pantalla: "MacroPro by Grupo Guía", título del documento "MacroPro · Motor de Matching · Grupo Guía") — `macropro/index.html:6`, `macropro/index.html:23203-23207` |
| Alcance de este documento | La app principal `macropro/index.html` (componente raíz `MacroProMatcher()`, `macropro/index.html:3868`, envuelto por `AuthGate()`, `macropro/index.html:24630`) y sus piezas de soporte: `service-worker.js`, SQL de `macropro/sql/`. Las páginas auxiliares (`hub.html`, `admin.html`, `buscar.html`, `captar.html`, `journey.html`, `intelligence.html`) solo se mencionan cuando tocan los mismos datos. |
| Repositorio / rama | `sergiogogue/macropro-matcher`, rama de trabajo **`claude/wizardly-cerf-QhtU1`** |
| Commit inspeccionado | `aa8fb8b SLA + Blindaje: SQL (Fase 1) y reloj en las tarjetas del Kanban (Fase 3) (#170)` |
| Fecha del documento | 2026-11-18 |
| Versión visible en la app | La barra de navegación muestra **v6.14** (`macropro/index.html:23207`); el service worker se identifica como "v3 (v6.14)", caché `macropro-v125` (`macropro/service-worker.js:1`, `:14`). **Contradicción:** `CLAUDE.md` y `SPRINT6_LOGIN_SYNC.md` dicen "Versión actual: v8.5". |
| Entorno de análisis | Inspección estática del código (MacroPro y, para referencias cruzadas, Landing) + pruebas locales sin red: `scripts/validate.js`, `scripts/mount.js` y seis pruebas con jsdom y Supabase simulado (ver §3.14). No se llamó a URLs de producción, no se enviaron mensajes ni correos, no se hizo commit ni deploy. |
| Disponibilidad en producción | **No verificada.** Este documento no comprueba que lo descrito esté publicado en GitHub Pages ni que las tablas, funciones RPC y funciones de Netlify existan o estén configuradas en el Supabase real. |

---

## 2. Qué problema resuelve y para quién

### 2.1 Qué es MacroPro en este repositorio

MacroPro nació como **motor de matching Cliente ⇄ Lote** con CRM (así lo describen `macropro/README.md` y el encabezado de la pantalla de Inicio, `macropro/index.html:6595-6596`). En el código actual ya **no es principalmente eso**: desde la decisión "Back-Office · Option Engine" (2026-11-05), el menú se redujo y la app quedó como **back-office de captación de terrenos ("opciones")**. Hoy sirve para:

1. registrar terrenos que ofrecen los propietarios (captaciones/opciones) y moverlos por un kanban con relojes de SLA;
2. reunir el expediente del propietario (8 documentos) mediante una "Liga Mágica";
3. gestionar los **convenios de comisión** con los asesores (100/0 o 60/40);
4. emitir **cartas oferta** entre comprador y vendedor;
5. ver **requerimientos** de compradores y cruzarlos con terrenos;
6. **aprobar** captaciones para que la Landing las publique en el catálogo.

Evidencia: comentario del menú "Back-Office 'Option Engine' (2026-11-05): menú reducido…" (`macropro/index.html:23210-23213`); texto de Inicio "MacroPro en modo Option Engine: captura terrenos, cruza con tu cartera y administra" (`macropro/index.html:6662`); los accesos viejos de matching quedaron con render desactivado `{false && …}` (`macropro/index.html:6684-6686`).

### 2.2 Para quién (solo perfiles que aparecen en el código)

| Perfil | Cómo aparece en el código | ¿Usa MacroPro? |
|---|---|---|
| **Usuarios internos con sesión** ("Equipo", "Dirección") | `AuthGate` exige correo y contraseña de Supabase Auth (`macropro/index.html:24668-24681`); el pie del login dice "Grupo Guía · acceso interno" (`:24715`). `SPRINT6_LOGIN_SYNC.md` habla de 3 usuarios (director, gerente y asistente). | **Sí**, es el usuario directo. |
| **Administrador (servidor)** | No existe en el cliente, pero algunas funciones de la Landing que llama MacroPro exigen `landing_es_admin()` (rol `admin` en `usuarios_acceso`/`landing_acceso`): `landing/netlify/functions/correo-diagnostico.js:26-31`, `landing/netlify/functions/convenio-aplicar-6040.js:26-31`, `landing/netlify/functions/acuerdo-validar.js:3,53`; definición en `landing/supabase/fix_landing_es_admin_rls_2026-10-19.sql:24-36`. | Sí; es un subconjunto de los usuarios internos. |
| **Asesor (opcionador / corredor)** | Dueño de negocio del terreno (`asesorResponsableGG`, `lotes.asesor`). Recibe ligas (convenio, estatus) por WhatsApp/correo; firma su convenio **en la Landing** (`/acuerdo/<token>`), no en MacroPro (`macropro/index.html:1464-1468`). | **No entra** a MacroPro; recibe lo que MacroPro genera. |
| **Propietario / opcionador del terreno** | Recibe `/aceptar?c=<id>` y la Liga Mágica `/expediente/<token>` (`macropro/index.html:1481`, `:17516`). | No entra; sube documentos en la Landing. |
| **Comprador** | Parte de la carta oferta; recibe `/oferta/<token>` y `/mi-oferta/<token>` (`macropro/index.html:2924`, `:3231-3232`). | No entra. |
| **Vendedor** (propietario en la carta oferta) | Recibe la liga del vendedor, que vale 10 días (`macropro/index.html:2920-2923`). | No entra. |
| **Legal** | Recibe el expediente de la carta oferta mediante la función `oferta-legal` (`macropro/index.html:3188`). | No entra. |

### 2.3 Permisos: lo que dice el código

- **Cliente (navegador):** sin sesión no hay app. Con sesión, **todos son admin**: `const esAdmin = React.useMemo(()=> true, [sessionEmail]);` con el comentario "son 3 usuarios de confianza y TODOS ven y editan TODO" (`macropro/index.html:4924-4927`). El código del "candado" por asesor (`:4936-4941`) sigue ahí, pero nunca se activa.
- **Servidor:** sí hay una distinción de rol. Ver el estado de correos, aplicar 60/40 por política y **validar** un convenio requieren `landing_es_admin()`; si no, responden 403 y MacroPro muestra "Solo un administrador puede…" (`macropro/index.html:2222`, `:22095`).
- **Base de datos:** las tablas SLA solo se leen con sesión (`macropro/sql/sla_blindaje_fase1.sql`, sección 7). `docs/HALLAZGOS_RLS_COMPARTIDA.md` (2026-09-29) afirma que las tablas de MacroPro tienen RLS activo. **No verificado** contra la base real.
- **Contradicción con `CLAUDE.md`:** `CLAUDE.md` dice "No hay permisos… RLS solo distingue logueado/sin login". El código del cliente coincide (todo el mundo es admin), pero las funciones de servidor sí distinguen **admin / no admin**. Además hay páginas públicas sin login que escriben en la base: `buscar.html` inserta en `solicitudes_asesor` y `captar.html` inserta en `captaciones` (llave publicable).

---

## 3. Inventario de funciones

**Claves de evidencia:** [Probada en local con datos ficticios] · [Implementada en código, no probada] · [Documentada, no verificada en código] · [Parcial / en desarrollo] · [No verificada].
**Visibilidad por defecto:** cualquier usuario con sesión ve y edita todo (`esAdmin=true`), salvo que se indique otra cosa.

### 3.0 Navegación general

Menú superior (`macropro/index.html:23214`): 🏠 Inicio · 🌱 Opción / Captación · 📄 Documentos · 🧾 Cotización · 👔 Asesores · 🔍 Requerimientos · 🩺 Calidad de datos · ⚙️ Admin, más el botón **➕ Nueva Carta Oferta** (`:23217`), el indicador de sincronización, la llave de IA (🔑), la campana 🔔 de actividades y "Instalar app".
Vistas **ocultas pero vivas**: `dashboard`, `ejecutivo`, `metas`, `matchClient`, `matchLot`, `result`, `quickSearch`, `clients`, `lots`, `corretaje`, `crm`, `comparador`, `matches` (`macropro/index.html:23240-23299`). Se llega a ellas desde **📄 Documentos** (`:21558-21577`) o desde otras vistas ocultas. Si al abrir la app la vista guardada es una de estas, se manda a Captación (`:3897-3898`).

### 3.1 Acceso y sesión

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Pantalla "Inicia sesión para continuar" | Interno | Correo y contraseña → `signInWithPassword` → entra a `MacroProMatcher` con `sessionEmail` | No hay registro, recuperación de contraseña ni MFA en esta pantalla. Las cuentas se crean en Supabase. | [Implementada en código, no probada] | `macropro/index.html:24630-24718` |
| Botón "Salir" | Interno | Confirmación → `signOut()` sin `location.reload()` | Antes de cerrar la sesión vuelve a verificarla, para no sacar al usuario por un evento pasajero | [Implementada en código, no probada] | `:24683-24687`, `:24645-24656` |
| Montaje de la app | — | Compilación del JSX → render | — | [Probada en local con datos ficticios] (monta sin crash, sin Supabase) | `macropro/scripts/mount.js` |

### 3.2 Inicio (dashboard de opciones)

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| "Dashboard de Opciones": KPIs 🟡 En proceso · 🔴 Pendientes de firma · 🟢 Listos para publicar · 🚀 Publicados | Interno | Lee las captaciones locales y las clasifica (`publicadaLoteId` → `aprobadaPublicar` → liga sin firma → proceso) | Los cálculos salen del estado local, que se sincroniza cada 45 s | [Implementada en código, no probada] | `macropro/index.html:6604-6625` |
| "Últimos 10 movimientos" con alerta "⚠️ Sin documentos desde hace N días" | Interno | Alerta si hay liga y 0 documentos y ≥7 días | El umbral está fijo en el código | [Implementada en código, no probada] | `:6609-6610`, `:6640-6650` |
| "🔄 Actualizar inventario" | Interno | Vuelve a leer `lotes` (o `v_landing_lotes` como respaldo) | **Solo lectura**: el inventario se edita en la Landing | [Implementada en código, no probada] | `:6725`, `:5601-5620` |

### 3.3 Inventario / lotes (predios del catálogo)

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Carga del inventario desde la nube | Automático | Al iniciar: `lotes` sin baja (`dado_baja_at is null`), excluye `gen_*`, mapea a lote local | Si no responde, usa `localStorage` o un **inventario de muestra** ("⚠ Mostrando inventario de muestra") | [Implementada en código, no probada] | `:5601-5629`, `:6729-6731` |
| ID canónico de lote `loteKey()` | — | Quita `-rN`, minúsculas, espacios → `_` | `CLAUDE.md` lo ubica "≈línea 187"; en el código está en la **518** | [Implementada en código, no probada] | `:518-525` |
| Vista "Inventario" (`lots`), ficha técnica PPTX, Entorno DENUE (INEGI) con mapa y PDF | Interno | Lote → PPTX / consulta DENUE / mapa Leaflet | Vista oculta del menú (se entra por Documentos). La consulta DENUE sale del navegador hacia la API pública del INEGI. | [Implementada en código, no probada] | `:8346`, `:1851`, `:12296`, `:6369` |
| "➕ Desarrollo (Excel)" en Admin | Interno | Excel → RPC `landing_import_lotes` → **escribe en `lotes`** | Es una escritura a tabla compartida que **no** pasa por `MP_READONLY_SHARED` | [Implementada en código, no probada] | `:5906-5940`, `:8192` |

### 3.4 Matching Cliente → Lotes y Lote → Clientes

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Score de compatibilidad 0–100 (`scoreClienteLote`) | Automático | Cliente (ciudad/uso/superficie/presupuesto) × lote → score explicable con razones | Normaliza solo sobre los criterios que el cliente llenó | [Implementada en código, no probada] | `:877-896` |
| "Cliente → Lotes" / "Lote → Clientes" (`matchClient`/`matchLot`/`result`) | Interno | Selección → ranking; con llave de IA, un modelo de Anthropic re-ordena y argumenta | **Ocultas** del menú y de Inicio (`{false && …}`); se llega por Documentos → "Presentación de opciones (Match)" / "Match de clientes para su inventario". La IA requiere que el usuario pegue **su propia llave**, que se guarda en `localStorage`; el navegador manda los datos del cliente directo al API. | [Parcial / en desarrollo] (vivo pero deprecado) | `:6739`, `:6919`, `:7104`, `:6263-6266`, `:21567`, `:21571` |
| PPTX "Match Cliente→Lotes" / "Lote→Clientes" | Interno | Resultados → archivo `.pptx` | Carga PptxGenJS bajo demanda (`mpLib`) | [Implementada en código, no probada] | `:1963`, `:2009` |
| 🔔 Alerta "lote(s) nuevo(s) con clientes que encajan" | Automático | Compara los lotes nuevos con los clientes (score ≥60) | Solo en el navegador, sin servidor. La primera carga no alerta. | [Implementada en código, no probada] | `:3967-3982` |
| Alerta al guardar una captación **nueva**: busca requerimientos que coinciden (`rqBuscarRequerimientosParaTerreno`) | Automático | Terreno nuevo → cruza búsquedas fallidas, criterios de la Landing y compradores activos → modal `RqAlertaMatch` | Es el matching que hoy queda a la vista | [Implementada en código, no probada] | `:23646`, `:2311-2333`, `:2350` |

### 3.5 Clientes / CRM (compradores)

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Ficha del cliente → guardar en la nube (`mpUpsertClienteNube`) | Interno | Busca por vínculo → correo → teléfono → clave+nombre; si lo encuentra, hace UPDATE solo de los campos con dato; si no, INSERT | Excepción a `MP_READONLY_SHARED` pedida por Dirección. Nunca hace un upsert ciego. | [Implementada en código, no probada] | `:3821-3852` |
| Auto-subida de clientes (`subirClienteCloud`) | Automático | — | **Desactivada**: `if(MP_READONLY_SHARED) return;` | [Implementada en código, no probada] | `:4273`, `:4293-4302` |
| CRM por lote (pipeline 13 etapas `PIPELINE_STAGES`), Kanban, "Mi día", calendario, HubSpot espejo | Interno | Prospectos y actividades por lote → `crm_lotes` | Vista `crm` **oculta**. HubSpot se lee de `hubspot_deals_pendientes` (solo lectura). | [Implementada en código, no probada] | `:5644`, `:8596`, `:8608-8621` |
| Exportar actividad a calendario (.ics) | Interno | Actividad con fecha → descarga `.ics` | Archivo local; no se conecta a ningún calendario | [Implementada en código, no probada] | `:899-934`, `:13633` |
| Exportar CRM JSON | Interno | Botón → descarga JSON | El repo trae un export real (`CRM_MacroPro_2026-04-23.json`) con datos personales: **no debe circular** | [Implementada en código, no probada] | `:13318` |
| Guard del pipeline (validate.js) | CI/Dev | Exige que toda lista de etapas incluya las intermedias | — | [Probada en local con datos ficticios] (13 etapas OK) | `macropro/scripts/validate.js` |

### 3.6 Opción / Captación (kanban `CAPTACION_PIPELINE`) y reloj SLA

Etapas: **Nueva opción → Viabilidad → Cotización con el cliente → Contactado / visita → En negociación → Documentación → Contrato → Firmado** (+ Descartado) (`macropro/index.html:1087`).

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Registrar / editar terreno ("Opcionador · Editar Terreno", 💾 Guardar) | Interno | Propietario/zona/ciudad (mínimo uno) → calcula precio/m² → `captaciones` (upsert por id) | Escribe en la tabla compartida `captaciones` aunque `MP_READONLY_SHARED` esté activo (ver §6) | [Implementada en código, no probada] | `:23639-23646`, `:4527`, `:4603-4620` |
| Auto-avance del kanban | Automático | Documentos/aprobación/publicación → mueve la tarjeta **solo hacia adelante** | Respeta "Descartado" y los movimientos manuales de la sesión | [Implementada en código, no probada] | `:18713-18736` |
| Tarjetas "🌱 OPCIONADOR · LANDING" (cotizaciones aceptadas) y documentos del opcionador | Interno | Lee `cotizaciones_opcionador` + `documentos_opcionador`; permite subir/reemplazar documentos | URL firmada de 180 s para ver | [Implementada en código, no probada] | `:18680-18712`, `:18740-18760` |
| **Reloj SLA por tarjeta** (🟢 en tiempo · 🟡 advertencia ≥75 % · 🔴 vencido · ⏸️ pausado por expediente incompleto · ✅/☑️ cumplido) | Automático / Interno | RPC `sla_tablero` (caché de 60 s, refresco cada 5 min) → franja por etapa (Viabilidad 48 h, Documentación 48 h, Contrato 72 h) y fichas de entregables (Estudios 48 h, Fotografía 120 h); clic → `sla_cumplir` | Depende de que `sql/sla_blindaje_fase1.sql` esté corrido. Las horas son una "propuesta" ajustable en `sla_config`. El texto "Avisado a Dirección y al asesor por WhatsApp" depende del cron de la Landing. | [Probada en local con datos ficticios] (render de la franja con mock, ver §3.14) | `:2161-2211`, `:18687-18699`, `macropro/sql/sla_blindaje_fase1.sql:26-47,226,231,255` |
| Alertas SLA por WhatsApp (75 %/100 %) y resumen semanal | Automatización (Landing) | Cron cada hora 8–20 h CDMX → `sla_recalcular` → WhatsApp al Admin/asesor | Vive en la Landing; requiere WhatsApp y Resend configurados | [Documentada, no verificada en código] (en MacroPro); el código está en `landing/netlify/functions/sla-alertas.js:1-17` | — |
| 🔗 Copiar Liga Mágica / ♻ Regenerar Liga | Interno | Token → `https://macrolotes.grupoguia.mx/expediente/<token>`; regenerar = RPC `legal_regenerar_liga` (+15 días) | Necesita que la captación ya exista en la nube | [Implementada en código, no probada] | `:17507-17530` |
| 🧠 Analizar en Intelligence | Interno | Verifica uso de suelo, plano, predial y ubicación → abre Intelligence de la Landing con `?fuente=opcionador&c=<id>` | Si falta un documento, se bloquea con un aviso | [Implementada en código, no probada] | `:17650-17669` |
| Seguimiento del portal (hitos y métricas) | Interno | RPC `portal_seguimiento` / `portal_set_metricas`; marcar hito → función `portal-hito` (envía correo) | Las métricas (visitas, brokers, ofertas) se **capturan a mano** | [Implementada en código, no probada] | `:1601-1632` |
| 📊 Reporte de captación (PDF) | Interno | Genera el reporte | — | [Implementada en código, no probada] | `:18837-18842` |

### 3.7 Documentos (centro de reportes) y expedientes

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| "📄 Centro de documentos · ¿Qué necesitas presentar?" | Interno | Elige por audiencia (junta, desarrollador, cliente, captación) → lleva a la pantalla que genera el PDF/PPTX | **No guarda documentos**: es un menú de reportes que abre vistas ocultas | [Implementada en código, no probada] | `:21557-21622` |
| Expediente del propietario (8 documentos: Escrituras, Uso de suelo, Libertad de gravamen, INE, Plano, Boleta/predial, KMZ, Fotos ×4) | Propietario (Landing) / Interno | Alta/baja **atómica** por RPC `captacion_doc_agregar/quitar`; los privados van al bucket `documentos-opcionador` | Escrituras, gravamen e INE son privados (URL firmada) | [Implementada en código, no probada] | `:17485-17494`, `:17616-17640`, `:17670-17690` |
| Estatus legal por documento ("Aprobar") | Interno | RPC `captacion_doc_estatus` | — | [Implementada en código, no probada] | `:17554` |

### 3.8 Cotización (pestaña 🧾)

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| "Trámite de opción · Paso 1": liga y PDF **fijos** del Acuerdo de Comisión para mandar a cualquier asesor | Interno | Compartir texto+liga `/acuerdo` y el PDF | Los mismos para todos; "también te lo da GG-IA" | [Implementada en código, no probada] | `:1680-1700`, `:1740` |
| Cotización al propietario (`ViewPitchCotizacion`) | Interno | Terreno, superficie, precio/m², % de comisión → guarda en `cotizaciones_opcionador`; liga para el cliente `/aceptar?c=<id>`; PDF | El borrador se guarda en el navegador | [Implementada en código, no probada] | `:17787-17830`, `:18228`, `:18389-18398` |
| Abrir MacroCotizador externo | Interno | Abre `macrocotizador.vercel.app/cotizar?cliente_id&desarrollo&lote` | App externa; no hay REST entre apps | [Implementada en código, no probada] | `:231-248` |

### 3.9 Asesores (👔) y convenios de comisión

Pestañas: **📊 General · 👤 Por asesor · 🚩 Sin asesor · 📝 Cartas oferta** (`macropro/index.html:22446-22449`) + botón **📬 Estado de correos** (`:22409`).

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Etapa del terreno: **0 Sin convenio → 1 Enviado (liga realmente mandada) → 2 Cerrado/Firmado** (fuente única `etapaDe`) | Automático | Convenio cerrado (`firmado`/`validado`/`forzado_6040`) → 2; liga enviada confirmada → 1; si no → 0 | Un convenio **por asesor** cubre todos sus terrenos (captación y corretaje) | [Probada en local con datos ficticios] | `:21871-21874`, `:3865-3866` |
| Por asesor → kanban vertical Sin convenio / 📨 Enviado / ✅ Firmado, filtro 100/0 · 60/40 | Interno | Asesor → terrenos por etapa, folio, "recordatorio N de 5" | — | [Probada en local con datos ficticios] | `:22142-22190` |
| Generar convenio (RPC `acuerdo_crear`) y mandar la liga (WhatsApp `wa.me` + correo por `acuerdo-enviar-link`) | Interno | Se registra como "Enviado" **solo si el servidor confirma** `liga_enviada_at` | Sin token, cierra la ventana y no registra el envío | [Probada en local con datos ficticios] | `:1511`, `:21984`, `:22007-22060`, `landing/netlify/functions/acuerdo-enviar-link.js:1-20` |
| 🚩 Sin asesor: terrenos sin asesor y corretaje puro; asignar asesor (captación → `captaciones`; lote → RPC `landing_guardar_terreno`) | Interno | Nombre → asigna | Asignar asesor a un lote **escribe en `lotes`** por RPC | [Probada en local con datos ficticios] (clasificación) / [Implementada en código, no probada] (asignación) | `:21927-21960` |
| ⚖️ **Aplicar 60/40 ahora** (por política, sin firma) | Admin (servidor) | Confirmación "DEFINITIVO" → `convenio-aplicar-6040` con Bearer → estado `forzado_6040`, folio, aviso | 403 si no es admin | [Probada en local con datos ficticios] (llamada y 403 simulados) | `:22083-22100`, `landing/netlify/functions/convenio-aplicar-6040.js:1-31` |
| Recordatorio automático cada ≥2 días y 60/40 al 5.º recordatorio | Automatización (Landing) | Cron diario ~09:41 CDMX | **No vive en MacroPro**; requiere Resend y WhatsApp | [Documentada, no verificada en código] (en MacroPro) | `landing/netlify/functions/convenio-recordatorio.js:1-21`, `landing/netlify/functions/convenio-recordatorio-cron.js:10` |
| Validar convenio / reenviar PDF / cancelar pendiente / adenda | Equipo (admin) | `acuerdo-validar` (validar = solo Equipo) · RPC `acuerdo_cancelar_pendiente` | — | [Implementada en código, no probada] | `:1527-1545`, `landing/netlify/functions/acuerdo-validar.js:1-10,53` |
| Sello del convenio en la ficha del terreno (`SelloConvenio`) | Interno | Muestra "✓ 100/0 / 60/40 · folio" o "pendiente" y manda un correo con todos los terrenos pendientes | — | [Implementada en código, no probada] | `:2857-2915` |
| 📬 Estado de correos (últimos 50 en Resend: entregado / rebotó / spam / bloqueado) | Admin (servidor) | Bearer → `correo-diagnostico` | 403 → "Solo un administrador…" | [Probada en local con datos ficticios] (ver §3.14) | `:2213-2260`, `landing/netlify/functions/correo-diagnostico.js:22-31` |
| Capturar contacto del asesor (correo/WhatsApp) | Interno | Escribe en `asesores` (update o insert) | Tabla compartida | [Implementada en código, no probada] | `:22105-22120` |
| Compartir estatus al asesor (por terreno o el pipeline completo) | Interno | `ShareButtons` con `/expediente/<token>` o el panel `/asesores` | Máximo 15 líneas por mensaje | [Implementada en código, no probada] | `:21882-21896` |

### 3.10 Cartas oferta (wizard, panel y vista)

Estados (`CO_EST`, `macropro/index.html:2926-2936`): Borrador → Enviada al comprador → Firmó el comprador → Recibida (autorizada) → Enviada al vendedor → Contrapropuesta (vendedor/comprador, con rondas) → Aceptada / Rechazada.

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| ➕ Nueva Carta Oferta (wizard) | Interno | Terreno (lote disponible o captación activa) + comprador (o alta de cliente nuevo) + superficie/precio/apartado/forma de pago → INSERT `cartas_oferta` + ronda 1 → RPC `carta_oferta_liga` (comprador) | Alta de cliente = **INSERT** (excepción a solo lectura). Si falla la ronda 1, borra la carta. | [Implementada en código, no probada] | `:3382-3470`, `:3418`, `:3441-3448` |
| Autorizar y mandar al vendedor | Interno | RPC `carta_oferta_autorizar` → `carta-oferta-notificar` (correo) / copiar / WhatsApp | La liga vale 10 días y el comprador va como **"INVERSIONISTA CONFIDENCIAL"** para el vendedor | [Implementada en código, no probada] | `:3165-3185`, `:2979` |
| Enviar expediente a Legal | Interno | `oferta-legal` con Bearer | — | [Implementada en código, no probada] | `:3186-3192` |
| PDF formal (interno / vendedor) | Interno | Ventana de impresión en una sola hoja, razón social y sellos de firma con fecha/IP | — | [Implementada en código, no probada] | `:2970-2990` |
| Portal del comprador `/mi-oferta/<token>` | Interno | `ShareButtons` | **Solo** en Cartas oferta (decisión de Dirección) | [Implementada en código, no probada] | `:3231-3232`, `:3268` |
| Aviso al asesor (liga informativa de solo lectura) | Interno | `carta-oferta-avisar-asesor` | Sin duplicados en la sesión | [Implementada en código, no probada] | `:3046-3055` |

### 3.11 Requerimientos (🔍)

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Pestañas Compradores / Sin match | Interno | Lee `clientes` (paginado de 1000 en 1000), `macropro_req_estatus` y RPC `macropro_busquedas_fallidas` | — | [Implementada en código, no probada] | `:2372-2420` |
| "Buscar match" contra el inventario publicado | Interno | Ciudad + uso, ordenado por cercanía de superficie (`v_landing_lotes`) | Coincidencia por texto normalizado | [Implementada en código, no probada] | `:2445-2456`, `:2440` |
| Avisar al asesor por WhatsApp con el mejor terreno | Interno | Abre `wa.me` con un mensaje prellenado | Envío manual (lo manda la persona) | [Implementada en código, no probada] | `:2458-2468` |
| Marcar estatus (resuelto, etc.) | Interno | Upsert `macropro_req_estatus` / RPC `macropro_busqueda_estatus` | — | [Implementada en código, no probada] | `:2428-2431` |
| Borrar registros de **prueba** | Interno (admin para "Sin match") | Compradores → baja lógica `activo=false`; Sin match → RPC `macropro_busquedas_borrar` | Excepción (3) de `MP_READONLY_SHARED` | [Implementada en código, no probada] | `:2482-2500` |
| Estadísticas por ciudad/uso/asesor | Interno | Gráficas de barras | — | [Implementada en código, no probada] | `:2711-2856` |

### 3.12 Calidad de datos (🩺) y Admin (⚙️)

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| Calidad de datos: clientes sin presupuesto/ciudad/uso; lotes sin precio/superficie/entrega; captaciones sin precio/superficie; % de salud | Interno | Abre la ficha para corregir | Solo diagnóstico (las reglas están fijas en el código) | [Implementada en código, no probada] | `:3698-3740` |
| ✅ Aprobar para publicar · Macrolotes (Dirección) | Interno | Exige Fotos (4), Plano, Uso de suelo, KMZ, liga de Maps y Acuerdo firmado → marca `aprobada_publicar`; **la Landing** inserta en `lotes` | MacroPro no publica | [Implementada en código, no probada] | `:17495-17505`, `:17575-17592`, `:8170-8180` |
| Desarrollos: ✏️ Editar | Interno | Edita nombre, colores, coordenadas, logo… | **Silenciosamente no guarda en la nube** (`MP_READONLY_SHARED` devuelve `{error:null}`) pero muestra "✅ guardado" y el texto "Los cambios se guardan en Supabase" | [Implementada en código, no probada] (contradicción UI/código) | `:8125-8146` |
| ☁️ Subir a la nube (clientes + CRM) | Interno | Modal de migración: lotes y clientes **neutralizados**; `crm_lotes` sí se sube | El botón "migrar" es históricamente peligroso (incidentes de duplicación en `CLAUDE.md`) | [Implementada en código, no probada] | `:8215`, `:677`, `:714`, `:789` |
| Metas (`app_config.metas_v1`) | Interno | Guarda o lee metas | Vista `metas` oculta | [Implementada en código, no probada] | `:5405-5430`, `:15923` |

### 3.13 Compartir, exportaciones, mapas, sincronización y PWA

| Función (UI) | Usuario | Entrada → acción → resultado | Límites | Evidencia | Ref. |
|---|---|---|---|---|---|
| `ShareButtons`: WhatsApp · Copiar liga ("¡Liga copiada!") · Correo (mailto) | Interno | URL+mensaje → abre la app de WhatsApp/correo | **No envía nada por sí mismo**: abre el cliente de WhatsApp o de correo | [Implementada en código, no probada] (se usa dentro de los flujos probados de Asesores) | `:2263-2293` |
| Sincronización automática (indicador ☁️) | Automático | Cada 45 s, con la pestaña visible y sin ficha abierta: baja `crm_lotes` (fusiona), `captaciones`, `ofertas`, `solicitudes_asesor`, `clientes` (con `mpTraerTodo`); sube los cambios de CRM a los 2.5 s | Se apaga con el indicador; sin red queda lo local | [Implementada en código, no probada] | `:4258`, `:4280-4375`, `:2297-2306` |
| `bajarDeSupabase` (bajada manual) | Interno | Baja **solo** `crm_lotes` y fusiona | `CLAUDE.md` lo ubica "≈línea 1767"; está en la **5180** | [Implementada en código, no probada] | `:5180-5200` |
| Respaldo a Google Drive (OAuth) | Interno | Token → sube un respaldo | Opcional | [Implementada en código, no probada] | `:5035-5065` |
| PDF (jsPDF), PPTX (PptxGenJS), mapas (Leaflet), .ics | Interno | Ver módulos | XLSX/pdf.js/PPTX se cargan al usarse (`mpLib`) | [Implementada en código, no probada] | `:58`, `:1851`, `:6369`, `:899` |
| PWA / offline | Automático | SW v3: la app con red primero, las librerías del CDN con caché primero; no intercepta Supabase/Netlify | Sin red solo funciona lo local | [Implementada en código, no probada] | `macropro/service-worker.js:1-40` |

### 3.14 Qué se probó localmente y qué resultó

Todas las pruebas corrieron **sin red** (fetch rechazado o simulado; cliente Supabase simulado en memoria). Babel 7.23.2 con `presets:['react']`, igual que en producción.

| Prueba | Flujo | Resultado |
|---|---|---|
| `scripts/validate.js` | Compila el JSX y revisa que las listas de etapas sean coherentes con `PIPELINE_STAGES` | ✅ "VALIDACIÓN OK"; 13 etapas |
| `scripts/mount.js` | Monta la app en jsdom | ✅ "MONTA SIN CRASH" (aviso esperado: Supabase no disponible) |
| `fa-etapas-test.js` | Asesores: conteos Sin convenio/Enviado/Firmado iguales en KPI, menú, encabezados y héroe; asesor mixto; corretaje puro solo en "Sin asesor"; 60/40 por política cuenta como firmado | ✅ "TODO OK", 0 errores React |
| `fa-envios-test.js` | Envío de liga: sin token no abre WhatsApp ni registra; solo pasa a "Enviado" si el servidor confirma; doble clic = un envío; Aplicar 60/40 con Bearer; 403 → aviso de solo administradores | ✅ "TODO OK", 0 errores React |
| `firmado-test.js` | Convenio de corretaje firmado aparece en Por asesor → Firmado con folio y esquema 100/0, y sale de "Sin asesor" y "Enviado" | ✅ 0 errores React |
| `envios-test2.js` | 🚩 Sin asesor → corretaje "por enviar": tras enviar la liga, el asesor sale de Sin asesor y aparece en Por asesor → 📨 Enviado con su lote etiquetado "Corretaje" y botones Correo/WhatsApp | ✅ 0 errores React |
| `sla-card-test.js` | Reloj SLA en las tarjetas: pide `sla_tablero`; Viabilidad 🟡 "48 h · quedan 9 h"; Documentación ⏸️ "Envío a Legal en pausa · faltan 3 docs" con lista; Firmado con fichas de entregables (🟢/🔴 vencido) y semáforo ✅; clic en ficha → `sla_cumplir` | ✅ 0 errores React |
| `diag-test.js` | 📬 Estado de correos con respuesta simulada de `correo-diagnostico`: botón visible; la ventana muestra el remitente y "Resend ✅ configurado" (simulado); un correo entregado en verde y uno rebotado marcado | ✅ 0 errores React |

> **Aviso sobre los datos de prueba:** los datos de las pruebas son simulados (folios, tokens y estados inventados), pero varias filas usan **nombres y correos con apariencia de colaboradores reales**. Este documento no los reproduce. Se recomienda cambiarlos por datos ficticios evidentes (§9).

---

## 4. Pantallas y recorrido por perfil

### 4.1 Mapa de pantallas

| Pantalla | Ver | Editar | Compartir | Generar | Carácter |
|---|---|---|---|---|---|
| Login | — | — | — | — | Interna (sesión) |
| 🏠 Inicio | KPIs de opciones, últimos movimientos | — | — | — | Interna |
| 🌱 Opción / Captación | Kanban, relojes SLA, documentos | Terreno, etapa, documentos, asesor | Liga Mágica, liga del propietario | Reporte PDF, envío a Intelligence | Interna; genera ligas **públicas con token** |
| 📄 Documentos | Catálogo de reportes | — | — | PDF/PPTX (en las vistas destino) | Interna; los PDF/PPTX pueden salir a clientes |
| 🧾 Cotización | Acuerdos y cotizaciones | Cotización | Liga `/aceptar?c=`, liga fija `/acuerdo` | PDF de cotización | Interna → externa por liga |
| 👔 Asesores | General, Por asesor, Sin asesor, Cartas oferta, Estado de correos | Contacto del asesor, asignación | Liga de convenio, estatus, pipeline | 60/40 (admin) | Interna; Estado de correos y 60/40 solo admin (servidor) |
| 🔍 Requerimientos | Compradores, Sin match, estadísticas | Estatus, baja de pruebas | WhatsApp al asesor | — | Interna |
| 🩺 Calidad de datos | Faltantes | Abre fichas | — | — | Interna |
| ⚙️ Admin | Panel, desarrollos | Aprobar publicar, desarrollos (no persiste), alta Excel | — | — | Interna |
| ➕ Carta Oferta | Wizard y panel | Carta, rondas, vendedor | `/oferta/<token>`, `/mi-oferta/<token>` | PDF formal | Interna → ligas externas confidenciales |
| Vistas ocultas (CRM, Dashboard, Metas, Matching, Inventario…) | Sí, desde Documentos | Sí | Sí | PDF/PPTX | Interna |

**Públicas (fuera de MacroPro, pero generadas por él):** `/expediente/<token>`, `/aceptar?c=<id>`, `/acuerdo/<token>`, `/oferta/<token>`, `/mi-oferta/<token>`, `/mi-portal/<cap>` en `macrolotes.grupoguia.mx` (Landing). Son públicas para quien tenga el token. Algunas validan sesión del lado de la Landing (el convenio exige la cuenta del asesor según `macropro/index.html:1464-1468`).

### 4.2 Recorrido del usuario interno (el único que entra)

1. Login → Inicio (dashboard de opciones).
2. Opción / Captación: alta del terreno → la alerta de requerimientos sugiere compradores → semáforo de Viabilidad (reloj de 48 h) → Cotización al propietario → liga `/aceptar` → el propietario acepta y sube el expediente con la Liga Mágica (el reloj se pausa mientras falten documentos).
3. Asesores: generar y mandar el convenio → seguir "Enviado" → validarlo (admin) o, después de 5 recordatorios, aplicar 60/40 (cron o admin).
4. Admin: "Aprobar para publicar" → la Landing publica.
5. Carta oferta cuando aparece un comprador → firmas → Legal.

### 4.3 Perfiles que no entran

Asesor, propietario, comprador, vendedor y Legal solo interactúan con ligas de la Landing o con mensajes de WhatsApp/correo. Ninguno tiene pantalla en MacroPro.

---

## 5. Reparto de tareas: persona, equipo, automatización e IA

| Paso | Persona (usuario interno) | Automatización | IA | Fuera de MacroPro |
|---|---|---|---|---|
| Alta de terreno | Captura y guarda | Calcula precio/m²; busca requerimientos que coinciden | — | `captar.html` (público) también inserta captaciones |
| Avance del kanban | Mueve a mano | Auto-avance por documentos/aprobación/publicación (solo hacia adelante) | — | — |
| Reloj SLA | Marca entregables "cumplido" | Trigger `trg_sla_captacion` + `sla_recalcular` (BD) | — | Cron de la Landing manda WhatsApp a 75 %/100 % |
| Expediente | Comparte la liga, sube documentos si los recibe por otro canal, aprueba documentos | Pausa del reloj si faltan documentos | Intelligence (Landing) analiza escritura/INE/uso de suelo, si se manda | El propietario sube en la Landing |
| Convenio de comisión | Genera, manda (WhatsApp manual + correo automático), valida (admin) | Recordatorio cada ≥2 días y 60/40 al 5.º (cron de la Landing) | — | El asesor firma en la Landing |
| Carta oferta | Arma, autoriza, pone al vendedor, manda a Legal | Correos de notificación (funciones de la Landing) | — | Comprador y vendedor firman en la Landing |
| Matching | Elige cliente/lote | Score 0–100 por reglas | Re-ordenamiento y argumentos con modelos de Anthropic **solo si el usuario pega su llave** | — |
| Publicación | Aprueba | — | — | La Landing inserta en `lotes` |

**Políticas operativas por confirmar (y con quién):**

1. **¿Quién valida convenios?** El código dice "solo Equipo (`landing_es_admin`)". Confirmar con **Dirección de Macrolotes** quiénes tienen rol admin en `usuarios_acceso`/`landing_acceso`.
2. **¿Quién aplica el 60/40 "ahora"?** Cualquier admin, desde MacroPro, sin la firma del asesor. Confirmar con **Dirección + Legal** que esa política esté comunicada y firmada por los asesores (el código habla de un "comunicado de política").
3. **Horas de SLA** (48/48/72/48/120): el SQL las llama un "mapeo PROPUESTO". Confirmar con **Dirección** y con quien hizo la presentación de valor.
4. **¿Quién aprueba publicar?** La etiqueta dice "(Dirección)", pero cualquier usuario con sesión puede hacerlo (`esAdmin=true`). Confirmar con **Dirección**.
5. **¿Quién autoriza una carta oferta y pone al vendedor?** Cualquier usuario con sesión. Confirmar con **Dirección/Comercial**.
6. **Uso de IA con datos de clientes** (llave personal en el navegador, envío directo al proveedor): confirmar con **Dirección / responsable de privacidad**.

---

## 6. Dependencias y conexiones

### 6.1 Supabase (proyecto compartido con la Landing)

Cliente `sb` creado con la llave publicable (`macropro/index.html:250-262`); la sesión persiste en el navegador. **No se reproducen aquí llaves ni el host del proyecto.**

| Tabla / RPC / bucket | MacroPro **lee** | MacroPro **escribe** | Quién es el dueño según el código y la documentación |
|---|---|---|---|
| `lotes` / `v_landing_lotes` / `inventario_full` | Sí (inventario, wizard, requerimientos) | Upsert directo neutralizado (`:5134`, `:5339`), pero **sí** escribe por RPC `landing_import_lotes` (alta por Excel) y `landing_guardar_terreno` (asignar asesor) | Landing |
| `clientes` | Sí (paginado) | UPDATE/INSERT acotados (`mpUpsertClienteNube`, wizard de Cartas oferta, `activo=false`) | Landing (+ excepciones) |
| `captaciones` | Sí | **Sí**, upsert completo (`:4607`, `:4614`) y `documentos_urls` | Compartida (MacroPro, Landing y `captar.html`) |
| `crm_lotes` | Sí | Sí (upsert por `lote_id`) | MacroPro |
| `ofertas`, `solicitudes_asesor` | Sí | Sí (upsert por id, borrado lógico) | MacroPro (y `buscar.html` inserta solicitudes) |
| `asesores` | Sí | Sí (contacto) | Compartida |
| `desarrollos` | Sí | Neutralizado (`:5391`, `:8140`) | Landing |
| `app_config` (metas) | Sí | Sí | MacroPro |
| `cartas_oferta`, `cartas_oferta_rondas` | Sí | Sí (insert/update/delete) | MacroPro + Landing (firmas) |
| `cotizaciones_opcionador`, `documentos_opcionador`, buckets `documentos-opcionador`, `captaciones-docs`, `acuerdos-comision` | Sí | Sí | Compartida |
| `landing_clientes`, `landing_criterios`, `hubspot_deals_pendientes` | Sí | No (update neutralizado `:7995`) | Landing |
| `macropro_req_estatus` | Sí | Sí | MacroPro |
| RPC `acuerdos_lista`, `acuerdo_crear`, `acuerdo_cancelar_pendiente`, `acuerdo_ligar_cotizacion`, `comunicados_de_acuerdo` | — | Sí (convenios) | Landing (SQL de la Landing) |
| RPC `sla_tablero`, `sla_cumplir` | Sí | `sla_cumplir` | MacroPro (`sql/sla_blindaje_fase1.sql`) |
| RPC `carta_oferta_liga`, `carta_oferta_autorizar`, `portal_*`, `legal_regenerar_liga`, `captacion_doc_*`, `macropro_busquedas_*`, `macropro_criterios_landing`, `landing_asesores_catalogo` | Sí | Varios | Mixto |

**Contradicción importante:** el comentario junto a `MP_READONLY_SHARED` dice "MacroPro solo escribe `app_config` (metas) y `crm_lotes`" (`macropro/index.html:225-229`), y `CLAUDE.md` enumera solo 3 excepciones. En el código, MacroPro **también escribe** en `captaciones`, `asesores`, `ofertas`, `solicitudes_asesor`, `cartas_oferta*`, `cotizaciones_opcionador`, `documentos_opcionador`, `macropro_req_estatus` y, por RPC, en `lotes`. La bandera solo neutraliza las escrituras directas a `lotes`, `clientes` (upsert masivo), `inventario_full`, `desarrollos` y `landing_clientes`.

### 6.2 Funciones de la Landing que MacroPro llama (`https://macrolotes.grupoguia.mx/.netlify/functions/…`)

| Función | Para qué | ¿Pide sesión? | Ref. MacroPro |
|---|---|---|---|
| `acuerdo-enviar-link` | Correo con la liga del convenio; registra el envío | No (endpoint público, el correo se resuelve en el servidor por token) | `:2891`, `:22007`, `:22036`, `:22060` |
| `acuerdo-validar` | Validar/reenviar el convenio | Bearer; validar = admin | `:1529` |
| `convenio-aplicar-6040` | 60/40 por política | Bearer + admin | `:22094` |
| `correo-diagnostico` | Estado de correos (Resend) | Bearer + admin | `:2220` |
| `portal-hito` | Marcar hito y mandar correo | Bearer | `:1621` |
| `carta-oferta-notificar`, `carta-oferta-avisar-asesor` | Correos de la carta oferta | No | `:3180`, `:3055` |
| `oferta-legal` | Expediente a Legal | Bearer | `:3188` |

### 6.3 Otras conexiones

- **API de Anthropic** directo desde el navegador con la llave del usuario (`:6265`, `:12402`, `:13137`, modelo `claude-haiku-4-5-20251001` en al menos una llamada). El repo también trae `supabase/functions/anthropic-proxy` y `netlify/functions/claude.js`; **no se verificó** si se usan.
- **INEGI DENUE** (API pública) desde el navegador (`:12296`).
- **WhatsApp** (`wa.me`) y **correo** (`mailto`): solo abren la app; no hay un envío automático desde MacroPro.
- **Google Drive** (OAuth) para respaldos opcionales (`:5035-5065`).
- **MacroCotizador** (otra app, misma base) por URL (`:231-248`).

### 6.4 Disparadores (triggers)

- Base de datos: `trg_sla_captacion` después de insertar o actualizar `captaciones` (`macropro/sql/sla_blindaje_fase1.sql:226`).
- Crons de la Landing: `convenio-recordatorio-cron` (diario), `sla-alertas-cron` (cada hora), `sla-resumen-cron` (lunes). No viven en MacroPro.
- En el navegador: jalón de datos cada 45 s, refresco SLA cada 5 min, subida de CRM con un retraso de 2.5 s.

### 6.5 Qué pasa si algo no está disponible

| Falla | Efecto según el código |
|---|---|
| CDN de Supabase no carga | 30 reintentos en 9 s; el login muestra "Conectando con el servidor…" (`:264-273`, `:24673`) |
| Sin red | El SW sirve la app guardada; el indicador pasa a "offline"; se trabaja con lo local (`localStorage`/IndexedDB) |
| Supabase sin respuesta | Inventario de muestra o local; los paneles muestran "Sin conexión a Supabase" |
| SQL de SLA no corrido | El RPC falla en silencio y no aparecen relojes (`:2167-2170`) |
| Función de la Landing caída | Aviso con el error; el envío **no** se marca como hecho (probado en `fa-envios-test`) |
| Sin llave de IA | Se abre el modal para pedir la llave; el matching por reglas sigue funcionando |

---

## 7. Ejemplos de uso (DATOS FICTICIOS)

> Todos los nombres, folios, montos y tokens de esta sección son **inventados** para ilustrar.

### Ejemplo A: de la oferta de un propietario al convenio firmado

1. Un usuario interno abre 🌱 Opción / Captación y registra el terreno "**Predio Los Álamos (FICTICIO)**", ciudad "Ciudad Ejemplo", 5,000 m², precio del dueño $10,000,000. Al guardar, el sistema calcula $2,000/m² y, como es nuevo, busca requerimientos: aparece "**Comprador Demo SA (FICTICIO)** busca 3,000–6,000 m² comercial en Ciudad Ejemplo".
2. Se asigna al asesor "**Asesor Uno (FICTICIO)**". La tarjeta pasa a Viabilidad y aparece el reloj "🟢 Semáforo de viabilidad · 48 h".
3. En 👔 Asesores → Por asesor, la tarjeta está en ⏳ **Sin convenio**. Se genera el convenio (folio `AC-0000-FICT`) y se manda por WhatsApp. El correo sale por `acuerdo-enviar-link`. Cuando el servidor confirma, la tarjeta pasa a 📨 **Enviado**.
4. El asesor firma 60/40 en la Landing. Con la siguiente sincronización, la tarjeta pasa a ✅ **Firmado**, con el sello "60/40 · AC-0000-FICT".
*(La lógica de los pasos 3 y 4 se probó en local con datos simulados.)*

### Ejemplo B: expediente incompleto y SLA en pausa

1. El terreno ficticio pasa a "Documentación". Se copia la Liga Mágica `…/expediente/tok-FICTICIO` y se manda al propietario ficticio.
2. El propietario sube Escrituras, INE y Plano. Faltan Uso de suelo, Gravamen, Predial, KMZ y Fotos. El reloj "Envío a Legal" queda en ⏸️ **pausado**, con el texto "faltan 5 docs · El reloj arranca solo al subir el último".
3. Con los 8 documentos y la liga de Maps, la tarjeta avanza sola a "Contrato". En ⚙️ Admin aparece en "Aprobar para publicar". El usuario aprueba y la Landing lo publica (eso pasa fuera de MacroPro).

### Ejemplo C: carta oferta

1. ➕ Nueva Carta Oferta: terreno "Predio Los Álamos (FICTICIO)", comprador "Comprador Demo SA (FICTICIO)", 5,000 m² × $1,900 = $9,500,000, apartado $100,000, Contado.
2. Se genera la liga del comprador (10 días). El comprador ficticio firma, el usuario interno la marca como "Recibida", pone al vendedor ficticio y le manda su liga, donde el comprador aparece como "INVERSIONISTA CONFIDENCIAL".
3. El vendedor contrapropone $2,000/m² (ronda 2); el comprador acepta. El estado queda en 🎉 Aceptada, se imprime el PDF formal y se manda a Legal.

---

## 8. Traducción a ventas, por perfil

**Quién usa MacroPro de verdad:** solo el equipo interno con sesión (Dirección, gerencia y asistencia, según `SPRINT6_LOGIN_SYNC.md`). **Quién se beneficia indirectamente:** asesores, propietarios, compradores y desarrolladores, a través de ligas, PDF y mensajes.

| Perfil | Beneficio respaldado por el código | Frase utilizable | Uso |
|---|---|---|---|
| Propietario | El expediente se arma con una liga; el avance se ve en el portal; hay un reloj de tiempos que se pausa si faltan sus documentos | "Te mandamos una liga para subir tus documentos y ver el avance de tu expediente." | Para prospecto (sin prometer plazos) |
| Asesor | Su comisión queda en un convenio con folio y PDF; recibe el estatus de sus terrenos por WhatsApp | "Tu esquema de comisión (100/0 o 60/40) queda firmado y con folio." | Interno / asesores |
| Comprador | Carta oferta con rondas, firma electrónica y confidencialidad ante el vendedor | "Tu identidad se mantiene confidencial ante el vendedor durante la negociación." | Para prospecto (revisarlo con Legal) |
| Dirección | Tablero de convenios con el mismo conteo en todas las vistas; estado real de los correos; relojes SLA | "Vemos en un solo tablero qué terreno tiene convenio y cuál no." | Interno |
| Desarrollador | Informe por desarrollador y match de clientes en PPTX | "Te presentamos qué clientes de nuestra cartera encajan con tu inventario." | Externo, con cuidado: la vista es heredada y está oculta |

**Afirmaciones que necesitan confirmación antes de usarse con prospectos:**

- "Cumplimos X horas": las horas de SLA son una propuesta; no hay evidencia de cumplimiento real.
- "Avisamos automáticamente por WhatsApp": depende de que estén configurados WhatsApp Business y las plantillas en la Landing (no verificado).
- "Matching con IA": en la vista actual el matching es por reglas; la IA es opcional, depende de la llave personal y está en vistas ocultas.
- "Firma electrónica con validez legal": el código registra fecha, IP y correo; la validez legal la debe confirmar **Legal**.
- Cualquier cifra (número de terrenos, clientes, tiempos): no se midió.
- Disponibilidad 24/7, cumplimiento normativo (protección de datos): **no verificados**.

---

## 9. Pendientes y a quién preguntar

| # | Pendiente | Rol a quien preguntar |
|---|---|---|
| 1 | Verificar en producción que la versión publicada sea este commit (`aa8fb8b`) y aclarar la versión (v6.14 en el código, v8.5 en los docs) | Responsable técnico de MacroPro |
| 2 | Confirmar que `sql/sla_blindaje_fase1.sql` está corrido (trigger activo, 5 procesos) y que las horas de SLA están aprobadas | Dirección + responsable técnico |
| 3 | Admin → Desarrollos: la UI dice "guardado en Supabase", pero `MP_READONLY_SHARED` lo impide. Decidir si se oculta, se corrige o se redirige a la Landing | Dirección + dev Landing |
| 4 | Actualizar `CLAUDE.md`: líneas de `loteKey` (518) y `bajarDeSupabase` (5180); la bajada de lotes y clientes ya es automática; la lista real de escrituras a tablas compartidas | Responsable técnico |
| 5 | Inventariar quién tiene rol `admin` (`usuarios_acceso`/`landing_acceso`) y documentar que sí hay distinción admin/no admin en el servidor | Dirección |
| 6 | Política 60/40 por política: respaldo legal y comunicación a los asesores | Dirección + Legal |
| 7 | Revisar la seguridad de las páginas públicas `captar.html` y `buscar.html` (inserción anónima) y el RLS de `captaciones`/`solicitudes_asesor` | Responsable técnico / seguridad |
| 8 | IA en el navegador con la llave personal y datos de clientes: decidir si se migra al proxy (`supabase/functions/anthropic-proxy`) o se retira | Dirección + privacidad |
| 9 | El repo contiene `CRM_MacroPro_2026-04-23.json` y SQL con datos reales: valorar sacarlos del repositorio | Dirección + responsable técnico |
| 10 | Cambiar los nombres y correos con apariencia real de los datos de prueba (harness) por datos ficticios evidentes | Responsable técnico |
| 11 | Decidir el futuro de las vistas ocultas (CRM, matching, metas, dashboard): retirarlas o volver a exponerlas. Documentos sigue llevando a ellas. | Dirección |
| 12 | Probar contra el Supabase real (usuario de prueba) los flujos marcados "[Implementada en código, no probada]", sobre todo Cartas oferta, Aprobar para publicar y Liga Mágica | Responsable técnico + usuario operativo |
| 13 | README describe una app Vite con "score con IA"; la app real es `index.html` sin build. Actualizarlo o archivarlo. | Responsable técnico |

### Relación con las otras herramientas (solo como conexión)

- **Landing (macrolotes.grupoguia.mx):** es la dueña del inventario (`lotes`) y de la publicación. Aloja todas las ligas externas (expediente, aceptar, acuerdo, oferta, mi-oferta, portal) y las funciones de correo, convenios y SLA. MacroPro le **aprueba** captaciones y la llama por HTTP.
- **Intelligence:** MacroPro solo **abre** la Intelligence de la Landing con `?fuente=opcionador&c=<id>` para analizar los documentos del terreno (`macropro/index.html:17650-17669`). El `intelligence.html` de este repo es solo una redirección (app retirada).
- **GG-IA:** MacroPro solo la **menciona**: la liga fija del acuerdo "también te la da GG-IA" (`:1684`, `:1740`). Los avisos SLA de la Landing salen "firmados por GG-IA" (`landing/netlify/functions/sla-alertas.js:1`). No hay integración directa en el código de MacroPro.

### Entidades: quién crea, quién edita, quién solo lee

| Entidad | Crea | Edita | Solo lee |
|---|---|---|---|
| Predio del catálogo (`lotes`) | Landing (y MacroPro vía `landing_import_lotes`) | Landing (y MacroPro: asesor vía RPC) | MacroPro (inventario, matching) |
| Oportunidad / opción (`captaciones`) | MacroPro, `captar.html`, Landing | MacroPro, Landing | Intelligence (vía Landing) |
| Comprador (`clientes`) | Landing; MacroPro (wizard, ficha) | Landing; MacroPro (ficha, `activo=false`) | Requerimientos |
| Requerimiento sin match | Landing (búsquedas) | MacroPro (estatus/borrado) | — |
| Broker / asesor (`asesores`, catálogo de la Landing) | Landing; MacroPro (contacto) | Ambos | — |
| Expediente (documentos) | Propietario (Landing); MacroPro (subida interna) | MacroPro (estatus) | Intelligence |
| Convenio de comisión | MacroPro (`acuerdo_crear`) | Asesor (firma en la Landing), cron/admin (60/40), Equipo (validar) | MacroPro (tablero) |
| Carta oferta | MacroPro | MacroPro + comprador/vendedor (Landing) | Legal |
| Reportes PDF/PPTX | MacroPro (en el navegador) | — | Destinatario |
| Relojes SLA | BD (trigger) | Cron de la Landing; MacroPro (`sla_cumplir`) | MacroPro |
