# 05 · Conexiones entre plataformas (Intelligence · Landing · MacroPro · GG-IA)

## 1. Identificación

| Dato | Valor |
|---|---|
| Alcance inspeccionado | Repositorio **MacroPro** (`macropro/…`, rama `claude/wizardly-cerf-QhtU1`, igual a `main` en `aa8fb8b` más estos documentos) y repositorio **Landing** (`landing/…`, rama `main`, commit `3f81213`). Intelligence y GG-IA viven dentro del repositorio de la Landing. |
| Fecha de revisión | 2026-11-18 |
| Entorno | Inspección de código y pruebas locales con datos ficticios (red simulada). **No se verificó nada en producción**: ni variables de entorno, ni que el SQL esté corrido, ni que los crons estén activos, ni que las plantillas de WhatsApp estén aprobadas. |
| Fuentes | Este archivo consolida la sección 6 de `01-Intelligence.md`, `02-Landing.md`, `03-MacroPro.md` y `04-GG-IA.md`. Cada fila remite a la evidencia de esos archivos; aquí solo se repiten las referencias clave. |

**Cómo leer la tabla:** "Evidencia" dice qué tanto está comprobado. Una conexión
[Implementada en código, no probada] existe en el código, pero **no se sabe si está
configurada ni si corre en producción**. Ninguna fila está verificada en producción.

## 2. Mapa general (en palabras)

- **Las cuatro herramientas comparten una sola base de datos (Supabase).** MacroPro y la Landing leen y escriben tablas en común: `captaciones`, `clientes`, `lotes`, `cartas_oferta`, `acuerdos_comision`, `sla_controles` y otras. Por eso varias "conexiones" no son envíos entre sistemas, sino **dos pantallas que leen el mismo registro**.
- **La Landing aloja tres de las herramientas:**
  - el sitio público y las zonas privadas (Landing);
  - **GG-IA** (`/asistente`, el panel flotante, los portales de broker y desarrollador, y el bot de WhatsApp);
  - **Intelligence** (`/intelligence.html`, una app aparte).
- **MacroPro es la herramienta interna del equipo** (otro dominio). No tiene GG-IA adentro. Llama funciones de la Landing para mandar ligas, consultar correos y aplicar el 60/40, y abre Intelligence en otra pestaña.
- **Los envíos automáticos** (correo con Resend, WhatsApp con Meta, avisos push y la campanita) los hacen **funciones de la Landing**, por evento o por cron. MacroPro **no envía nada de forma automática**: sus botones de WhatsApp y correo solo abren la app del usuario (`wa.me`, `mailto`), salvo las funciones de la Landing que llama.

## 3. Tabla de flujos

