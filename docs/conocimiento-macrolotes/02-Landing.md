# 02 · Landing (sitio público y zonas privadas de Grupo Guía Macrolotes)

> Documento de conocimiento para el equipo de Grupo Guía Macrolotes. Describe **lo que el código
> demuestra**, no lo que está activo en producción. Cada afirmación importante lleva ruta, símbolo y
> línea. Las rutas del repositorio de la Landing se escriben `landing/<ruta>` y las de MacroPro
> `macropro/<ruta>`.

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Herramienta | **Landing**: sitio público + zonas privadas del repositorio `grupoguiamacrolotes-landing` (dominio público en código: `macrolotes.grupoguia.mx`) |
| Alcance inspeccionado | Rutas de `landing/src/App.jsx`, páginas de `landing/src/pages/`, componentes clave de `landing/src/components/`, librerías de `landing/src/lib/`, funciones `landing/netlify/functions/` y `landing/netlify/lib/`, SQL de `landing/supabase/`, documentos operativos en la raíz y `landing/docs/`, `landing/netlify.toml` y `landing/public/_redirects`. Referencias cruzadas a `macropro/index.html` y `macropro/sql/`. |
| Fuera de alcance (solo se mencionan) | GG-IA (`/asistente`, chat flotante `GuiaIA`, WhatsApp de GG-IA), Intelligence (`/valuador`, `intelligence.html`), G-NOVA (`/ia-general`), Vive (`/vivienda`). Los documentan otros equipos. |
| Rama y commit Landing | `main` · `3f81213` "SLA + Blindaje · Fase 2: avisos de GG-IA al 75 % y 100 % y resumen semanal de expedientes (#3172)" |
| Rama y commit MacroPro (referencia) | `claude/wizardly-cerf-QhtU1` · `aa8fb8b` "SLA + Blindaje: SQL (Fase 1) y reloj en las tarjetas del Kanban (Fase 3) (#170)" |
| Fecha de revisión | 2026-11-18 |
| Entorno | Inspección de código en contenedor Linux (Node v22.23.4, Vite 5.4.21). Sin acceso a Supabase, Netlify, Resend, HubSpot ni WhatsApp reales. |
| Qué se ejecutó localmente | (1) `node scripts/verificar-funciones.mjs`: 218 funciones Netlify compilan. (2) `npx vite build --outDir /var/tmp/doc-landing-dist`: el sitio compila (solo avisos de tamaño de bloque). (3) Pruebas existentes con red simulada en `/var/tmp/copg/` (carta oferta, liga de acuerdo, pausa de captación, WhatsApp admin, SLA). (4) Un arnés propio con **datos ficticios** y `fetch` simulado (ver §3, etiquetas [Probada en local con datos ficticios]). Ninguna prueba tocó red ni producción; no se modificó código. |
| Disponibilidad en producción | **NO verificada.** No se abrió el dominio público ni se llamó ninguna función desplegada. Que algo exista en código no significa que esté desplegado, configurado (variables de entorno) ni con su SQL corrido en la base. |

---

## 2. Qué problema resuelve y para quién

La Landing es la **puerta web de Grupo Guía Macrolotes**: concentra en un solo dominio (a) la cara pública de marketing, (b) las ligas que el equipo comparte con clientes y propietarios, (c) los formularios de captación y (d) los portales con cuenta para el equipo interno y para externos (brokers, compradores, desarrolladores). También es la **dueña de varias tablas compartidas** con MacroPro: MacroPro trabaja en modo de solo lectura sobre ellas (`macropro/index.html:230`, `MP_READONLY_SHARED = true`).

Usuarios identificados en el código (no se suponen otros):

| Usuario | Cómo lo reconoce el código | Referencia |
|---|---|---|
| Visitante anónimo / prospecto | Sin sesión; ve la home pública y las ligas/fichas compartidas | `landing/src/App.jsx:901-905`, `865-875` |
| Colaborador interno (asesor, gerente, director) | Correo confirmado + dominio de Grupo Guía, o ficha activa, o acceso/admin | `landing/src/lib/auth.js:243-257`, `landing/src/lib/supabase.js:43` |
| Administrador / CEO | RPC `landing_es_admin`, `landing_es_ceo` | `landing/src/lib/auth.js:57`, `149` |
| Broker externo ("Guía Macro Broker") | Sin dominio interno; RPC `landing_es_broker` / `landing_broker_self` | `landing/src/lib/auth.js:288-319` |
| Comprador externo (buyer) | Portal `/comprador`, RPC `landing_es_buyer` | `landing/src/pages/CompradorPortal.jsx:1-7`, `landing/src/lib/buyers.js:6` |
| Propietario / opcionador / vendedor de terreno | Ligas con id o token, sin cuenta | `landing/src/pages/AceptarCotizacion.jsx:1-9`, `ExpedienteOpcionador.jsx:1-7`, `SellerPanel.jsx:1-4` |
| Comprador de una carta oferta | Liga `/oferta/:token` y `/mi-oferta/:token` | `landing/src/pages/CartaOferta.jsx:1-7`, `MiOferta.jsx:1-7` |
| Director de desarrollo aliado | `/portal-desarrollo`, RPC `landing_desarrollador_self` | `landing/src/App.jsx:655-673`, `1018-1031` |
| Recepción (staff de afluencia) | `/afluencia` con login de staff | `landing/src/pages/AfluenciaCaptura.jsx:1-3` |

---

## 3. Inventario de funciones por flujo

Formato por función: **Usuario · Entrada · Acción · Resultado · Quién lo ve · Límites · Evidencia · Referencia.**

### 3.1 Cara pública y analítica

**Home pública de marketing** · Visitante · abre `/` o `/home` sin sesión · muestra secciones de marketing, cifras y destacados · página informativa · cualquiera · las cifras salen de `cifras-publicas` (solo conteo, superficie y ciudades; si falla, la sección no se dibuja) · [Implementada en código, no probada] · `landing/src/App.jsx:902-904`, `landing/src/pages/HomePublica.jsx:5-14`, `landing/netlify/functions/cifras-publicas.js:1-6`.

**Formulario "Contacta a un asesor" de la home** · Visitante · nombre, correo, teléfono, mensaje · si existen `VITE_HUBSPOT_PORTAL_ID` y `VITE_HUBSPOT_FORM_ID` en el build, envía a HubSpot Forms; si no, abre un `mailto` al buzón genérico de contacto · el visitante ve "¡Gracias!" · el lead **no se guarda en Supabase** · aquí las variables NO tienen valor por defecto (a diferencia de `landing/src/lib/hubspot.js:17-19`), así que el destino depende de la configuración del build · [Implementada en código, no probada] · `landing/src/components/publico/ContactoPublico.jsx:6-8`, `21-42`.

