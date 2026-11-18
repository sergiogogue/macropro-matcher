# 04 · GG-IA — Asistente de Grupo Guía Macrolotes

> Ficha de conocimiento técnico-comercial. Se basa en lectura de código y en pruebas locales
> con datos ficticios. **No** describe el estado de producción.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Herramienta | **GG-IA** (antes "G-IA" y, antes, "Guía IA"; renombrada el 2026-11-17 según `landing/supabase/ggia_renombre_2026-11-17.sql`, líneas 1-11) |
| Alcance de esta ficha | Todo lo que en el código se presenta como GG-IA: chat web `/asistente` (PWA), panel flotante "Hablar con GG-IA" en la zona interna de la Landing, copilotos con marca GG-IA en el portal del broker y en el portal del desarrollador, chatbot de WhatsApp y avisos/correos firmados "Atentamente, GG-IA". MacroPro solo se revisa como referencia cruzada. |
| Fuera de alcance | **G-NOVA** (`/ia-general`): es otro asistente, general y **sin datos internos**. Ver §3.H. |
| Repositorio principal | Landing · rama `main` · commit `3f81213` "SLA + Blindaje · Fase 2: avisos de GG-IA al 75 % y 100 % y resumen semanal de expedientes (#3172)" |
| Repositorio de referencia | MacroPro · rama `claude/wizardly-cerf-QhtU1` · commit `aa8fb8b` "SLA + Blindaje: SQL (Fase 1) y reloj en las tarjetas del Kanban (Fase 3) (#170)" |
| Fecha del análisis | 2026-11-18 |
| Entorno | Copias locales de los repositorios, Node.js, sin red hacia servicios reales |
| Disponibilidad en producción | **No verificada.** No se abrió ninguna URL de producción, no se revisaron variables de entorno de Netlify ni el estado de Meta, Resend, Microsoft, Google o BigQuery. |
| Llamadas a modelos de IA | **No se ejecutaron.** En las pruebas locales, la respuesta del modelo se **simuló** con un `fetch` falso; ninguna petición salió a la API del proveedor. |
| Mensajes enviados | **Ninguno.** No se envió nada por WhatsApp ni por correo; los envíos se interceptaron con `fetch` falso. |

**Cómo leer las etiquetas de evidencia** (se usa exactamente una por función):

- **[Probada en local con datos ficticios]**: se ejecutó en esta sesión, con datos inventados y con red simulada, y pasó.
- **[Implementada en código, no probada]**: el código existe y se leyó, pero no se ejecutó.
- **[Documentada, no verificada en código]**: aparece en documentos, textos de ayuda o prompts, pero no se encontró el código que la respalde.
- **[Parcial / en desarrollo]**: el código está detrás de una bandera, a medias, o el documento la marca como fase pendiente.
- **[No verificada]**: no hay suficiente evidencia en ninguno de los dos lados.

---

## 2. Qué problema resuelve y para quién

**Problema.** El equipo comercial de macrolotes trabaja con inventario (macrolotes propios y
corretaje), cartera de clientes, cotizaciones, cartas oferta, metas, datos de ventas (data lake) y
trámites de opción. Todo eso vive repartido en varias pantallas y sistemas. GG-IA busca que el
colaborador **pregunte en lenguaje natural** y reciba la respuesta con **datos reales** y una
**liga lista para compartir**, en lugar de navegar menú por menú. El principio que repite todo el
código es la **Regla #1: nunca inventar datos** (`landing/netlify/functions/_ia-base.js`,
`REGLA_ORO`, línea 23).

**Para quién (según el código):**

| Perfil | Qué obtiene de GG-IA |
|---|---|
| Asesor interno | Buscar terrenos por zona, uso, superficie o precio; fichas y presentaciones para el cliente; su cartera; recordatorios; agenda (si conecta Outlook o Google); redacción de mensajes. |
| Gerente / director | Lo del asesor más indicadores de su alcance (desarrollos asignados). |
| Dirección / CEO / admin | Ventas, apartados y contratos del data lake; cartas oferta; bitácora de uso; módulos de gobernanza; generación de accesos temporales; correos de briefing. |
| Desarrollador (acceso por desarrollo) | Preguntas sobre **su** desarrollo, con candado a sus desarrollos. |
| Broker externo | Copiloto limitado a **su** inventario habilitado; sin datos internos. |
| Persona del público (WhatsApp) | Información **general** de zonas y desarrollos, invitación a registrarse y captura como prospecto. Sin precios ni claves exactas. |

---

## 3. Inventario de funciones por canal

### 3.0 Resumen: ¿en qué canales existe GG-IA de verdad y quién puede usar cada uno?

| Canal | ¿Existe en código? | Quién puede usarlo | Motor |
|---|---|---|---|
| A. Chat web `/asistente` (PWA "GG-IA") | Sí | Cualquier persona **con sesión** de la Landing (equipo; el código no bloquea a brokers en la pantalla). Sin sesión → pantalla de login. | `guia-agente` (si la bandera está activa) o `guia-router` + `guia-chat` + funciones de la pantalla |
| B. Panel flotante "Hablar con GG-IA" | Sí | Zona interna con sesión; **oculto a brokers** (`landing/src/App.jsx:854` y `:995`, `{!esBroker && <GuiaIA />}`) | `guia-ia` (3 versiones por rol) + `vitrina-buscar`; `guia-agente` si la bandera está activa |
| C. Botón y buscador "GG-IA" en la home pública | Sí, pero **solo enlazan** a `/asistente` | Visitante anónimo **llega al login**, no al chat | Ninguno propio |
| D. Portal del broker ("✦ GG-IA · tu inventario") | Sí | Broker activo | `broker-ia` |
| E. Portal del desarrollador ("✦ GG-IA · <desarrollo>") | Sí | Director de desarrollo / desarrollador | `desarrollo-ia` |
| F. Chatbot de WhatsApp | Sí | Público, colaborador identificado por celular, broker activo identificado por celular, admin | `whatsapp.js` |
| G. Avisos y correos "firmados por GG-IA" | Sí | Destinatarios internos (asesores y Dirección) | Mayormente **reglas fijas**, no IA |
| MacroPro | **No** hay chat ni panel de GG-IA | — | Solo menciones de texto y destino de botones de avisos |

**Contradicción importante del canal C.** `landing/src/components/publico/HeroPublico.jsx:2`
lo describe como "buscador GG-IA anónimo" y en la línea 12 manda a `/asistente?q=…`. Pero
`landing/src/pages/GuiaChat.jsx:3757` devuelve la pantalla de login cuando no hay sesión. Por
lo tanto, **en la web, un visitante anónimo no puede conversar con GG-IA**: ve "Entra con tu
correo del equipo". El único canal de GG-IA abierto al público, según el código, es WhatsApp.

---

### A. Chat web `/asistente` (PWA instalable "GG-IA")

Archivos: `landing/src/pages/GuiaChat.jsx` (5,144 líneas), `landing/public/asistente.webmanifest`
(nombre "GG-IA", `start_url` `/asistente`), ruta en `landing/src/App.jsx:539-548`.