| Flujo | Origen | Destino | Qué se comparte | Quién lo ve | Paso humano | Evidencia | Incógnitas |
|---|---|---|---|---|---|---|---|
| Interés de un prospecto en una liga de presentación | Landing `/c/:token` (prospecto) | `landing_clientes` → MacroPro (`clientes`) por trigger | Nombre, contacto y terreno de interés | Asesor dueño de la liga; equipo en MacroPro | El asesor da seguimiento | [Implementada en código, no probada]: `landing/supabase/fix_no_push_anonimos.sql:1-25` (02 §6) | Si el trigger está activo en producción; si también llega a HubSpot ([No verificada]) |
| Clientes de MacroPro hacia la Landing | MacroPro `clientes` | Landing `landing_clientes` | Clientes y criterios de búsqueda (para el matching de la Landing) | Asesores en la Landing (según RLS) | Ninguno (cron cada 15 min) | [Implementada en código, no probada]: `landing/netlify/functions/sync-macropro-cron.js:1-15` (01 §6, 02 §6) | Si el cron corre; sin la llave de servicio no hace nada |
| Alta de terrenos (inventario) | MacroPro (Excel del equipo) | `lotes` por RPC `landing_import_lotes`; asignar asesor con `landing_guardar_terreno` | Lotes de inventario y asesor | Landing (vistas `v_landing_*`), GG-IA, Intelligence | El equipo carga el Excel | [Implementada en código, no probada] (03 §6.1) | `CLAUDE.md` dice que MacroPro no escribe en tablas compartidas; el código sí lo hace por RPC (contradicción documentada en 03) |
| Captación de un terreno (opcionador) | Landing (`/opcionar-terreno`, `/aceptar`, expediente), `macropro/captar.html` y la ficha de MacroPro | `captaciones` (compartida) | Datos del terreno, propietario, documentos (`documentos_urls`), liga de Maps | Equipo en MacroPro (Kanban de Opción / Captación); el propietario ve su expediente con su liga | El propietario sube documentos; el equipo revisa | [Implementada en código, no probada]; MacroPro escribe `captaciones` (03 §6.1); unificación de documentos en `macropro/sql/unificar_docs_legal.sql` | Qué SQL de unificación está corrido (el diagnóstico del 2026-11-18 mostró 0 documentos legales sin unificar) |
| SLA y Blindaje (relojes) | Cambios en `captaciones` (etapa, documentos, Maps, firma) | `sla_controles` (trigger `trg_sla_captacion`) → MacroPro (`sla_tablero`) | Estado del reloj, % de tiempo, fecha límite, documentos faltantes | Equipo en el Kanban de MacroPro | El equipo marca "cumplido" en Estudios y Fotografía | [Probada en local con datos ficticios]: SQL en Postgres local y franja del Kanban en harness jsdom (03 §3); `macropro/sql/sla_blindaje_fase1.sql` | En producción el SQL se corrió (39 relojes, todos en pausa por documentos); los avisos dependen del cron y de WhatsApp |
| Avisos de SLA y resumen semanal | Cron de la Landing `sla-alertas` | WhatsApp a Admin (75 % y 100 %) y Asesor (100 %); resumen de los lunes por WhatsApp y correo | Proceso, terreno, asesor, vencimiento; documentos faltantes | Admin y asesor destinatarios | Atender el vencimiento o subir los documentos | [Probada en local con datos ficticios]: `/var/tmp/copg/fn-sla.mjs` 12/12 (04 §6) | Si el cron corre en Netlify, si hay número de WhatsApp y plantillas aprobadas, y el método de pago en Meta |
| Envío de la liga del convenio de comisión | MacroPro (botones Correo / "Enviar la liga a todos") | Función de la Landing `acuerdo-enviar-link` → correo (Resend) | Liga `/acuerdo/<token>` y la lista de terrenos; registra `liga_enviada_at` | Asesor (correo); el equipo ve "Enviado" en MacroPro | El equipo decide cuándo enviar | [Probada en local con datos ficticios]: `fa-envios-test` (03 §3) y `fn-enviar-link` (02) | Si Resend está configurado y su dominio verificado; entregabilidad real (se puede revisar con 📬 Estado de correos) |
| Firma del convenio | Landing `/acuerdo/<token>` (asesor con sesión o código al correo) | `acuerdos_comision` (firmado + PDF) → MacroPro "✅ Firmado" | Esquema elegido, firma, IP, huella, PDF, lista de terrenos cubiertos | Asesor (su PDF); equipo (MacroPro y Landing) | El asesor firma; el Equipo valida (confirma el semáforo) | [Implementada en código, no probada] en el flujo completo; partes probadas en local (sesión, nombre, contrato del 60/40) (02, 03) | En producción se firmó al menos un convenio real el 2026-11-17 (dato del usuario, no verificado en código) |
| Recordatorios del convenio y 60/40 por política | Cron de la Landing `convenio-recordatorio` | Correo y WhatsApp al asesor; al quinto intento entregado, estado `forzado_6040` con PDF | Liga, número de recordatorio, aviso del 60/40 | Asesor; equipo en MacroPro (Firmado → "60/40 por política") | Dirección puede aplicarlo de inmediato con "⚖️ Aplicar 60/40 ahora" (solo admin) | [Probada en local con datos ficticios]: `fn-convenio`, `fn-convenio-completo` (02) y `fa-envios-test` (03) | Validez legal de la política 60/40 (Legal); plantillas de WhatsApp aprobadas |
| Estado de correos | MacroPro (botón 📬) | Función de la Landing `correo-diagnostico` → API de Resend | Últimos 50 correos: destinatario, asunto, estatus (entregado o rebotó) | Solo admin | El admin revisa | [Probada en local con datos ficticios]: `diag-test` (03) y `fn-diag` (02) | Que la API de listado de Resend esté disponible en el plan contratado |
| Carta oferta | MacroPro (wizard) y bot de WhatsApp (flujo guiado) | `cartas_oferta` → ligas `/oferta/:token` (comprador y vendedor); avisos por correo y WhatsApp | Términos de la oferta, firmas, rondas | Comprador, vendedor, asesor, Dirección | El asesor arma la oferta; Dirección autoriza; las partes firman | [Implementada en código, no probada] (03 y 04); avisos probados en local (`fn-recordatorios`, `fn-rojos`) | Si el bot de WhatsApp está conectado; alcance de la búsqueda de clientes en WhatsApp (hallazgo en 04) |
| MacroPro → Intelligence (valuador) | Ficha de captación en MacroPro ("🧠 Analizar en Intelligence") | `landing/public/intelligence.html?fuente=opcionador&c=<id>` | Solo el id; Intelligence lee los datos frescos de Supabase | Usuario con sesión en el dominio de la Landing y permiso de Intelligence | El usuario abre y analiza | [Implementada en código, no probada]: `macropro/index.html:17650-17668` (01 §6) | Los permisos de Intelligence están cruzados (01 §9): un asesor puede ver el botón y luego no tener acceso |
| GG-IA → Intelligence | GG-IA (`guia-agente`) | Liga a `/intelligence.html` | Liga | Dirección | — | [Implementada en código, no probada]: `landing/netlify/functions/guia-agente.js:4177` (01 §6) | Las secciones de oportunidades y amenazas dicen "se está conectando… muy pronto" |
| GG-IA consulta el inventario y la cartera | Supabase (`v_landing_lotes`, `landing_clientes`, `crm_lotes`, cartas oferta) | Respuestas de GG-IA (web y WhatsApp) | Fichas de terreno, datos de clientes según el canal | Web: según RLS del usuario. WhatsApp: el servidor filtra (registrado o no) | El asesor revisa y decide | [Probada en local con datos ficticios] solo la lógica del webhook de WhatsApp sin IA (04 §7); respuestas del modelo [No verificada] | Qué modelo responde en producción; si el número de WhatsApp está activo |
| Búsquedas sin resultado (GG-IA → MacroPro) | Bot de WhatsApp | MacroPro (`macropro_busquedas_*`) | Lo que pidió el prospecto y no se encontró | Equipo en MacroPro | El equipo decide si busca terreno | [Implementada en código, no probada] (03 §6.1, 04) | Que alguien revise esa bandeja |
| HubSpot | Formularios de la Landing (home, `/alta`, `/captura`) | HubSpot Forms y Contacts API; lectura a `landing_leads` y deals a `hubspot_deals_pendientes` cada 15 min | Contactos y negocios | Admin (Landing); Dirección (Intelligence, pipeline) | El equipo trabaja el lead en HubSpot | [Implementada en código, no probada] (02 §6, 01 §6) | Si el token de HubSpot está configurado; `/opcionar-macrolote`, `/vender`, `/b/:token` y `/q/:token` **no** llegan a HubSpot según el código |
| Página de selección del broker | Landing `/b/:token` | WhatsApp directo al broker (`wa.me`) | Solo abre el chat; cuenta aperturas | El broker | El broker atiende a su cliente | [Implementada en código, no probada] (02 §6) | **Grupo Guía no recibe ese lead** (por código). Hay que confirmar si es intencional |
| Solicitud de cotización de un broker | Landing (broker) | `solicitudes_cotizacion_broker` + correo al responsable | Terreno y datos de la solicitud | Admin (`/asesores?tab=brokers`) | Un humano entrega el precio fuera del sistema | [Probada en local con datos ficticios] (02, prueba propia 23/23) | Por qué canal se responde; el plazo de respuesta viene apagado por defecto |
| Prospectos de `/opcionar-macrolote` | Landing (visitante) | `prospectos_macrolotes` | Datos del prospecto | **Nadie** (sin pantalla ni aviso, según el código) | — | [Probada en local con datos ficticios] solo el guardado (02) | Hay que asignar un dueño y un aviso (Dirección comercial) |