**Analítica anónima de eventos** · Cualquier visitante/usuario · navegación y clics (ver ficha, descargar, WhatsApp, cotizar) · inserta en `landing_eventos` con un id de sesión del navegador; si hay sesión agrega el correo del colaborador · tableros internos · "fire-and-forget"; no guarda datos personales del anónimo · [Implementada en código, no probada] · `landing/src/lib/analytics.js:1-49`, `landing/src/pages/FichaPublica.jsx:136`.

**Atribución de origen (UTM y `?brk=`)** · Visitante de campaña · parámetros `utm_*`, `brk`, `dev` · guarda el primer origen 30 días en el navegador y lo adjunta al crear un lead (`lead_origen`) · alimenta "Mis campañas" del broker · **Límite importante:** `capturarOrigen()` solo se llama desde el componente `Analytics`, que solo se monta dentro del shell autenticado (`landing/src/App.jsx:68-79`, montado en `917`). La home pública (`902-904`), `/alta/:asesorId` y demás páginas públicas regresan antes. Según el código, un visitante anónimo que llega con `/?brk=<id>` **no queda guardado** y su lead cae como "directo" a la cola general. · [Parcial / en desarrollo] · `landing/src/lib/origen.js:22-38`, `landing/src/lib/crm.js:1124-1146`.

### 3.2 Fichas y presentaciones compartibles (sin cuenta)

**Ficha pública de terreno `/f/:tipo/:id`** · Asesor/GG-IA la comparte; la abre cualquiera · id del lote · muestra datos públicos (vistas `v_landing_lotes`/`v_landing_corretaje`), mapa, mercado, formas de pago · sin datos internos (dueño, asesor, precio interno) · registra eventos de vista y descarga · [Implementada en código, no probada] · `landing/src/App.jsx:340-348`, `landing/src/pages/FichaPublica.jsx:1-6`, `76-81`, `136`.

**Fichas `/desarrollo/:slug`, `/lote/:id`, `/corretaje/:id`** · Sin sesión (o con `?solo=1`) abren en "modo cliente" sin menú; con sesión el asesor ve el layout completo · el comentario indica que "el RLS filtra lo interno" (no verificado en base) · [Implementada en código, no probada] · `landing/src/App.jsx:859-875`.

**Corretaje: "Solicitar condiciones"** · Visitante en ficha de corretaje · abre WhatsApp al especialista activo del tipo de inventario (tabla `especialistas_contacto`); si no hay, cae a un formulario · solo registra el clic en analítica · [Implementada en código, no probada] · `landing/src/components/FichaLote.jsx:928-933`, `landing/src/components/ContactarEspecialista.jsx:1-32`.

**Dossier imprimible `/dossier/:slug`** · Asesor · página sin precios para imprimir o guardar PDF, remata con la liga curada · [Implementada en código, no probada] · `landing/src/App.jsx:500-511`.

**Colección de campaña `/c/:slug`** · Admin la crea (pestaña `colecciones`) · 4–6 terrenos curados con URL propia y UTM; solo abre si está activa · [Implementada en código, no probada] · `landing/src/pages/Coleccion.jsx:1-3`, `landing/src/components/PanelAsesor.jsx:669`.

**Ficha de Vitrina `/vitrina/f/:folio`** · Cliente sin sesión ve vista limpia con "Solicitar más información" que abre WhatsApp al número central configurado (`getConfig('whatsapp')`) con el folio · no guarda lead · [Implementada en código, no probada] · `landing/src/App.jsx:350-363`, `landing/src/pages/VitrinaFicha.jsx:79`, `134-145`.

### 3.3 Ligas con rastreo

**Liga de presentación / Selección privada `/c/:token`** (token de 32 hexadecimales)
- *Quién la crea:* admin o cualquier colaborador activo del dominio (`landing_liga_crear`), y también un broker "elevado" (`landing_broker_gia_asesor`) · `landing/supabase/ligas_equipo_crear_2026-09-11.sql:1-16`, `landing/supabase/liga_crear_broker_asesor_2026-10-26.sql:1-28`. Se administra en la pestaña `ligascliente` (`landing/src/components/PanelAsesor.jsx:672`).
- *Qué registra:* cada apertura de portada y cada sección vista en `landing_ligas_acceso` (correo si lo dejó, **hash** de IP —nunca la IP—, navegador, sección) · `landing/supabase/ligas_cliente_2_acceso_2026-09-03.sql:1-24`, `landing/src/pages/VistaCliente.jsx:58-69`.
- *Aviso al abrir:* `liga-abierta-aviso` crea campanita "👀 Abrieron tu liga" al asesor dueño y push al celular si hay VAPID; una sola vez cada 6 h; no avisa si la liga se creó hace menos de 3 min · `landing/netlify/functions/liga-abierta-aviso.js:1-11`, `30-73`, llamada en `landing/src/pages/VistaCliente.jsx:82-92`. **[Probada en local con datos ficticios]**: liga válida → 1 campanita al asesor dueño, sin VAPID `push=0`; segunda apertura en < 6 h → no repite; liga recién creada → no avisa; token inexistente → responde ok sin confirmar ni avisar.
- *"Quiero más información":* el prospecto deja nombre, correo y celular → RPC `landing_liga_interes` da de alta o actualiza al cliente en `landing_clientes` atribuido al asesor de la liga (dedup por correo, `origen_lead` = `liga_presentacion`, `interes_liga`) y registra la sección `interes` · `landing/supabase/ligas_interes_capturar_2026-09-10.sql:17-68`, `landing/src/pages/VistaCliente.jsx:441-457`.
- *Avisos del interés:* trigger `_liga_notificar_interes` → campanita al asesor (`landing/supabase/ligas_aviso_interes_2026-09-04.sql:12-25`) + correo `liga-interes-aviso` vía Resend al asesor con los datos y botón a `/asesores?tab=ligascliente` · `landing/netlify/functions/liga-interes-aviso.js:1-83`. **[Probada en local con datos ficticios]**: el correo va al asesor de la liga, con nombre/correo/celular del prospecto y la liga de seguimiento.
- *Seguimiento automático:* recordatorio diario si el prospecto sigue sin atención (≥ 20 h, ≤ 21 días; campanita + push + correo) · `landing/netlify/functions/avisos-leads-sin-atender.js:1-14`, cron `35 14 * * *` UTC (`avisos-leads-sin-atender-cron.js:14`) · señal "ligas calientes" en Inicio (abierta esta semana sin contacto en 7 días) · `landing/supabase/41_pr_b_ligas_calientes_2026-09-11.sql:1-10` · [Implementada en código, no probada].
- *Límites:* no expira; se controla revocando. Lenguaje prohibido en textos (plusvalía, rendimiento, retorno, ROI, "ganancia asegurada") · `landing/supabase/ligas_cliente_1_base_2026-09-03.sql:12-16`, `_liga_palabra_prohibida`.