**Dos cerebros según el usuario.** `GuiaChat.jsx:2120-2134` (`agenteActivo`) usa el **agente
con herramientas** (`guia-agente`) solo si: hay bandera local `gg_agente='1'`; o la cuenta está
en la lista fija `AGENTE_EMAILS` (una cuenta de Dirección, línea 2119); o el perfil tiene
`gia_agente = true`; o el usuario es desarrollador (`alcance_dashboard = 'por_desarrollo'`). Para
el resto, la pantalla clasifica la intención con `guia-router` y responde con funciones fijas de
la propia pantalla y con `guia-chat`. **Por eso muchas acciones del agente no están disponibles
para todo el equipo:** dependen de esa bandera. [Parcial / en desarrollo]

| # | Función | Usuario | Entrada | Acción (tipo) | Resultado | Quién lo ve | Límites | Evidencia | Referencia |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Login dentro del asistente | Equipo | Correo y contraseña | Valida sesión | Abre el chat; "¿Olvidaste tu contraseña?" manda correo de restablecimiento | Usuario | Solo usuarios con cuenta | [Implementada en código, no probada] | `GuiaChat.jsx:3735-3754` |
| A2 | Briefing al abrir | Equipo | Abrir la app | **Consulta** (citas, pendientes, leads; ventas solo Dirección) | Texto del día; se omite la línea cuya fuente falla | Usuario | Una vez por franja del día | [Implementada en código, no probada] | `GuiaChat.jsx:864`; `landing/netlify/functions/guia-briefing.js:1-7` |
| A3 | Buscar terrenos/macrolotes | Equipo | "terreno comercial 2,000 m² en Zapopan" | **Consulta** inventario | Lista con datos reales y tarjetas | Usuario | Según rol y RLS | [Implementada en código, no probada] | `guia-agente.js` herramientas `buscar_terrenos` (363), `buscar_inventario_global` (347) |
| A4 | Ficha/presentación de un desarrollo | Equipo | "pásame la presentación de <desarrollo>" | **Consulta** + **comparte liga** | Tarjeta con liga `/desarrollo/<slug>?solo=1` o PDF | Usuario; el cliente ve la ficha aislada | La liga la arma el sistema, no la IA (`sinLigas`, `GuiaChat.jsx:53-60`) | [Implementada en código, no probada] | `presentacion_desarrollo` (396) |
| A5 | Cartera y cliente 360 | Asesor | "¿qué busca <cliente>?" | **Consulta** con el token del usuario (RLS) | Datos de sus clientes | Solo el dueño (RLS) | Datos crudos de contacto no se mandan a la IA (`GuiaChat.jsx` comentario de `clientesRaw`) | [Implementada en código, no probada] | `consultar_cartera` (405), `obtener_cliente_360` (413) |
| A6 | Cruce cliente↔inventario | Asesor | "¿qué terrenos le sirven a X?" | **Consulta** | Resultados con puntaje 0–100 | Usuario | Solo sus clientes | [Implementada en código, no probada] | `matching_automatico` (514) |
| A7 | Cotización / plan de pago | Equipo | "cotiza el lote X a 24 meses" | **Consulta / calcula** | Estimado + liga del cotizador | Usuario | La cotización formal es MacroCotizador | [Implementada en código, no probada] | `cotizar_plan_pago` (425) |
| A8 | Ventas, apartados, contratos | Dirección | "¿cuánto vendimos en octubre?" | **Consulta** data lake | Totales por línea y desarrollo | Dirección/CEO | Si el data lake no responde, lo dice | [Implementada en código, no probada] | `consultar_ventas_globales` (267), `consultar_pipeline` (304); `guia-datalake.js:1-14` |
| A9 | Cartas oferta | Dirección/CEO | "carta oferta de X" | **Consulta** | Folio, estatus, liga `/oferta/<token>` | Dirección/CEO | Herramienta oculta si no es dirección (`guia-agente.js:4359-4370`) | [Implementada en código, no probada] | `consultar_cartas_oferta` (243, 1593) |
| A10 | Recordatorios | Equipo | "recuérdame llamar a X mañana 10 am" | **Crea registro** + aviso push a la hora | Recordatorio guardado | Usuario | Si no dice cuándo, debe preguntar (regla del prompt) | [Implementada en código, no probada] | `crear_recordatorio` (918, 3655); `GuiaChat.jsx:2948` |
| A11 | Agenda (Outlook/Google) | Equipo con calendario conectado | "agéndame con X el viernes 4 pm" | **Crea / mueve / cancela registro externo**; `invitar_a_cita` **envía** invitación | Cita en su calendario | Usuario | Requiere conectar Outlook o Google; mover/cancelar piden confirmación **en el prompt** | [Implementada en código, no probada] | `agendar_cita` (858), `mover_cita` (890), `cancelar_cita` (902), `invitar_a_cita` (910) |
| A12 | Leer y responder correo de Outlook | Equipo con Outlook | "¿qué correos urgentes tengo?" / "respóndele que sí" | **Consulta**; `responder_correo` **envía**; `marcar_correo_leido` **cambia estado** | Bandeja priorizada / respuesta enviada | Usuario | Confirmación exigida en la descripción de la herramienta, no en el servidor | [Implementada en código, no probada] | `consultar_correos` (539), `responder_correo` (544), `marcar_correo_leido` (558) |
| A13 | Enviar correo a un cliente | Admin | "mándale la ficha a X por correo" | **Envía** (vía `enviar-mensaje-email`, Resend) | Correo enviado | Destinatario | "Requiere permiso de administrador"; gobernanza `correos` | [Implementada en código, no probada] | `enviar_mensaje` (525, 3394-3420); `HERRAMIENTAS_SENSIBLES` (27) |
| A14 | Marcar cotización ganada/perdida | Asesor dueño o admin | "marca ganada la de X en $Y" | **Crea registro / modifica** (RPC `landing_cotizacion_cerrar/perder/reabrir`) | Cotización cerrada | Según RPC | Exige monto para "ganado"; desambigua si hay varias | [Implementada en código, no probada] | `registrar_cierre` (498, 3103-3135) |
| A15 | Pista de competencia en campo | Equipo | "vi un letrero de X a $3,500/m²" | **Crea registro** (`competencia_pista_crear`) | Pista para que coordinación la complete | Coordinación | Pide al menos un dato | [Implementada en código, no probada] | `registrar_competencia` (579, 3888-3905) |
| A16 | Memoria personal | Equipo | "recuerda que mi zona es Zapopan" | **Crea registro** (`guia_memoria`) | Dato guardado | Solo el usuario (RLS) | No debe guardar cifras ni datos sensibles (regla del prompt) | [Implementada en código, no probada] | `recordar` (939); `landing/supabase/guia_memoria_2026-09-13.sql:22-37` |
| A17 | Acceso temporal | **Solo admin** | "genera acceso temporal para <persona>" | **Crea / restablece contraseña** | Tarjeta con contraseña visible una vez | Admin | Herramienta invisible si no es admin; verificación `landing_es_admin` en servidor; queda en auditoría | [Implementada en código, no probada] | `generar_acceso_temporal` (664, 1255-1285) |
| A18 | Bitácora de uso | Dirección | "¿quién ha usado GG-IA?" | **Consulta** `guia_auditoria` | Lista de consultas | Admin (RLS) | Solo lectura | [Implementada en código, no probada] | `bitacora_accesos` (628, 3278); `landing/supabase/83_guia_auditoria_2026-09-28.sql` |
| A19 | Navegar a una sección | Equipo | "llévame al ranking" | **Comparte liga interna** | Botón "Ir"; respeta permisos | Usuario | Si es solo admin, lo dice | [Implementada en código, no probada] | `navegar_a` (676); `GuiaIA.jsx:501-514` |
| A20 | Búsqueda en internet | Equipo | "tasas hipotecarias de hoy" | **Consulta** web (herramienta del proveedor) | Respuesta con fuentes | Usuario | Hasta 4 búsquedas por pregunta | [Implementada en código, no probada] | `landing/netlify/functions/guia-web.js:1-8, 65` |
| A21 | Leer PDF / foto / liga | Equipo | Adjunta archivo | **Consulta** | Resumen | Usuario | — | [Implementada en código, no probada] | `GuiaChat.jsx:2811-2849` (`guia-leer`, `guia-vision`) |
| A22 | Voz | Equipo | Dictado y lectura en voz alta | Interfaz | Lee respuestas sin URLs | Usuario | Voz del sistema | [Implementada en código, no probada] | `GuiaChat.jsx:38-52` |
| A23 | Selector de asistente GG-IA / G-NOVA | Equipo | Toque | Navega a `/ia-general` | Cambia de asistente | Usuario | Chats separados | [Implementada en código, no probada] | `GuiaChat.jsx:3783-3792` |