## 4. Quién crea y quién solo consulta cada dato

| Dato | Lo crea / edita | Lo consulta | Nota |
|---|---|---|---|
| Inventario de lotes | MacroPro (Excel por RPC), Landing (alta de terrenos) | Landing, GG-IA, Intelligence | Las vistas `v_landing_*` filtran lo público |
| Clientes / requerimientos | MacroPro (`clientes`), Landing (`landing_clientes` por ligas y formularios) | Las dos (sync cada 15 min y trigger) | Doble tabla con sincronización |
| Captaciones y expedientes | MacroPro, Landing (opcionador o propietario), `captar.html` | MacroPro (Kanban), Intelligence (valuador), SLA | Tabla compartida |
| Convenios de comisión | Landing (`acuerdo_crear` vía MacroPro, firma en `/acuerdo`) | MacroPro (Por asesor / Sin asesor), Landing | Las reglas de negocio (un convenio por asesor, 60/40) viven en el SQL de la Landing |
| Relojes de SLA | Base de datos (trigger) y cron de la Landing | MacroPro (Kanban) | Las alertas solo salen desde la Landing |
| Cartas oferta | MacroPro (wizard), GG-IA (WhatsApp) | Landing (ligas de firma), MacroPro | |
| Conversaciones e historial de GG-IA | GG-IA | El usuario y el admin (auditoría) | No se ven en MacroPro |
| Análisis e informes | Intelligence | Dirección y el desarrollador (lo suyo) | Varios datos son estimados (01 §3) |