**Liga de cotización `/q/:token`** · La genera `generar-liga-cotizacion` (llamada desde `enviar-whatsapp-cotizacion`; el llamador externo no está en este repo) · la sirve una función (`landing/netlify.toml:36-38`, `landing/public/_redirects`) que muestra ficha, presentación y PDF · suma `tracking_aperturas` y avisa "📬 Abrieron tu cotización" (anti-duplicado) · `landing/netlify/functions/q.js:1-8`, `145-170` · [Implementada en código, no probada]. **"Quiero más información" (`q-interes`)**: crea campanita "🔥 Interés en tu cotización" al asesor · `landing/netlify/functions/q-interes.js:12-63`. **[Probada en local con datos ficticios]**: con cotización válida crea 1 notificación; **es la única escritura** (el lead no se guarda en ninguna otra tabla ni se manda correo); sin teléfono → 400.

**Selección de broker `/b/:token`** · ver §4.3 (pregunta especial).

**Selección privada de Vitrina `/v/:token`** · registra apertura e interés (`vitrina_sel_acceso` → `vitrina_seleccion_acceso`) y avisa por correo al asesor (`vitrina-sel-aviso`) · `landing/src/pages/VistaClienteVitrina.jsx:29-32`, `142-144`, `landing/netlify/functions/vitrina-sel-aviso.js:1-6` · [Implementada en código, no probada].

**Liga de campaña del broker `/?brk=<id>`** · ver límite en §3.1 · [Parcial / en desarrollo].

### 3.4 Captación de propietarios, opcionadores y vendedores

**`/vender` (también `/vende-tu-terreno`, `/opcionar-terreno`)** · Dueño que quiere vender · ubicación, m² aprox., uso, contacto + casillas legales · RPC `landing_alta_lead_seller` guarda en `landing_leads_seller`; `seller-intake` cruza tentativamente contra compradores y pone prioridad interna (el vendedor nunca ve cuántos compradores hay) · bandeja admin "Terrenos por vender" (`vender`) · [Implementada en código, no probada] · `landing/src/pages/Vender.jsx:1-6`, `73-90`, `landing/src/lib/seller.js:9-27`, `landing/netlify/functions/seller-intake.js:1-14`, `landing/src/components/PanelAsesor.jsx:673`. El proceso "llamar primero a los de mayor prioridad" solo está en `landing/MANUAL_MARKETPLACE.md` §2 → [Documentada, no verificada en código].

**`/opcionar-macrolote`** · Dueño o asesor · nombre, contacto, ciudad, hectáreas, expectativa · `prospecto-intake` inserta en `prospectos_macrolotes` (llave de servicio, límite 10/min por IP) · **no hay pantalla en la Landing ni en MacroPro que lea esa tabla** (búsqueda en todo el repo y en `macropro/index.html`) y no se avisa a nadie · `landing/src/components/CaptacionOpcionador.jsx:1-6`, `25`, `landing/netlify/functions/prospecto-intake.js`. **[Probada en local con datos ficticios]**: inserta con `origen=opcionador` y hectáreas normalizadas ("2.5 ha" → 2.5); no dispara aviso ni correo; sin teléfono ni correo → 400. Estado del flujo completo: [Parcial / en desarrollo].

**`/opcionar` (corretaje)** · Asesor · formulario real de HubSpot embebido; `corretaje-intake` espeja los datos al inventario (documentos quedan en HubSpot) · [Implementada en código, no probada] · `landing/src/pages/OpcionarCorretaje.jsx:1-11`, `landing/netlify/functions/corretaje-intake.js:1-13`.

**`/aceptar?c=<id>` y `/rechazar?c=<id>`** · Propietario (liga que genera MacroPro en el PDF de cotización: `macropro/index.html:18232-18233`) · acepta Términos y sube documentos sin cuenta, o rechaza con motivo · RPCs públicas `opcionador_*` · correo de agradecimiento con faltantes (`opcionador-gracias-docs`) · [Implementada en código, no probada] · `landing/src/pages/AceptarCotizacion.jsx:1-9`, `RechazarCotizacion.jsx:1-3`.

**Expediente del propietario `/expediente/:token` (Liga Mágica)** · Propietario · token `captaciones.liga_token` · ve y sube documentos del expediente legal · reemplaza la vieja `captar.html` de MacroPro · MacroPro arma la liga (`macropro/index.html:17514`, `17904`) · [Implementada en código, no probada] · `landing/src/pages/ExpedienteOpcionador.jsx:1-7`. Recordatorio "en pausa" a dueños sin documentos: **[Probada en local con datos ficticios]** (harness existente `fn-pausa`: quien ya subió documentos no recibe aviso; quien no, sí) · `landing/netlify/functions/captacion-pausa-recordatorio.js`.

**`/mi-portal/:captacion_id`** · Asesor y cliente sin cuenta · línea de tiempo (60/40) o checklist (100/0) con opción de cambiar de esquema · se abre con el **id** de la captación, no con un token aparte · [Implementada en código, no probada] · `landing/src/pages/MiPortal.jsx:1-6`.

**`/mi-terreno/:token` (panel del vendedor)** · Vendedor · estado, 3 métricas, oportunidades dosificadas · el admin **copia la liga a mano** para mandarla · [Implementada en código, no probada] · `landing/src/pages/SellerPanel.jsx:1-5`, `landing/src/components/GestionLeadsSeller.jsx:289-292`.

**`/terreno/:id/informe`** · Cliente opcionador con token · informe de actividad; con poco volumen muestra estado, nunca nombres ni correos; token inválido → "enlace no válido" · [Implementada en código, no probada] · `landing/src/pages/InformeLote.jsx:1-4`.

**Retiradas:** `/portal` y `/aceptar-esquema/:token` solo orientan a quien tenga ligas viejas · `landing/src/pages/PortalOpcionador.jsx:1-5`, `AceptarEsquema.jsx:1-5`.

### 3.5 Acuerdo de comisión del asesor

**`/acuerdo` (liga fija, sin cuenta)** · Asesor · alta de terreno (datos del asesor, cliente, ubicación por liga de Maps/KMZ) + elige 100/0 o 60/40 viendo 19 actividades, 4 confirmaciones y firma con su nombre · `acuerdo-alta` registra folio, fecha, hora, IP, huella SHA-256 y PDF a su correo con copia al Equipo · [Implementada en código, no probada] · `landing/src/pages/AltaTerreno.jsx:1-9`.

**`/acuerdo/:token`** · Asesor con su cuenta o con código OTP al correo del convenio · firma sobre terreno ya registrado; estado `forzado_6040` sin opción de firmar · `landing/src/pages/AcuerdoComision.jsx:1-11`. Envío de la liga desde MacroPro (`acuerdo-enviar-link`, llamado en `macropro/index.html:2891`, `22007`, `22036`): **[Probada en local con datos ficticios]** (harness existente `fn-enviar-link`, 8/8: el destinatario sale del servidor, no del navegador; registra fecha de envío sin pisar la primera; convenio 60/40 por política ya no se manda a firma).