### B. Panel flotante "Hablar con GG-IA" (zona interna de la Landing)

Archivo: `landing/src/components/GuiaIA.jsx` (comentario de cabecera, líneas 1-5). Se monta en
la zona interna y en Vitrina, **nunca para brokers** (`App.jsx:854`, `:995`). También lo abren
la ficha de lote (`landing/src/components/FichaLote.jsx:553`, evento `gg-abrir-guia-ia` con el
lote en foco), el Comparador (`Comparador.jsx:100`) y la Ayuda ("¿Tienes una duda? Escríbele a
GG-IA", `landing/src/components/GestionAyuda.jsx:132-145`).

| # | Función | Usuario | Acción (tipo) | Resultado | Límites | Evidencia | Referencia |
|---|---|---|---|---|---|---|---|
| B1 | Rol automático (CEO / director / asesor) | Equipo | **Consulta** `landing_es_admin` y `landing_colaboradores` | Cambia el tono y los datos | El backend vuelve a resolver el rol | [Implementada en código, no probada] | `GuiaIA.jsx:363-381`; `landing/netlify/functions/guia-ia.js:212` |
| B2 | Respuesta "solo lectura" con datos | Equipo | **Responde** con datos que trae el backend | Texto + terrenos + botón "Ver terrenos" | Comentario del backend: "Ancla 3: solo lectura. No ejecuta acciones." | [Implementada en código, no probada] | `guia-ia.js:1-6` |
| B3 | Preguntas de Vitrina (corretaje vertical) | Equipo con acceso a Vitrina | **Consulta** `vitrina-buscar` | Tarjetas con foto y liga | Vitrina apagada por defecto | [Implementada en código, no probada] | `GuiaIA.jsx:275-280` |
| B4 | Agente con herramientas | Solo con bandera o desarrollador | Igual que canal A | Igual que A | Misma bandera | [Parcial / en desarrollo] | `GuiaIA.jsx:399-409, 427-560` |
| B5 | Historial por usuario | Equipo | **Crea registro** (`landing_ia_historial`) | Conversaciones con título | RLS: cada quien lo suyo | [Implementada en código, no probada] | `landing/supabase/ia_historial.sql:20-24` |
| B6 | Compartir fichas (WhatsApp, copiar, correo) y contacto como vCard | Equipo | **Prepara** liga; el envío lo hace el usuario | Abre `wa.me`/`mailto` | GG-IA no envía nada en este paso | [Implementada en código, no probada] | `GuiaIA.jsx:19-33, 88-120` |
| B7 | Contador de avisos en el botón | Equipo | Muestra número | Igual a la campanita | — | [Implementada en código, no probada] | `GuiaIA.jsx:191-203` |

### C. Home pública

| # | Función | Usuario | Resultado real | Evidencia | Referencia |
|---|---|---|---|---|---|
| C1 | Botón fijo "Hablar con GG-IA" | Visitante | Enlace a `/asistente` → pide login | [Implementada en código, no probada] | `App.jsx:287-297, 903, 923` |
| C2 | Buscador "Pregúntale a GG-IA" | Visitante | `/asistente?q=…` → pide login (el texto se intenta mandar al montar) | [Implementada en código, no probada] | `HeroPublico.jsx:2-37`; `GuiaChat.jsx:797-810` |
| C3 | "Explorar con GG-IA" en macrolotes destacados | Visitante | Enlace a `/asistente` | [Implementada en código, no probada] | `landing/src/components/publico/MacrolotesDestacados.jsx:82-116` |

### D. Portal del broker y E. Portal del desarrollador

| # | Función | Usuario | Acción | Límites declarados en código | Evidencia | Referencia |
|---|---|---|---|---|---|---|
| D1 | "✦ GG-IA · tu inventario" | Broker activo | **Consulta** solo `landing_broker_inventario()` (allowlist, disponibles) | Sin precios de cierre, clientes de la casa, comisiones ni coordenadas exactas; cifras validadas contra el JSON de entrada | [Implementada en código, no probada] | `landing/src/pages/BrokerPortal.jsx:1052-1066, 1549`; `landing/netlify/functions/broker-ia.js:1-15` |
| D2 | Broker en el agente | Broker | Herramientas recortadas a su superficie (macrolotes/Vitrina/Vive); "broker-asesor" elevado por Dirección ve 13 herramientas de macrolotes | Candado doble: filtro de herramientas + validación al ejecutar | [Implementada en código, no probada] | `guia-agente.js:1001-1031, 4031-4049, 4352-4363` |
| E1 | "✦ GG-IA · <desarrollo>" | Desarrollador | **Consulta** datos de SU desarrollo con su token | Sin promesas de plusvalía (candado PROFECO), sin nombres de interesados | [Implementada en código, no probada] | `landing/src/pages/PortalDesarrollo.jsx:1080-1097`; `landing/netlify/functions/desarrollo-ia.js:1-14` |
| E2 | GG-IA por desarrollador en conjunto | **Solo admin/Dirección** | **Consulta** data lake + metas | 403 si no es admin | [Implementada en código, no probada] | `landing/netlify/functions/desarrollador-ia.js:1-30` |

### F. Chatbot de WhatsApp

Archivo: `landing/netlify/functions/whatsapp.js` (webhook de Meta Cloud API). Identifica a
quien escribe **solo por el número de celular** (últimos 10 dígitos) contra
`landing_colaboradores` (activo) y `landing_brokers` (activo y vigente) — `buscarAsesor`,
líneas 174-192. Admin = correo en `ADMIN_EMAILS` (una cuenta fija más la variable
`WHATSAPP_ADMIN_EMAILS`) o teléfono en `WHATSAPP_ADMIN_TELS` (líneas 75-80).

**Orden de decisión del manejador** (`handler`, línea 1175): verificación GET → mensaje sin
texto → flujo de carta oferta (solo identificados) → saludo fijo → intención de opcionar → modelo
de IA (`pensar`) → reglas del sistema sobre la respuesta del modelo.

| # | Función | Usuario | Entrada | Acción (tipo) | Resultado | Límites | Evidencia | Referencia |
|---|---|---|---|---|---|---|---|---|
| F1 | Verificación del webhook | Meta | GET con token | Valida | 200 con *challenge* o 403 | Token por variable de entorno | [Probada en local con datos ficticios] | `whatsapp.js:1180-1189` |
| F2 | Mensaje sin texto (audio, imagen) | Todos | Nota de voz | **Responde** fijo | "las notas de voz todavía no las puedo escuchar" | v1 solo texto | [Probada en local con datos ficticios] | `whatsapp.js:1223-1231` |
| F3 | Saludo fijo (`esSaludoSolo` + `saludoGGIA`) | Todos | "Hola", "buenas tardes" | **Responde** sin IA | "Soy GG-IA, el asistente de Grupo Guía"; con nombre si está registrado | Hasta 40 caracteres | [Probada en local con datos ficticios] | `busqueda.mjs:212-220`; `whatsapp.js:62-64, 1251-1256` |
| F4 | Intención de opcionar (`esIntentOpcionar`) | Todos | "quiero opcionar un terreno" | **Comparte liga** `/acuerdo` sin IA | Explica esquemas 100/0 y 40/60 | Requiere verbo + sustantivo de tierra | [Probada en local con datos ficticios] | `busqueda.mjs:201-207`; `whatsapp.js:1262-1270` |
| F5 | Información general (no registrado) | Público | "¿tienen comerciales en Zapopan?" | **Responde** (IA) | Zonas y usos, **sin** precio, m², clave ni ficha | El sistema descarta fichas aunque el modelo las pida | [Probada en local con datos ficticios] (con respuesta del modelo simulada) | `whatsapp.js:1294-1295`; reglas del prompt ~474-480 |
| F6 | Captura de prospecto | Público con interés | Nombre/teléfono | **Crea registro** `landing_leads` + **envía** aviso a Dirección (campanita + push), una vez | Lead capturado | Lo decide el modelo (`es_lead`) | [Implementada en código, no probada] | `whatsapp.js:782-822, 1439-1441` |
| F7 | Alta guiada de asesor externo | No registrado | Nombre, correo, teléfono | **Crea registro** (cuenta pendiente, sin panel) + **comparte liga** de activación + aviso a Dirección | Cuenta pendiente de aprobación | La contraseña nunca viaja por WhatsApp | [Implementada en código, no probada] | `whatsapp.js:283-350, 1375-1388` |
| F8 | Datos exactos y fichas (registrado) | Colaborador o broker identificado | "mándame la ficha del <clave>" | **Consulta** inventario disponible + **comparte liga** `/f/lote/<id>` | Ficha con foto si es una | Liga solo si el id existe en el inventario leído | [Probada en local con datos ficticios] (modelo simulado) | `whatsapp.js:1294-1349` |
| F9 | Búsqueda por requerimiento | Registrado | "comercial ~2,000 m² en Guadalajara" | **Consulta** con filtro duro de ciudad | Top 3 fichas o "no encontré" | No mezcla plazas (ZMG ≠ Cancún) | [Probada en local con datos ficticios] (función pura) | `busqueda.mjs:161`; `whatsapp.js:1351-1371` |
| F10 | Registrar búsqueda fallida | Registrado | "sí, avísame" | **Crea registro** `landing_busquedas_fallidas` (origen whatsapp) | Aparece en MacroPro 🔍 Requerimientos | Lo decide el modelo | [Implementada en código, no probada] | `whatsapp.js:351-360`; `macropro/index.html:2062, 2314` |
| F11 | Directorio del equipo | Colaborador (no broker) | "¿cel del gerente de X?" | **Consulta** `landing_colaboradores` (service role) | Nombre, puesto, zona, celular, correo | Brokers y público no lo reciben | [Implementada en código, no probada] | `whatsapp.js:195-220, 1275` |
| F12 | Datos privados → liga mágica | Colaborador/broker identificado | "¿cuánto vendí?" | **Comparte liga** de acceso de un solo uso a `/asistente` | No muestra el dato en WhatsApp | Vence en 1 hora (texto); la decide el modelo (`necesita_app`) | [Probada en local con datos ficticios] (modelo simulado) | `whatsapp.js:268-281, 1280-1291` |
| F13 | Consulta de cartas oferta | Admin: todas · asesor registrado: solo las suyas · público: nada | "¿cómo va la carta de X?" | **Consulta** `cartas_oferta` (service role) | Folio, estatus, liga | Filtro por correo en el servidor | [Probada en local con datos ficticios] (solo el caso "público → sin acceso") | `whatsapp.js:376-430, 1393-1410` |
| F14 | Crear carta oferta guiada | Colaborador **o broker** identificado | "quiero hacer una carta oferta" | Flujo paso a paso; al final **crea registros**: cliente comprador (si no existe), dueño ligado al lote (si no tenía), carta oferta (RPC `carta_oferta_crear`) y **comparte liga** de firma `/oferta/<token>` | Folio + liga | Confirmación explícita "sí" antes de generar; "cancelar" en cualquier paso; expira a 30 min; apartado ≤ total | [Probada en local con datos ficticios] (inicio y cancelación) | `whatsapp.js:857-1173` |
| F15 | Constancia de situación fiscal | Todos | "mándame la constancia en PDF" | **Envía** documento PDF fijo | Archivo adjunto | No se manda si lo niegan | [Implementada en código, no probada] | `whatsapp.js:1425-1434` |
| F16 | Memoria por número | Todos | Cualquier mensaje | **Crea registro** `whatsapp_conversaciones` | Últimos 6 turnos como contexto | Tabla con RLS y sin políticas (solo service role) | [Implementada en código, no probada] | `whatsapp.js:222-264`; `landing/supabase/whatsapp_conversaciones_2026-10-20.sql:26` |
| F17 | Error genérico | Todos | Falla interna | **Responde** "Tuve un detalle…" | Nadie se queda sin respuesta | — | [Implementada en código, no probada] | `whatsapp.js:1456-1461` |

### G. Avisos y correos que GG-IA "firma"

Decisión de Dirección (2026-11-17): solo los correos que **escribe el asistente** llevan
"Atentamente, GG-IA · Asistente de Grupo Guía"; los formales a clientes (cotizaciones, acuerdos,
cartas oferta) siguen firmados por el Equipo Grupo Guía (`landing/netlify/lib/firma-ggia.mjs:1-10`).

| # | Aviso | Destinatario | Disparo | ¿IA? | Canal | Evidencia | Referencia |
|---|---|---|---|---|---|---|---|
| G1 | Briefing diario por excepción | Admins | Cron 13:00 UTC (`briefing-cron.js:7`) o admin | Narrativa IA **solo** si el interruptor `informes_auto` está encendido (apagado por defecto) | Campanita + correo si hay Resend | [Implementada en código, no probada] | `briefing-enviar.js:1-30, 128` |
| G2 | Resumen diario por asesor | Cada asesor con pendientes | Cron 13:30 UTC | No | Campanita + push; correo opcional | [Implementada en código, no probada] | `resumen-diario.js:1-14, 101` |
| G3 | SLA 75 % / 100 % | 75 %: Admin · 100 %: Admin **y** asesor | Cron cada hora, 8:00–20:00 CDMX | No | WhatsApp (plantilla `gg_aviso_admin` / `gg_aviso_asesor`, o texto) | [Probada en local con datos ficticios] | `sla-alertas.js:1-14, 64-90`; `sla-alertas-cron.js:7` |
| G4 | SLA resumen semanal | Asesores (WhatsApp "— GG-IA") y Dirección (WhatsApp + correo firmado) | Lunes 8:47 CDMX | No | WhatsApp + correo | [Probada en local con datos ficticios] | `sla-alertas.js:93-123`; `sla-resumen-cron.js:7` |
| G5 | Avisos de leads sin atender, ranking, clientes fríos, prospecto caliente sin contactar | Equipo | Crons propios | No verificado si usan IA | Correo con firma GG-IA | [Implementada en código, no probada] | `avisos-leads-sin-atender.js:149`, `avisos-ranking.js:124`, `avisos-clientes-frios.js:133`, `avisos-caliente-sin-contactar.js:172` |
| G6 | Triage de correos urgentes | Admins con Outlook conectado | Cron 3 veces al día | Puntaje por reglas | Campanita + push (no correo) | [Implementada en código, no probada] | `guia-correos-urgentes.js:1-12` |

Las plantillas de WhatsApp `gg_*` (`landing/netlify/lib/wa-admin.mjs:61-65`) **no dicen "GG-IA"**
en su cuerpo; dicen "Grupo Guía Macrolotes" (`landing/docs/PLANTILLAS_WHATSAPP.md:64-80`). La
firma "— GG-IA" solo aparece en el **texto libre** de respaldo y en el correo. Si una plantilla
está aprobada, el destinatario no verá la firma de GG-IA en WhatsApp. El estado de aprobación
en Meta: [No verificada].

### H. Lo que NO es GG-IA

- **G-NOVA** (`/ia-general`, `landing/src/pages/IAGeneral.jsx`, `landing/netlify/functions/ia-general.js:1-6`):
  asistente general con búsqueda web y adjuntos, **sin** acceso a clientes, inventario, metas ni
  acciones. Tiene interruptor `ia_general`, límite de 40 mensajes por día por usuario y bitácora
  `ia_general_uso`. Su prompt dice: "Eso es de GG-IA, no de ti".
- **MacroPro**: no tiene GG-IA. Solo lo menciona en la pantalla de opción ("también te lo da
  GG-IA: 'mándame el acuerdo de comisión'", `macropro/index.html:1684, 1740`) y es el destino del
  botón "Abrir MacroPro" de los avisos `gg_aviso_admin`. Las búsquedas fallidas que registra el bot
  aparecen en 🔍 Requerimientos (`macropro/index.html:2062, 2314`).

---

## 4. Pantallas y recorrido por perfil

| Perfil | Dónde entra | Qué puede **ver** | Qué puede **editar/crear** | Qué puede **compartir** | Qué puede **generar** | Público / privado / interno |
|---|---|---|---|---|---|---|
| Visitante web | Home pública → botón GG-IA | Login de GG-IA | Nada | Nada | Nada | Público (pero sin chat) |
| Persona por WhatsApp (no registrada) | Número de WhatsApp de la empresa | Zonas, desarrollos y usos en general | Se registra como lead o como asesor pendiente | — | Solicitud de alta | Público |
| Asesor (sin bandera de agente) | `/asistente` o panel flotante | Inventario, sus clientes (RLS), formatos, conocimiento | Recordatorios, contacto registrado, memoria, historial | Fichas y presentaciones (WhatsApp, copiar, correo desde su app) | Pitch, mensajes, redacciones | Interno |
| Asesor con agente activo | Igual | Lo anterior + herramientas del agente | + cierres de cotización, pistas de competencia, citas, To-Do | + invitaciones de calendario, respuestas de correo (tras confirmar) | Lo anterior | Interno |
| Asesor por WhatsApp | Su celular registrado | Fichas exactas, directorio, sus cartas oferta | Carta oferta nueva, cliente comprador, búsqueda fallida | Liga de firma de la carta | Liga mágica para lo privado | Interno vía canal público |
| Dirección / admin | Todos los anteriores | Ventas, apartados, cartas oferta de todos, bitácora, módulos | Accesos temporales, simulación de alcance de desarrollador | Correos a clientes (`enviar_mensaje`) | Briefing, resúmenes | Interno |
| Broker | Portal del broker; WhatsApp | Solo su inventario habilitado | Por WhatsApp: carta oferta y cliente comprador (ver §6) | Fichas de su inventario | — | Externo autorizado |
| Desarrollador | Portal del desarrollador; `/asistente` con candado | Agregados de su desarrollo | — | — | — | Externo autorizado |

**Recorrido típico del asesor en la web:** abre la app instalada "GG-IA" → si no hay sesión,
login → briefing del día → escribe la pregunta → recibe texto + tarjetas con liga → toca
"WhatsApp" o "Copiar" para mandarla él mismo al cliente. El cliente abre la ficha aislada
(`?solo=1` o `/f/<tipo>/<id>`) sin menú interno (`App.jsx:300-306`).

---

## 5. Reparto de tareas

| Tarea | Usuario | Equipo / Dirección | Automático (reglas) | IA |
|---|---|---|---|---|
| Entender la pregunta | Escribe | — | Saludo, opcionar, carta oferta y algunas intenciones de la pantalla | Clasifica e interpreta lo demás |
| Traer datos | — | Mantener inventario, CRM y data lake al día | Consultas con el token (RLS) o service role | Elige herramienta (agente) |
| Armar ligas | — | — | **Siempre el sistema**; la IA no escribe URLs | Solo indica el id/slug |
| Enviar al cliente | El asesor toca WhatsApp/Copiar/Correo | — | — | Redacta el texto |
| Enviar correo desde el sistema | Confirma | Abrir módulo `correos` en Gobernanza | Envío por Resend | Propone y espera "sí" (regla del prompt) |
| Carta oferta por WhatsApp | Contesta paso a paso y confirma "sí" | Revisar y dar seguimiento en MacroPro | Flujo fijo, sin IA | No interviene |
| Alta de asesor externo | Da sus 3 datos | **Dirección aprueba** | Crea cuenta pendiente y liga de activación | Pide los datos uno por uno |
| Leads de WhatsApp | — | Dirección contacta | Guarda lead y avisa una vez | Decide si hay interés real |
| Avisos SLA | — | Admin/asesor atienden | 100 % reglas y cron | No |
| Contraseña temporal | — | Admin la comparte | — | Herramienta solo para admin |

**Política operativa por confirmar** (no está escrita como política en el repositorio):

| Tema | Quién debe confirmarlo |
|---|---|
| Si las acciones que **envían** (correo, invitaciones) deben exigir confirmación en el servidor, no solo en el prompt | Dirección + responsable técnico |
| Si los brokers pueden crear cartas oferta y clientes por WhatsApp | Dirección comercial |
| Tiempo de retención de `whatsapp_conversaciones`, `guia_uso`, `guia_auditoria` y aviso de privacidad aplicable | Dirección + Legal |
| Quién atiende los leads de WhatsApp y en qué plazo | Dirección comercial |
| Cuándo se enciende el agente para todo el equipo (hoy por bandera) | Dirección |
| Horario de atención esperado del bot (no hay garantía de 24/7 en el código) | Dirección |

---

## 6. Dependencias y conexiones

### 6.1 Datos que consulta

| Fuente | Tablas/vistas/funciones | Canal | Cómo valida permisos |
|---|---|---|---|
| Inventario público | `v_landing_lotes`, `v_landing_corretaje`, `v_landing_desarrollos`, `landing_lote_meta`, `lotes` (desarrollador, dueño) | WhatsApp | **Service role**, filtra a "Disponible" (`whatsapp.js:120-170`) |
| Inventario interno | `useInventory`, herramientas de terrenos | Web | Token del usuario (RLS) |
| Equipo | `landing_colaboradores` | Web, WhatsApp | Web: RLS (solo su fila). WhatsApp: service role para identificar y para el directorio |
| Brokers | `landing_brokers`, RPC `landing_es_broker`, `landing_broker_superficies`, `landing_broker_gia_asesor`, `landing_broker_inventario` | Web, WhatsApp | RPC con token |
| Clientes | `landing_clientes`, cartera (`crm_lotes`, sincronizada desde MacroPro) | Web (RLS); WhatsApp carta oferta (**service role**) | Ver hallazgo abajo |
| Cotizaciones | RPC `landing_cotizaciones`, `landing_cotizacion_cerrar/perder/reabrir` | Web | RPC con token |
| Cartas oferta | `cartas_oferta`, `cartas_oferta_rondas` (compartidas con MacroPro) | Web (dirección), WhatsApp | Web: herramienta solo dirección. WhatsApp: filtro por correo en el servidor |
| Conocimiento | `guia_conocimiento` (+ memoria semántica) | Web | RLS: lectura de activos; escritura solo admin (`guia_conocimiento_2026-09-13.sql:24-33`) |
| Memoria | `guia_memoria` | Web | RLS por `auth.uid()` |
| Historial | `comm_chat`, `landing_ia_historial` | Web | RLS por usuario |
| Uso y auditoría | `guia_uso`, `guia_auditoria` | Web | Inserción propia; lectura solo admin |
| SLA | `sla_controles`, `sla_config`, `captaciones`, `asesores`, RPC `sla_recalcular` | Avisos | Cron con secreto o admin |
| Data lake | Google **BigQuery** (vía `guia-datalake`, solo lectura; vistas de HubSpot como `view_ventas_glt`, `final_hubspot_negocios`) | Web | Colaborador con `acceso_dashboard` o cron; "dormido" si falta la credencial |
| Correo y calendario | **Microsoft 365** (Outlook: correo, calendario, To-Do) y **Google Calendar** | Web | OAuth de cada usuario; solo lo suyo |
| Web | Búsqueda web del proveedor de IA | Web | Sesión de equipo |

### 6.2 Proveedores y modelos (solo nombres, como aparecen en el código)

| Componente | Modelo por defecto en código | Referencia |
|---|---|---|
| Núcleo compartido | rápido `claude-haiku-4-5`; principal `claude-sonnet-5` | `_ia-base.js:16-19` |
| Agente | `claude-haiku-4-5-20251001`; análisis pesado con `MODELOS.principal` | `guia-agente.js:43, 50` |
| WhatsApp | `claude-sonnet-4-5`, respaldo `claude-haiku-4-5-20251001` | `whatsapp.js:48-49` |
| G-NOVA (no es GG-IA) | `claude-sonnet-4-5` | `ia-general.js` |

Proveedor de IA: **Anthropic** (API de mensajes). Mensajería: **WhatsApp Cloud API de Meta**
(Graph `v21.0` por defecto). Correo: **Resend**. Notificaciones: push web (VAPID) y campanita
(`landing_notificaciones`). Hospedaje de funciones: Netlify (funciones programadas con
`schedule`). Ninguna de estas conexiones se verificó como configurada.

### 6.3 Disparadores

- **Por mensaje del usuario:** web (`/asistente`, panel), WhatsApp (webhook).
- **Por cron:** `briefing-cron` (13:00 UTC), `resumen-diario-cron` (13:30 UTC),
  `guia-correos-urgentes-cron` (14, 19 y 0 UTC), `sla-alertas-cron` (cada hora, minuto 37),
  `sla-resumen-cron` (lunes 14:47 UTC).
- **Por evento de pantalla:** ficha de lote y Comparador abren el panel con contexto.

### 6.4 Qué pasa si falta una dependencia o no hay datos

| Situación | Comportamiento en código | Evidencia |
|---|---|---|
| Faltan variables de WhatsApp/IA/Supabase | El webhook responde 200 a Meta **sin contestar** al usuario (silencio) | `whatsapp.js:1218-1221` [Implementada en código, no probada] |
| El modelo principal falla en WhatsApp | Reintenta con el de respaldo; si ambos fallan, manda el saludo fijo | `whatsapp.js:672-676, 1278` |
| Excepción en WhatsApp | "Tuve un detalle… ¿me lo repites?" | `whatsapp.js:1456-1461` |
| Agente sin clave de IA | "Agente no configurado." | `guia-agente.js:3969` |
| Sesión vencida (web) | Mensaje claro y un reintento con sesión renovada | `GuiaIA.jsx:447-456` |
| Tiempo agotado (web) | Hasta 2 reintentos y luego pide acotar la búsqueda | `GuiaIA.jsx:458-470` |
| Data lake sin credencial | "Sin configurar"; el agente dice que no pudo leerlo | `guia-datalake.js:5-7`; `guia-agente.js:1219-1221` |
| Sin Resend | `enviar_mensaje` devuelve "El correo aún no está configurado… No se envió." | `guia-agente.js:3416` |
| Plantilla de WhatsApp no aprobada | Intenta plantilla y cae a texto (solo llega dentro de la ventana de 24 h) | `wa-admin.mjs:97-104` [Probada en local con datos ficticios] |
| WhatsApp falla en SLA | No marca el aviso; reintenta en la siguiente corrida | [Probada en local con datos ficticios] |
| No hay match de inventario | "No encontré opciones en <ciudad>… ¿registro tu búsqueda?" | `whatsapp.js:1364-1369` |
| Dato ausente en general | Regla #1: "no tengo ese dato" | `_ia-base.js:23-31` (regla de **prompt**, no garantía técnica) |

---

## 7. Ejemplos de uso

### Recorrido 1 · Asesor por WhatsApp arma una carta oferta (datos ficticios)

1. El asesor (celular registrado) escribe: "quiero hacer una carta oferta". `disparaCartaOferta`
   detecta verbo de crear + "carta oferta"; se guarda el paso `terreno` en `whatsapp_flujos`.
2. GG-IA pide la clave del terreno; el asesor responde "ZZ_010". Si el lote ya tiene dueño, pide
   confirmarlo; si no, pide el nombre del vendedor y **lo liga como dueño** del lote.
3. Pide precio por m², comprador (si no existe, correo y teléfono para **crearlo**), forma de
   pago y apartado (rechaza un apartado mayor al total).
4. Muestra un resumen y pregunta "¿Genero la Carta Oferta y la liga de firma?". Solo con "sí"
   llama a `carta_oferta_crear` y devuelve folio + liga `/oferta/<token>`.
5. En cualquier momento "cancelar" borra el flujo; tras 30 min sin actividad expira.

Probado localmente: pasos 1 y "cancelar". Pasos 2-4: [Implementada en código, no probada].

### Recorrido 2 · Asesor en la web pide fichas para su cliente

1. En `/asistente` escribe "pásame la presentación de <desarrollo>".
2. Con agente: llama `presentacion_desarrollo`; sin agente: `guia-router` + funciones de la pantalla.
3. La pantalla arma la tarjeta con la liga real (`/desarrollo/<slug>?solo=1`, o PDF si pidió
   "presentación/PDF"), quita cualquier URL que la IA haya escrito (`sinLigas`).
4. El asesor toca "WhatsApp" y **él** envía la liga. GG-IA no envía nada por su cuenta en este paso.

[Implementada en código, no probada]

### Recorrido 3 · Dirección recibe el aviso de SLA

1. Cada hora (8:00–20:00 CDMX) el cron recalcula relojes.
2. Un trámite llega a 75 % → WhatsApp solo al Admin. Llega a 100 % → al Admin y al asesor.
3. Los relojes en pausa (expediente incompleto) no avisan; cada aviso sale una sola vez.
4. El lunes, resumen de expedientes incompletos: WhatsApp a cada asesor ("— GG-IA") y a Dirección,
   más correo firmado "Atentamente, GG-IA".

[Probada en local con datos ficticios] (12/12 casos de `fn-sla.mjs`). Ninguna IA participa.

### Mensajes de prueba (datos ficticios; nada se envió por WhatsApp real)

- [Probada en local con datos ficticios] Mensaje: "Hola" (número desconocido) → saludo fijo "¡Hola! 👋 Soy GG-IA, el asistente de Grupo Guía…" sin llamar a la IA (`esSaludoSolo` + `saludoGGIA`).
- [Probada en local con datos ficticios] Mensaje: "Buenas tardes" (celular ficticio registrado como "Asesora Prueba") → "¡Hola Asesora! 👋 Soy GG-IA…", sin IA.
- [Probada en local con datos ficticios] Mensaje: "hola GG-IA 👋" → se trata como saludo; "hola, busco terreno en Zapopan" → **no** es saludo y pasa al modelo.
- [Probada en local con datos ficticios] Mensaje: "quiero opcionar un terreno" → liga a `/acuerdo` (Option Engine) con esquemas 100/0 y 40/60, sin IA (`esIntentOpcionar`). "dame opciones de terrenos" → **no** dispara este atajo.
- [Probada en local con datos ficticios] Mensaje: nota de voz → "por ahora las notas de voz todavía no las puedo escuchar…".
- [Probada en local con datos ficticios] Mensaje: "quiero hacer una carta oferta" (asesor ficticio) → "📝 Nueva Carta Oferta… 1️⃣ ¿Para qué terreno…?"; luego "cancelar" → "Listo, cancelé la carta oferta."
- [Probada en local con datos ficticios] Mensaje: "¿cuánto vendí este mes?" (asesor ficticio; el modelo se **simuló** devolviendo `necesita_app: true`) → "Eso es información tuya privada 🔒…" + liga mágica ficticia.
- [Probada en local con datos ficticios] Mensaje: "dame la carta oferta de Cliente X" (número no registrado; modelo simulado con `consulta_cartas`) → "No tengo acceso a esa información."
- [Probada en local con datos ficticios] Mensaje: "¿tienen terrenos comerciales en Zapopan?" (no registrado; modelo simulado pidiendo ficha `zz_010`) → el sistema **no** anexa la liga de la ficha.
- [Probada en local con datos ficticios] Mensaje: "mándame la ficha del zz_010" (registrado; modelo simulado) → se anexa `/f/lote/zz_010` porque el id existe en el inventario simulado; con un id inexistente (`no_999`) no se arma liga.
- [Probada en local con datos ficticios] Función `filtrarRequerimiento` con ciudad "Guadalajara", uso comercial, ~2,000 m² sobre un universo ficticio Zapopan/Cancún → solo devuelve el de Zapopan.
- [Implementada en código, no probada] Mensaje: "soy asesor y quiero registrarme" → pide nombre, correo y teléfono uno por uno; al tenerlos crea cuenta **pendiente** y manda liga de activación.
- [Implementada en código, no probada] Mensaje: "mándame la constancia de situación fiscal en PDF" → texto + documento PDF fijo.
- [Implementada en código, no probada] Web (agente): "recuérdame llamar a Cliente Ficticio mañana 10 am" → crea recordatorio con aviso push.
- [Implementada en código, no probada] Web (agente, admin): "genera acceso temporal para Persona Ficticia" → tarjeta con contraseña visible una sola vez; para no admin la herramienta no existe.
- [Documentada, no verificada en código] Web: "¿qué es Vitrina?" → explicación desde la base de conocimiento (caso de la batería en `landing/docs/GIA_AGENTE_PLAN.md:85-96`; no se encontró registro de su resultado).

**Comandos usados** (desde `landing/`, sin red): `node /var/tmp/copg/fn-saludo.mjs` (17/17),
`node /var/tmp/copg/fn-sla.mjs` (12/12), `node /var/tmp/copg/fn-wa-admin.mjs` (3/3),
`node /var/tmp/copg/fn-plantillas.mjs` (11/11), más dos pruebas propias en el directorio
temporal de la sesión: funciones puras (11/11) y webhook de WhatsApp con `fetch` simulado (12/12).

---

## 8. Traducción a ventas

### 8.1 Uso interno (equipo comercial)

| Perfil | Beneficio respaldado por código | Frase utilizable | Afirmación que requiere confirmación |
|---|---|---|---|
| Asesor | Busca inventario y entrega la liga real de la ficha; la IA no puede inventar ligas (el sistema las arma) | "Pídele a GG-IA la ficha y te da la liga lista para mandar." | "Contesta TODO" (el agente completo depende de una bandera) |
| Asesor | Desde WhatsApp arma una carta oferta paso a paso y obtiene la liga de firma | "Puedes levantar la carta oferta desde WhatsApp y te da la liga para el comprador." | Que la carta quede lista sin revisión de Dirección |
| Asesor | Lo privado no se expone por WhatsApp: llega una liga de acceso | "Tus números no viajan por WhatsApp; te abre la app." | Vigencia exacta de la liga (el texto dice 1 hora; no se verificó la configuración) |
| Dirección | Avisos de SLA a 75 % y 100 %, sin repetir, con resumen semanal | "GG-IA te avisa antes de que venza un trámite." | Que llegue siempre (depende de plantillas aprobadas en Meta) |
| Dirección | Bitácora de quién usa GG-IA y qué pregunta | "Puedes auditar el uso." | Retención y cumplimiento de privacidad |

### 8.2 De cara al prospecto o cliente

| Beneficio respaldado | Frase utilizable | No decir sin confirmar |
|---|---|---|
| Por WhatsApp contesta en qué zonas y para qué usos hay terrenos | "Escríbenos por WhatsApp y te orientamos sobre zonas y usos disponibles." | "Atención 24/7", "respuesta inmediata garantizada", tiempos de respuesta |
| Las fichas que se comparten muestran datos del inventario disponible | "La ficha que te mandamos sale del inventario vigente." | "Precios en tiempo real" (depende de que el inventario esté actualizado) |
| Hay aviso de privacidad al capturar datos (instrucción del prompt) | "Tus datos están protegidos por nuestro aviso de privacidad." | Cumplimiento normativo específico (no se revisó) |

**Regla para el equipo:** no presentar GG-IA al cliente como quien firma documentos legales;
las cartas oferta y cotizaciones van firmadas por el Equipo Grupo Guía.

---

## 9. Contradicciones, riesgos y pendientes

### 9.1 Contradicciones encontradas

1. **"Solo lectura" vs. acciones.** La Ayuda dice "GG-IA es de SOLO LECTURA… NO ejecuta acciones
   (no da de alta clientes, no manda avisos, no cotiza)" (`landing/src/components/GestionAyuda.jsx:35`)
   y `guia-ia.js:5` dice "Ancla 3: solo lectura". Pero el agente crea recordatorios, citas,
   cierres de cotización, pistas, accesos temporales y envía correos; y el bot de WhatsApp crea
   clientes, leads y cartas oferta. Es cierto solo para el panel flotante sin agente.
2. **Buscador público "anónimo" vs. login obligatorio** (§3.0).
3. **Nombre a medio cambiar.** La pantalla de login y los encabezados del chat siguen diciendo
   "G-IA" (`GuiaChat.jsx:3761, 3864, 3877`); el prompt de `guia-chat` se presenta como "Guía"
   (`guia-chat.js:456`); `docs/GIA_AGENTE_PLAN.md` usa "G-IA".
4. **"Una sola IA, mismo modelo".** `_ia-base.js:3-8` lo afirma, pero el agente, WhatsApp y G-NOVA
   fijan modelos propios; `IDENTIDAD_INTERNA` (línea 34) no se importa en ninguna función.
5. **Nombre de modelo.** `_ia-base.js:18` usa `claude-sonnet-5` como principal y `guia-agente.js:44-50`
   dice que la clave "YA soporta" ese modelo, mientras `whatsapp.js:44-47` dice que ese alias
   "NO existe y la API lo rechaza". No se verificó cuál es correcto (no se llamó a la API).
6. **Cartas oferta "SOLO ADMIN".** El comentario de `whatsapp.js:362` y el título del bloque
   (línea 1389) dicen solo admin; el código permite al asesor registrado ver **sus** cartas
   (líneas 1401-1404) y el prompt lo confirma. El comportamiento real es el del código.
7. **"El WhatsApp es solo público"** (`whatsapp.js:16`) vs. directorio interno con celulares y
   correos para colaboradores, cartas oferta y alta de clientes.
8. **Plan del agente desactualizado.** `GIA_AGENTE_PLAN.md:66-72` marca F3 como pendiente
   (actividad de lote, censo, marketplace, academia, ranking), pero esas herramientas ya existen
   en `guia-agente.js` (447-473, 843). Última actualización del documento: 2026-09-19.
9. **Firma GG-IA en avisos urgentes.** `firma-ggia.mjs:1-3` menciona "avisos urgentes", pero
   `guia-correos-urgentes.js` notifica por campanita/push, no por correo firmado.

### 9.2 Riesgos a revisar (hallazgos de código, no confirmados en producción)

- **Confirmaciones solo en el prompt.** Enviar correo, responder correo, mover/cancelar citas e
  invitar se confirman porque la **descripción** de la herramienta se lo pide al modelo; el
  servidor no exige un "sí" (`guia-agente.js:3436, 3507, 3589, 3615`: "El modelo YA confirmó").
  `agendar_cita` incluso indica crearla "de una vez".
- **WhatsApp usa service role para buscar clientes.** En el flujo de carta oferta,
  `coBuscarCliente` (`whatsapp.js:966-976`) busca en **todos** los `landing_clientes` por nombre,
  empresa o correo y muestra el correo para confirmar. Lo puede usar cualquier colaborador **o
  broker** identificado por celular. Esto no respeta el RLS de cartera de la web.
- **Identidad por número de teléfono.** No hay segundo factor en WhatsApp; quien controle un
  número registrado obtiene trato de asesor.
- **Brokers en `/asistente`.** El panel flotante se les oculta, pero la pantalla `/asistente` no
  los bloquea; el alcance depende del backend (`guia-agente` sí los recorta; `guia-chat` los
  admite "como asesor", `guia-chat.js:92-96`).
- **Sin límite de uso** en `guia-agente` ni en `whatsapp` (G-NOVA sí tiene 40/día).
- **Cuenta fija en código** para encender el agente (`AGENTE_EMAILS`) y para admin de WhatsApp.

### 9.3 Pendientes y a quién preguntar

| # | Pendiente | Rol a consultar |
|---|---|---|
| 1 | Confirmar si el número de WhatsApp está conectado, el webhook verificado y qué plantillas `gg_*` están aprobadas | Responsable de Meta/WhatsApp (Dirección o TI) |
| 2 | Confirmar qué modelo responde en producción y si `claude-sonnet-5` funciona (contradicción §9.1-5) | Responsable técnico de la Landing |
| 3 | Decidir si el agente con herramientas se abre a todo el equipo y con qué batería de pruebas | Dirección |
| 4 | Corregir el texto de Ayuda "solo lectura" o limitar acciones | Dirección + producto |
| 5 | Exigir confirmación en servidor para acciones que envían o borran | Responsable técnico |
| 6 | Decidir si brokers pueden crear cartas oferta/clientes por WhatsApp y acotar `coBuscarCliente` | Dirección comercial + técnico |
| 7 | Terminar el renombre "G-IA" → "GG-IA" en la pantalla de login, encabezados y prompt de `guia-chat`; correr/verificar `ggia_renombre_2026-11-17.sql` | Responsable técnico |
| 8 | Definir quién y en cuánto tiempo atiende leads y altas pendientes de WhatsApp | Dirección comercial |
| 9 | Política de retención y privacidad de conversaciones de WhatsApp y bitácoras | Legal + Dirección |
| 10 | Verificar que Resend, Outlook/Google y BigQuery estén configurados | TI |
| 11 | Decidir qué hacer con el buscador "anónimo" de la home (abrirlo, quitarlo o redirigir a WhatsApp) | Marketing + Dirección |
| 12 | Actualizar `docs/GIA_AGENTE_PLAN.md` y registrar resultados de su batería de pruebas | Responsable técnico |