## 5. Contradicciones entre documentación y código (para no repetirlas en ventas)

- **Escrituras de MacroPro en tablas compartidas:** `CLAUDE.md` y un comentario en el código dicen "solo lectura con 3 excepciones". El código escribe en más tablas (03 §6.1).
- **Versión de MacroPro:** el código muestra v6.14 y `CLAUDE.md` dice v8.5 (03).
- **GG-IA "de solo lectura":** la Ayuda lo dice, pero el agente crea registros y envía correos (04).
- **Permiso de Intelligence:** el interruptor "Puede entrar a Intelligence" abre otra pantalla, "Inteligencia Guía", no la app Intelligence (01).
- **Terminología del esquema:** aparece "60/40" y "40/60" para el mismo esquema (02).
- **Nombre "G-IA" pendiente:** quedan textos viejos en el login y en los encabezados del chat de GG-IA (04).

## 6. Pendientes de conexiones (a quién preguntar)

1. **TI / Administrador de plataforma:**
   - qué variables están configuradas en Netlify (Resend, WhatsApp, HubSpot, VAPID, secreto de los crons, llave de servicio);
   - qué crons corren de verdad (revisar sus latidos en la tabla de salud);
   - qué SQL está aplicado en Supabase.
2. **Meta / TI:** si el número de WhatsApp y su webhook están activos, qué plantillas están aprobadas y si hay método de pago.
3. **Dirección comercial:**
   - quién atiende los prospectos de `/opcionar-macrolote`;
   - si el lead de `/b/:token` debe llegar a Grupo Guía;
   - por qué canal se responden las cotizaciones de brokers.
4. **Legal:** la política del 60/40, los términos que aplican a brokers y compradores, y la retención de conversaciones de WhatsApp.
5. **Dirección + TI:** unificar el permiso de Intelligence; decidir si GG-IA debe pedir confirmación en el servidor antes de enviar.