### 3.6 Carta oferta y portal del comprador

**`/oferta/:token`** · Comprador o vendedor (cada uno su liga; la otra parte confidencial) · aceptar y firmar, contrapropuesta o rechazar · firma con fecha, hora, IP y navegador del lado servidor; vigencia 10 días · `landing/src/pages/CartaOferta.jsx:1-7`, `macropro/sql/cartas_oferta.sql:140-172`, `198`. Avisos por correo según el paso (`carta-oferta-notificar`) y aviso informativo al asesor (`carta-oferta-avisar-asesor`): **[Probada en local con datos ficticios]** (harness existente `fn-notif` y `fn-test`: al vendedor no se le revela el comprador; no se repiten correos; token desconocido no envía; el destinatario se resuelve en servidor). Aviso por WhatsApp al admin cuando el comprador firma (`carta-oferta-wa-admin`, disparado por trigger `pg_net`): lógica de plantilla→texto **[Probada en local con datos ficticios]** (`fn-wa-admin`); el trigger en base [No verificada].

**`/mi-oferta/:token` y `/expediente-compra/:token`** · Comprador · sigue el avance, ve la carta firmada y sube su expediente al bucket privado `oferta-docs`; la variante `/expediente-compra` es de solo lectura para banco o notario · [Implementada en código, no probada] · `landing/src/pages/MiOferta.jsx:1-7`, `landing/src/App.jsx:376-387`.

### 3.7 Altas de clientes por liga del asesor

**`/alta/:asesorId`** · Prospecto (liga que comparte el asesor) · datos de contacto · RPC `landing_alta_cliente_publico` lo da de alta en la cartera del asesor; además intenta HubSpot por Contacts API (`hubspot-contacto`, requiere token en servidor) y por Forms (`pushHubSpot`); si trae `brk` guardado lo rutea al broker · [Implementada en código, no probada] · `landing/src/pages/AltaPublica.jsx:35-44`, `landing/src/lib/crm.js:1124-1146`, `landing/src/lib/hubspot.js:123-139`, `326`.

**`/captura`** · Asesor desde cualquier dispositivo · ficha completa del cliente, se atribuye por correo del asesor; manda a HubSpot (Forms, marca Macrolotes o Kulkana) · [Implementada en código, no probada] · `landing/src/pages/CapturaAsesor.jsx:1-6`, `113-115`.

**`/perfil/:token`** · Contacto que recibió correo del motor de comunicación · llena su perfil de búsqueda · [Implementada en código, no probada] · `landing/src/pages/PerfilPublico.jsx:1-5`, `landing/netlify/functions/perfil.js:1-14`. El envío automático diario está **apagado por defecto** (`COMM_AUTOSEND`) · `landing/netlify/functions/comm-cron.js:7-9`.

### 3.8 Portal del broker (`/broker`)

**Acceso y alta** · Broker · enlace mágico por correo (principal), contraseña, o liga de activación del admin (`broker-activar`) · la solicitud de alta pide datos personales, fiscales y bancarios, documentos (INE, constancia, comprobante) y aceptación legal; queda `pendiente` · [Implementada en código, no probada] · `landing/src/pages/BrokerPortal.jsx:345-433`, `landing/supabase/brokers.sql:127-134`. Al admin **no se le notifica** la solicitud en el código revisado (solo queda en el log de estados) · `landing/supabase/brokers_gestion_bloque1.sql:156-170`.

**Embudo de aprobación** · Admin · `pendiente → contactado → convenio_enviado → convenio_firmado → aprobado → activo`; no se puede aprobar sin asignar inventario (allowlist) ni activar sin cuenta registrada · `landing/src/components/GestionBrokers.jsx:67-77`, `landing/supabase/brokers_gestion_bloque1.sql:136-146`.

**Portal activo** · Broker activo · módulos Inicio, Dashboard, Cómo funciona, Desarrollos, Inventario (solo lo asignado), Mis clientes, Opcionar/Mis terrenos, Estado de cuenta, Copiloto (IA), Mis campañas, Mi actividad, Inteligencia de mercado, Academia · `landing/src/pages/BrokerPortal.jsx:981-990`. Detalle de solicitudes y selección en §4.3.

**Registro de clientes del broker** · alta con protección: si el correo/teléfono ya existe (otro broker o asesor) responde conflicto · leads por campaña quedan con folio `BRK-AAAA-####` y **exclusividad 90 días** · `landing/supabase/brokers.sql:437-462`, `landing/supabase/lead_broker.sql:25-70` · [Implementada en código, no probada].

### 3.9 Portal del comprador (`/comprador`)

Comprador externo con su cuenta · ve inventario **dosificado** (sin precio exacto, sin ubicación precisa, sin contacto del dueño, sin fichas descargables), marca favoritos y declara qué busca · alertas por correo cuando entra un terreno que cumple su petición (cron diario `30 14 * * *` UTC, dedupe por comprador-lote) · [Implementada en código, no probada] · `landing/src/pages/CompradorPortal.jsx:1-7`, `landing/netlify/functions/buyer-alertas.js:1-10`, `buyer-alertas-cron.js:10`.

### 3.10 Avisos internos (campanita, push, correo)

- **Campanita** (`landing_notificaciones`): se refresca cada 90 s (no es tiempo real) · `landing/src/components/Campana.jsx:1-3`, `53`.
- **Push al celular**: requiere llaves VAPID en servidor y suscripción del usuario · `landing/src/lib/push.js:1-4`, `landing/netlify/lib/push.mjs:4-12`.
- **Correos** vía Resend: inertes si falta la llave (cada función lo indica).
- **Alertas de inventario** (nuevos y bajadas de precio, cron diario `0 16 * * *` UTC), **match inverso** de clientes (`crm-alertas`, disparo manual de admin), Vitrina (`vitrina-alertas`) · [Implementada en código, no probada] · `landing/netlify/functions/inventario-alertas.js:1-8`, `crm-alertas.js:1-4`, `vitrina-alertas.js:1-8`.
- **Aviso masivo a colaboradores** (`enviar-aviso`, solo admin) · `landing/netlify/functions/enviar-aviso.js:1-8` · [Implementada en código, no probada].

---

## 4. Pantallas y recorrido por perfil

### 4.1 Lista real de rutas (`landing/src/App.jsx`) agrupadas por audiencia

El orden importa: `App()` evalúa bloques `if (pathname.startsWith(...))` de arriba hacia abajo **antes** del candado de sesión; lo que no cae en ninguno pasa al candado (`892-911`) y al shell interno (`913-997`).

**A. Públicas sin sesión (marketing y legales)**
| Ruta | Página | Línea |
|---|---|---|
| `/`, `/home` (sin sesión) | `HomePublica` + botón GG-IA | 902-904 |
| `/login` y cualquier ruta privada sin sesión | `Portada` (acceso Broker / Desarrollador / Colaboradores) | 905, 1014-1016 |
| `/terminos` | `TerminosCondiciones` | 409-418 |
| `/privacidad`, `/confidencialidad` | `DocLegal` | 614-624 |

**B. Fichas y presentaciones compartibles (sin sesión)**
`/f/:tipo/:id` (344) · `/vitrina/f/:folio` (359) · `/desarrollo/:slug`, `/corretaje/:id`, `/lote/:id` sin sesión o con `?solo=1` (865-875) · `/dossier/:slug` (507) · `/c/:slug` colección (472).

**C. Ligas con token o id (sin cuenta)**
`/c/:token` (471) · `/v/:token` (483) · `/b/:token` (494) · `/q/:token` (función, `netlify.toml:36-38`) · `/perfil/:token` (531) · `/aceptar` (371) · `/rechazar` (424) · `/expediente/:token` (394) · `/expediente-compra/:token` (383) · `/mi-portal/:captacion_id` (404) · `/mi-terreno/:token` (712) · `/terreno/:id/informe` (775) · `/oferta/:token` (736) · `/mi-oferta/:token` (748) · `/acuerdo/:token` (762, pide cuenta u OTP dentro de la página) · retiradas: `/portal` (433), `/aceptar-esquema/:token` (724).

**D. Formularios públicos de captación**
`/vender`, `/vende-tu-terreno`, `/opcionar-terreno` (697-700) · `/opcionar-macrolote` (633) · `/opcionar` (648) · `/alta/:asesorId` (519) · `/captura` (801) · `/acuerdo` (761).

**E. Externos con cuenta propia**
`/broker`, `/broker/legal` (682-684) · `/comprador` (788) · `/portal-desarrollo`, `/portal-desarrollo/activar` (663-664) · dentro del shell, solo broker activo: `/mis-clientes`, `/mis-terrenos`, `/mi-cuenta` (961-965).

**F. Internas (colaboradores autorizados)**
Shell (927-979): `/`(Home interno), `/inicio`, `/macrolotes`, `/inventario`, `/plano`, `/desarrollo/:slug`, `/lote/:id`, `/corretaje/:id`, `/desarrollos`, `/mercado`, `/nosotros`, `/legal`; redirecciones `/corretaje`→`/inventario?tipo=corretaje`, `/tramites`→`/como-opcionar`; no disponibles para broker: `/asesores`, `/estado`, `/control-inventarios(/auditoria)`, `/academia`, `/como-opcionar`, `/valuador`; Vive `/vivienda*` (948-950, `RequiereAcceso`). Pantallas completas aparte: `/vitrina*` (822-857), `/opcionadores` (443), `/valuador?cot=` (455), `/asistente` (543, GG-IA), `/ia-general` (555, G-NOVA), `/calidad-datos` (567), `/gia-check` (580), `/reporte-ventas` (593), `/pistas` (605), `/afluencia` (814).

### 4.2 Cómo se controla el acceso

| Mecanismo | Qué hace | Referencia |
|---|---|---|
| Sesión de colaborador | Correo **confirmado** y (dominio en lista base —5 dominios del grupo— **o** ficha activa en `landing_colaboradores` **o** `landing_es_admin` **o** `landing_tiene_acceso`). Desactivación explícita (`activo=false`) cierra sesión. | `landing/src/lib/auth.js:222-282`, `landing/src/lib/supabase.js:43-49` |
| Entrada optimista | Si el dominio es válido pero falló la lectura de permisos, entra y se corrige luego | `landing/src/lib/auth.js:260-271` |
| Modo sin internet | Reabre con la identidad guardada si ya entró antes en línea | `landing/src/lib/auth.js:20-38`, `196-209` |
| Cierre por inactividad | 10 min sin actividad cierra sesión y manda a `/asesores` (no aplica sin internet) | `landing/src/App.jsx:107-156` |
| Broker | Dominio no permitido → `landing_broker_vincular_auth` + `landing_es_broker`; si no está activo ve "en revisión" o "no disponible" | `landing/src/lib/auth.js:284-319`, `landing/src/App.jsx:1033-1048` |
| Admin / módulos | RPCs `landing_es_admin`, `landing_es_ceo`, `landing_vitrina_activo`, `landing_vive_activo`, `landing_intelligence_acceso`, `landing_puede_gestionar_inventario` | `landing/src/lib/auth.js:126-170` |
| Panel `/asesores` | Su propio candado: `landing_acceso` activo, admin o colaborador activo; login exige dominio del grupo en el cliente | `landing/src/pages/Asesores.jsx:22-48`, `92` |
| Ligas con token | RPC `security definer` que valida el token; token inválido o revocado responde igual que inexistente | p. ej. `landing/supabase/broker_selecciones_2026-10-26.sql:59-79`, `ligas_cliente_1_base_2026-09-03.sql:12-16` |
| Re-consentimiento legal | Usuarios existentes aceptan los legales vigentes al volver | `landing/src/App.jsx:919-921` |

Las pantallas ocultan opciones en el navegador; **la protección real de datos depende de las políticas RLS en Supabase**, que no se pudieron comprobar en la base de producción.

### 4.3 Recorrido por perfil (ver · editar · compartir · generar)

**Visitante / prospecto.** *Ve:* home pública, fichas y presentaciones compartidas. *Edita:* nada. *Comparte:* reenvía la liga (en `/c/:token` eso queda registrado: varios correos distintos = "circuló", `ligas_cliente_2_acceso_2026-09-03.sql:6-8`). *Genera:* un lead al dejar datos. *No puede:* entrar a `/inventario`, `/nosotros` ni `/legal` (están dentro del shell privado y lo mandan al login).

**Asesor (colaborador interno).** *Ve:* Inicio, Macrolotes, Inventario, Mercado, Mis clientes (`/asesores?tab=crm`), Opcionar, campanita, búsqueda global, favoritos, GG-IA. *Edita:* su cartera y bitácora (`landing/src/lib/crm.js:15-36`, handlers `alta_cliente`, `update_cliente`). *Comparte:* fichas, `/c/:token`, `/alta/:asesorId`, `/captura`. *Genera:* ligas de presentación, acuerdo de comisión (`/acuerdo`). *No puede:* las ~40 pestañas marcadas `esAdmin` (`landing/src/components/PanelAsesor.jsx:608-700`), Vitrina/Vive si no se habilitaron.

**Administrador / Dirección.** Todo lo anterior más: gestión de brokers (`brokers`), solicitudes de cotización de broker, ligas cliente, leads de vendedores (`vender`), compradores (`compradores`), HubSpot (`hubspot`, `conciliacion`), contactos (`contactos`), colecciones, salud, gobernanza · `landing/src/components/PanelAsesor.jsx:651-700`.

**Broker externo activo.** *Ve:* solo el inventario asignado (desarrollos, lotes o usos de su allowlist), con fichas, ubicación y precio de lista (`landing/src/pages/BrokerPortal.jsx:526-528`); su actividad, sus solicitudes con estado y su estado de cuenta. *Edita:* su cartera de clientes, gasto por campaña, alta de terrenos (entran a revisión del admin). *Comparte:* ficha técnica con su folio "Compartido por … vía Grupo Guía" (`landing/src/components/FichaLote.jsx:67-71`), selección `/b/:token`, liga de campaña `?brk=`. *Genera:* solicitudes de cotización. *No puede:* ver directorio interno, Academia interna, `/asesores`, onboarding ni GG-IA del equipo (`landing/src/App.jsx:966-995`).

**Pregunta especial — página del broker y qué pasa al pedir información**

*Lo que el código demuestra:*
1. **Selección para su cliente (`/b/:token`).** El broker elige hasta 30 terrenos y crea la selección (`broker_sel_crear`, solo broker activo) · `landing/supabase/broker_selecciones_2026-10-26.sql:32-56`. El cliente abre la liga sin cuenta y ve: saludo con su nombre, título, mensaje, tarjetas y ficha de cada terreno, "seleccionados por <broker · empresa>" · `landing/src/pages/SeleccionBroker.jsx:45-89`. Cada apertura suma `accesos` (`…sql:64`); el broker ve el conteo en su lista (`broker_sel_listar`, `…sql:82-90`) y puede desactivar la liga (`…sql:93-102`).
2. **Cuando el cliente del broker se interesa** en `/b/:token`, el único botón es **"Contactar por WhatsApp" al teléfono del broker** con un mensaje precargado (`SeleccionBroker.jsx:77-85`). **No se captura lead, no se notifica a Grupo Guía y no se registra el interés**; solo queda el contador de aperturas. El botón "Ver todo el inventario" lleva a `/inventario`, que sin sesión manda al login (`SeleccionBroker.jsx:54`; `App.jsx:901-905`).
3. **Cuando el broker solicita cotización** (botón "Solicitar cotización" en la ficha o en el modal del portal): la RPC `landing_broker_solicitar_cotizacion` exige cliente, valida que el lote esté en su allowlist, calcula el vencimiento del compromiso, asigna `asesor_asignado` desde `landing_config.cotizacion_asesor_email` y registra la actividad · `landing/supabase/broker_cotizacion_asignacion_2026-08-21.sql:11-31`. Después el navegador llama `notificar-cotizacion`, que manda **un correo vía Resend al responsable fijo** (`landing_config.cotizacion_responsable_email`; nunca a una dirección del navegador) · `landing/netlify/functions/notificar-cotizacion.js:1-69`. **[Probada en local con datos ficticios]**: con responsable configurado envía 1 correo con terreno y cliente; sin responsable no envía (`sin-responsable`); sin sesión válida → 401. Hallazgo: desde el modal del portal no se manda `broker_nombre` (`BrokerPortal.jsx:1899-1902`) y el correo dice "un broker solicitó…"; desde la ficha sí se manda (`FichaLote.jsx:86`).
4. **Canal de atención del equipo:** el admin ve las solicitudes en `/asesores?tab=brokers` y las marca "atendida" (`landing/src/components/GestionBrokers.jsx:851`); eso sella `respondida_at` para medir el tiempo (`landing/supabase/broker_sla.sql:84-92`). El broker ve "pendiente/atendida" y si se cumplió el compromiso en **Mi actividad** (`BrokerPortal.jsx:2039-2125`).
5. **Escalamiento:** cron cada hora (`broker-sla-cron.js:7`) → `broker-sla-escalar` marca vencidas, crea campanita y correo al gerente de escalamiento y al responsable (o a los admins si no hay nadie) · `landing/netlify/functions/broker-sla-escalar.js:40-110`. **[Probada en local con datos ficticios]**: con el compromiso **inactivo** no escala nada; activo con 2 vencidas → marca `escalada_at`, 1 campanita y correo a 2 destinatarios; sin secreto → 401. El compromiso viene **apagado por defecto** (`broker_sla.sql:15`, `activo default false`).
6. **Copiloto del broker:** asistente de IA por `broker-ia`, con identidad por token (`landing/src/lib/brokers.js:238-250`). Es IA; no reemplaza la cotización.

*Lo que el equipo debe confirmar:* quién es hoy el responsable configurado y si el correo está activo; **por qué canal se entrega el precio al broker** (el código solo dice "Grupo Guía preparará el precio para tu cliente y te lo hará llegar", `BrokerPortal.jsx:1915`; no hay envío automático); si `asesor_asignado` recibe algún aviso (el código no lo avisa); si el compromiso de respuesta se encendió y con qué horario; y si se quiere que el interés en `/b/:token` llegue también a Grupo Guía.

**Propietario / opcionador.** *Ve:* su propuesta y su expediente. *Edita:* sube documentos, acepta o rechaza. *Comparte:* no aplica. *No puede:* ver otros expedientes (depende del token/id y RLS).

**Comprador (marketplace).** *Ve:* inventario dosificado y alertas. *Edita:* su petición y favoritos. *No puede:* ver precio exacto ni ubicación precisa.

**Comprador de carta oferta.** *Ve:* su carta (la otra parte confidencial), su expediente. *Edita:* firma o contrapropone; sube documentos. *Comparte:* `/expediente-compra/:token` de solo lectura con banco o notario.

---

## 5. Reparto de tareas

| Tarea | Usuario | Equipo (humano) | Automático | IA |
|---|---|---|---|---|
| Dejar datos en liga/formulario | Prospecto, dueño, broker | — | Guarda y avisa (campanita/correo) | — |
| Dar seguimiento a un lead de liga | — | Asesor contacta y registra en bitácora | Recordatorio diario si no hay bitácora | — |
| Responder cotización de broker | — | Responsable prepara precio y marca "atendida" | Correo inmediato y escalamiento horario (si activo) | — |
| Priorizar vendedores | — | Equipo llama (según manual) | Cruce tentativo contra compradores | — |
| Aprobar brokers | — | Admin mueve el embudo y asigna inventario | Log de cambios de estado | — |
| Atribuir leads de campaña | — | Marketing etiqueta campañas | `lead_origen` y ruteo a broker (con el límite de §3.1) | — |
| Responder preguntas del broker | Broker | — | — | Copiloto (`broker-ia`) |
| Asistente del equipo | Asesor | — | — | GG-IA (otro documento) |

**Política operativa que debe confirmarse y por quién**
- Horario y horas del compromiso con brokers, responsable y gerente de escalamiento → **Dirección comercial**.
- Canal y plantilla para entregar cotizaciones al broker → **Coordinación de brokers**.
- Quién atiende `prospectos_macrolotes` (`/opcionar-macrolote`) → **Dirección comercial / Captación**.
- Exclusividad de 90 días para leads de campaña de broker y esquema de comisión del broker (pendiente B2 en `landing/DECISIONES_PENDIENTES.md:47-51`) → **Dirección + Legal**.
- Qué Términos ven sellers, brokers y compradores (ver contradicción 1) → **Legal**.

---

## 6. Dependencias y conexiones

Solo nombres de variables; **no se verificó que tengan valor** en Netlify ni que el SQL esté corrido.

| Conexión | Qué se intercambia | Disparador | Quién lo ve | Si no está disponible | Referencia |
|---|---|---|---|---|---|
| Supabase (auth, tablas, RPC, storage) | Sesiones, inventario por vistas `v_landing_*`, ligas, leads, notificaciones, documentos | Cada pantalla | Según rol/RLS | Sin config la app no bloquea a nadie (`sinConfig`) y `/asesores` muestra "configura Supabase" | `landing/src/App.jsx:877-892`, `landing/src/pages/Asesores.jsx:155-175` |
| Netlify Functions | Avisos, intake, ligas, correos | Navegador, MacroPro o cron | Interno | Los avisos son "best-effort": el registro principal queda aunque falle el aviso | p. ej. `notificar-cotizacion.js:1-6` |
| Resend (correo) | Avisos a responsable, asesores, compradores, vendedores, propietarios | Eventos y crons | Destinatario resuelto en servidor | Inerte sin `RESEND_API_KEY` | `notificar-cotizacion.js:9`, `liga-interes-aviso.js:16` |
| Web Push | Avisos al celular | Liga abierta, recordatorios | Asesor suscrito | Sin VAPID solo queda la campanita | `landing/netlify/lib/push.mjs:4-12` |
| WhatsApp Cloud API | Avisos al admin (firma de carta oferta, SLA de expedientes) con plantilla y respaldo en texto | Trigger `pg_net` o cron | Admin | Sin token no envía | `landing/netlify/functions/carta-oferta-wa-admin.js:1-14`, `landing/netlify/lib/wa-admin.mjs` |
| WhatsApp por liga `wa.me` | Abre chat; no pasa por servidor ni queda registro del mensaje | Clic del usuario | Quien recibe el chat | Sin número configurado el botón no aparece | `SeleccionBroker.jsx:80-85`, `VitrinaFicha.jsx:139-145` |
| HubSpot | Forms (home, `/alta`, `/captura`); Contacts API (`hubspot-contacto`); lectura de contactos a `landing_leads` cada 15 min (`hubspot-sync`); deals cada 15 min | Envío de formulario o cron | Admin (pestañas `hubspot`, `contactos`) | Sin token: `{skipped:true}` y el alta sigue | `landing/src/lib/hubspot.js:123-139`, `269-285`, `hubspot-sync.js:1-22`, `hubspot-deals-sync-cron.js:13` |
| MacroPro (mismo proyecto Supabase) | Landing→MacroPro: trigger `trg_landing_push` empuja `landing_clientes` con correo o teléfono. MacroPro→Landing: `sync-macropro-cron` cada 15 min. MacroPro arma ligas a `/aceptar`, `/rechazar`, `/expediente`, `/oferta`, `/acuerdo`, `/terminos`, `/opcionadores`, `/asesores` y llama funciones de la Landing | Trigger, cron o botón en MacroPro | Asesor/admin | Sin service key el cron no hace nada | `landing/supabase/fix_no_push_anonimos.sql:1-25`, `landing/netlify/functions/sync-macropro-cron.js:1-15`, `macropro/index.html:1470`, `2891`, `3055`, `3180`, `17514`, `18232-18233`, `18307`, `18683`, `21888` |

**¿Los leads llegan a HubSpot o MacroPro?** (pregunta especial)
- Interés en `/c/:token` → `landing_clientes` → **MacroPro** por trigger (si trae correo o teléfono). Llegada a HubSpot desde ese camino: [No verificada].
- `/alta/:asesorId` y `/captura` → cartera + **HubSpot** (Forms y/o Contacts API, según configuración).
- Home pública → **HubSpot Forms** solo si el build tiene las variables; si no, correo del visitante. Nada en Supabase.
- `/vender` → `landing_leads_seller` (bandeja admin). Sin evidencia de HubSpot.
- `/opcionar-macrolote` → `prospectos_macrolotes`. **Ni HubSpot, ni MacroPro, ni aviso.**
- `/q/:token` interés → **solo campanita**.
- `/b/:token` → **nada**; WhatsApp directo al broker.
- Solicitud de cotización de broker → `solicitudes_cotizacion_broker` + correo al responsable. Sin evidencia de HubSpot.

---

## 7. Ejemplos de uso (DATOS FICTICIOS)

> Todos los nombres, correos, teléfonos y claves de este apartado son **inventados**.

**Ejemplo 1 · Broker con cliente interesado.** "Inmobiliaria Ejemplo" (broker activo con allowlist del desarrollo ficticio "Bosque Demo") arma una selección con los terrenos `zz-001` y `zz-002` para "Cliente Ficticio A" y copia la liga `/b/<token>`. El cliente la abre: ve "Hola Cliente Ficticio A 👋", las dos fichas y "seleccionados por Broker Demo · Inmobiliaria Ejemplo"; el contador de accesos sube a 1. Toca "Contactar por WhatsApp" y se abre un chat **con el broker**, no con Grupo Guía. El broker entra a su portal, abre la ficha `zz-001` y pulsa "Solicitar cotización" con "Cliente Ficticio A · 33 0000 0000". Queda una solicitud *pendiente* y, si el responsable está configurado, le llega un correo "Nueva solicitud de cotización · zz-001". Si el compromiso está activo (p. ej. 4 h hábiles) y nadie la marca atendida, el cron de la siguiente hora avisa al gerente. Cuando el responsable la marca "atendida", el broker lo ve en *Mi actividad* con "a tiempo" o "fuera de tiempo". La entrega del precio al broker ocurre **fuera del sistema** (canal por confirmar).

**Ejemplo 2 · Liga de presentación del asesor.** La asesora ficticia "Asesora Uno" crea en la pestaña de ligas una presentación del desarrollo "Bosque Demo" para "Prospecto Ficticio SA". Una hora después el prospecto la abre: se registra la portada y la asesora recibe "👀 Abrieron tu liga" (y push si lo activó). El prospecto ve ubicación y plano, y al final deja "Persona Ficticia · persona@ejemplo.test · 3300000000" en "Quiero más información". Resultado: alta en la cartera de la asesora con origen `interes_liga`, campanita "★ Interés…", correo "Te dejaron datos en tu presentación" y empuje del cliente a MacroPro. Si al día siguiente no hay nota en la bitácora, llega el recordatorio diario.

**Ejemplo 3 · Dos puertas para dueños de terreno.** "Propietario Ficticio" llena `/vender` con "Ciudad Ficticia, 25,000 m², uso mixto": queda en *Terrenos por vender* con una prioridad calculada contra compradores; el admin puede copiarle la liga `/mi-terreno/<token>`. Otro dueño llena `/opcionar-macrolote` con "2.5 ha": se guarda en `prospectos_macrolotes` y ve "éxito", pero **nadie recibe aviso** y no hay pantalla que lo muestre (comportamiento comprobado en local con red simulada). Recomendación: usar `/vender` mientras se define quién atiende la segunda tabla.

---

## 8. Traducción a ventas por perfil

| Perfil | Beneficio respaldado por código | Frase utilizable | Requiere confirmación antes de prometer |
|---|---|---|---|
| Asesor (interno) | Sabe cuándo abren su liga y quién deja datos; el lead entra solo a su cartera | "Te avisamos cuando tu cliente abre la presentación y cuando pide información." | Que push y correo estén configurados; no es tiempo real (campanita cada 90 s) |
| Broker (prospecto a broker) | Inventario asignado con fichas y precio de lista; selección con su nombre; ficha con folio propio; registro de clientes con protección | "Compartes una selección con tu nombre y tu cliente te contacta a ti." · "Registras a tu cliente y queda protegido frente a duplicados." | Tiempo de respuesta ("4 horas hábiles" solo si el compromiso está activo); 90 días de exclusividad; comisión estimada (pendiente B2) |
| Propietario / vendedor | Alta sin cuenta; expediente en línea; panel de su terreno | "Subes tus documentos desde una liga, sin crear cuenta." | Plazos de respuesta del equipo; que alguien atienda `/opcionar-macrolote` |
| Comprador marketplace | Alertas por correo de terrenos nuevos que cumplen lo que busca | "Te avisamos por correo cuando entra un terreno que coincide." | Que el cron y Resend estén activos; no hay WhatsApp para compradores |
| Comprador de carta oferta | Firma en línea con registro de fecha, hora e IP; confidencialidad entre partes | "Firmas desde tu celular y la otra parte no ve tus datos." | Validez legal de la firma electrónica → Legal |

**Uso interno vs. frente al prospecto.** Para prospectos usar solo lo que el prospecto vive (ligas, formularios, firma, alertas). No mencionar en ventas: hashes de IP, conteo de aperturas, cruce contra compradores, prioridad interna ni exclusividad, salvo que Dirección/Legal lo autoricen. No prometer atención 24/7, tiempos de respuesta, cumplimiento legal ni integraciones "conectadas" sin confirmar la configuración.

---

## 9. Contradicciones detectadas y pendientes

### 9.1 Contradicciones código / documentos / interfaz
1. **`/terminos` duplicado:** el bloque `startsWith('/terminos')` (`landing/src/App.jsx:409-418`, Términos del opcionador) va antes que `DocLegal slug="terminos"` (`614-618`), que nunca se alcanza. Las casillas legales de seller, broker y comprador apuntan a `/terminos` (`landing/src/components/CasillasLegales.jsx:13-28`, `61`).
2. **Tiempo de inactividad:** los comentarios dicen 15 min (`App.jsx:82`) y "ventana de 5 min" (`119`); el código aplica 10 min (`109`).
3. **Atribución `?brk=` para anónimos:** la liga de campaña del broker (`BrokerPortal.jsx:1954-1955`) depende de `capturarOrigen`, que solo corre en el shell autenticado (`App.jsx:917`).
4. **Correo de cotización sin nombre del broker** desde el modal del portal (`BrokerPortal.jsx:1901`) vs. la ficha (`FichaLote.jsx:86`). Comprobado en local.
5. **HubSpot de la home** sin valores por defecto (`ContactoPublico.jsx:6-7`) vs. valores por defecto en `landing/src/lib/hubspot.js:17-19`.
6. **WhatsApp:** `landing/MANUAL_MARKETPLACE.md` §5 dice que WhatsApp es "fase posterior"; el código ya integra WhatsApp Cloud API para avisos al admin.
7. **"Ver todo el inventario"** en `/b/:token` lleva a una página privada; el cliente del broker cae en el login.
8. **Esquema 60/40 vs 40/60:** la Landing usa "60/40" (`MiPortal.jsx:2`, `AltaTerreno.jsx:5`); el texto de GG-IA describe "40/60" con el mismo reparto (`landing/netlify/functions/whatsapp.js:586`).
9. **Horario hábil del compromiso con brokers:** `broker_sla_vencimiento` usa `extract(hour from timestamptz)`, que depende de la zona horaria de la sesión de la base (`broker_sla.sql:43-64`); si es UTC, "9 a 18" no corresponde a la hora de México.

### 9.2 Pendientes y a quién preguntar

| # | Pendiente | Rol a consultar |
|---|---|---|
| 1 | Verificar en producción qué variables existen (Resend, HubSpot Forms y token, VAPID, WhatsApp, `CRM_CRON_SECRET`, service key) y que los crons estén registrados | Administrador de plataforma / TI |
| 2 | Confirmar que el SQL citado (ligas, broker SLA, lead_broker, cotización asignada) está corrido y que RLS protege lo que la UI oculta | Administrador de plataforma / TI |
| 3 | Definir quién atiende `prospectos_macrolotes` o retirar `/opcionar-macrolote` en favor de `/vender` | Dirección comercial |
| 4 | Canal oficial para entregar la cotización al broker y si `asesor_asignado` debe recibir aviso | Coordinación de brokers |
| 5 | Encender o no el compromiso de respuesta al broker; horas, responsable, gerente y zona horaria | Dirección comercial + TI |
| 6 | ¿Debe llegar a Grupo Guía el interés de un cliente en `/b/:token`? | Dirección comercial |
| 7 | Corregir la captura de origen para visitantes anónimos (`?brk=`, UTM) antes de usar "Mis campañas" o costo por lead | Marketing + TI |
| 8 | Qué texto legal aplica a sellers, brokers y compradores (`/terminos`) y validez de firmas en acuerdo y carta oferta | Legal |
| 9 | Aviso al admin cuando llega una solicitud de alta de broker (hoy no hay) y resguardo de datos bancarios e INE | Coordinación de brokers + Legal |
| 10 | Si el interés en `/q/:token` debe guardarse como lead (hoy solo es campanita) | Dirección comercial |
| 11 | Esquema y porcentaje de comisión del broker (B2) y exclusividad de 90 días | Dirección + Legal |
| 12 | Si `/nosotros` y `/legal` deben ser públicas | Marketing |
