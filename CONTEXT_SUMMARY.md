# CONTEXT_SUMMARY — Opcionador / Portal / Kanban (Handoff)

_Fecha: 2026-11-07 · Supabase: proyecto `xugrrabebphdelgwqnwc`_

Dos sistemas (comparten el MISMO Supabase):
- **MacroPro** — `sergiogogue/macropro-matcher`, rama `main`, deploy **GitHub Pages** (https://sergiogogue.github.io/macropro-matcher/). App de un solo `index.html` (React + Babel en el navegador, sin build).
- **Landing/Plataforma** — `sergiogogue/grupoguiamacrolotes-landing`, rama `main`, deploy **Netlify** (https://macrolotes.grupoguia.mx). Vite + React Router. Versión actual **v1854** (`src/lib/version.js` + `public/sw.js`).

---

## 1) Tablas / objetos de Supabase creados

**`cotizaciones_opcionador`** (una fila = un opcionador/cotización)
- `id` uuid PK, `cliente_id`, `cliente_nombre`, `cliente_telefono`, `cliente_email`,
  `asesor_nombre`, `terreno_nombre`, `terreno_ciudad`, `terreno_dimensiones`,
  `valor_terreno` (texto con formato $), `monto_comision` (%), `condiciones`, `estatus`,
  `estatus_semaforo` (`en_revision` | `activo` | `con_ofertas` | `vendido`),
  `terminos_aceptados` bool, `terminos_aceptados_at`, `cuenta_creada` bool, `created_at`.

**`documentos_opcionador`** (control de documentos subidos por el cliente)
- `id` uuid PK, `cotizacion_id` (FK → `cotizaciones_opcionador`, ON DELETE CASCADE),
  `cliente_email`, `tipo_documento`, `nombre_archivo`, `url` (ruta en Storage),
  `subido_por`, `subido_at`. Índice único `(cotizacion_id, tipo_documento)`.
- Tipos (8): `escrituras, uso_suelo, libertad_gravamen, ine, plano, predial, ubicacion, fotos`.

**Storage**: bucket privado **`documentos-opcionador`**. Ruta: `<cotizacion_id>/<tipo>.<ext>`.

**RPCs / funciones**:
- `opcionador_bienvenida(p_id uuid)` — SECURITY DEFINER, `anon`: devuelve nombre/email/terreno para la pantalla de bienvenida pre-login.
- `opcionador_aceptar(p_id uuid)` — marca `terminos_aceptados=true` + `cuenta_creada=true`.
- `es_colaborador()` — true si el dominio del correo autenticado ∈ (grupoguia.mx, grupoguiacancun.mx, grupoguialeon.mx, grupoguiaqueretaro.mx, grupo4s.com).
- `auto_confirmar_email()` + trigger `trg_auto_confirmar` BEFORE INSERT en `auth.users` → **acceso directo sin confirmación por correo** (el enlace del PDF es la "llave").

**RLS**:
- `documentos_opcionador`: cliente ve/gestiona lo suyo (`cliente_email = auth.email()`); colaborador ve todo (`es_colaborador()`).
- `storage.objects` (bucket documentos-opcionador): cliente por cotización/correo; colaborador todo.
- `cotizaciones_opcionador`: hoy **authenticated all** (la UI filtra). **PENDIENTE endurecer** para que un cliente no lea otras cotizaciones.

> Los `.sql` se corrieron desde el SQL Editor de Supabase (estaban en el scratchpad, que es efímero). Los objetos ya están aplicados en la base.

---

## 2) Flujo / lógica del Kanban (MacroPro · vista "Opción / Captación")

- **Kanban único**: se ELIMINÓ la "Bandeja de Opcionadores" duplicada. Los opcionadores se muestran como tarjetas dentro del Kanban de Captación existente.
- **Columna inicial "📝 En Cotización"** = opcionadores con `terminos_aceptados = false`.
- **Movimiento automático**: cuando el cliente acepta (crea su cuenta en `/aceptar` → `opcionador_aceptar` pone `terminos_aceptados=true`), la tarjeta pasa a **"Nueva opción"**.
- **Indicador de documentos** en cada tarjeta: **"Docs X/8"** o **"Pendiente de documentos"** (desde `documentos_opcionador`).
- **Botón "🧱 Editar Terreno"** en la tarjeta → modal con los 8 documentos (botón "Ver" = URL firmada de Storage) + botón "Analizar en Intelligence".
- Columnas del pipeline de captación: `CAPTACION_PIPELINE` (Nueva opción, Viabilidad, Contactado / visita, En negociación, Documentación, Contrato, Firmado, Descartado) + la nueva "En Cotización" al frente (solo para opcionadores).

---

## 3) Botón "Analizar en Intelligence" (ruta)

- Abre: **`https://macrolotes.grupoguia.mx/valuador?cot=<cotizacion_id>`**.
- `/valuador` (IntelligenceDocs.jsx) es **entrada DIRECTA** cuando trae `?cot=` (se resuelve antes del shell autenticado para NO rebotar a `/inicio`).
- Carga **automáticamente** los documentos del opcionador desde Storage (hace `getSession()` antes para respetar RLS). El asesor solo da **"Pedir opinión de valor"**.
- **NO** se usa `intelligence.html` (la plataforma completa) para este flujo — por decisión del usuario. (Si se quiere a futuro, hay que hacer que `public/intelligence.html` acepte `?cot=` y jale los documentos.)

---

## 4) Portal del cliente (Landing)

- **`/aceptar?c=<cotizacion_id>`**: bienvenida (RPC `opcionador_bienvenida`) + crear contraseña (Supabase Auth, `signUp`+`signIn`). Entra directo (auto-confirm). Botón "👁 Mostrar" contraseña; inputs con fondo blanco (`colorScheme: light`).
- **`/portal`**: Ficha de Seguimiento = semáforo + checklist de 8 documentos + subir a Storage (check verde, contador X/8).
- **`/opcionadores`**: lista SIMPLE del asesor (Nombre · Estatus · Docs X/8 · "Analizar en Intelligence"). Gate por dominio de correo. (Ya NO es Kanban — el Kanban vive en MacroPro.)

---

## 5) PDF del cotizador (MacroPro · vista "🧾 Cotización")

- Deck horizontal uniforme (jsPDF): **5 láminas del pitch** (JPEG comprimido para que pese poco) → hoja **Cotización + Documentos** → **Términos y Condiciones (PROFECO)** al final, con enlace **`/aceptar?c=<id>`**.
- Comisión en **%** con monto en pesos calculado; **valor** con formato `$` y decimales.
- Marca de agua "CONFIDENCIAL · GRUPO GUÍA" centrada. `cargarImg` tiene timeout (nunca se cuelga).
- Buscador de cliente (autollena tel/email), WhatsApp preescrito, historial de cotizaciones.
- **Nota legal**: el texto PROFECO es borrador — revisar con abogado.

---

## 6) Archivos tocados

**MacroPro** (`sergiogogue/macropro-matcher`):
- `index.html` — TODO: módulo Pitch/Cotización + generación de PDF; integración de opcionadores en `ViewCaptacion` (columna "En Cotización", tarjetas con docs, modal "Editar Terreno"); se eliminó `ViewBandejaOpcionadores`; `cargarImg` con timeout + JPEG.

**Landing** (`sergiogogue/grupoguiamacrolotes-landing`):
- `src/pages/AceptarCotizacion.jsx` (nuevo)
- `src/pages/PortalOpcionador.jsx` (nuevo)
- `src/pages/Opcionadores.jsx` (nuevo → lista simple del asesor)
- `src/pages/IntelligenceDocs.jsx` (modificado: carga docs por `?cot=`)
- `src/App.jsx` (rutas `/aceptar`, `/portal`, `/opcionadores`, y `/valuador?cot=` como entrada directa)
- `src/lib/version.js` + `public/sw.js` (versión, actual **v1854**)

---

## 7) Pendientes / ideas (opcionales)

- **Seguridad**: endurecer RLS de `cotizaciones_opcionador` (hoy cualquier autenticado puede leer todas).
- **Legal**: validar el texto PROFECO del PDF con abogado.
- **"Aceptar Cotización" explícito** en el portal (hoy equivale a crear la cuenta).
- **Intelligence completo**: si se quiere, conectar `intelligence.html` (plataforma con veredicto/dossier) para que cargue los documentos del opcionador por `?cot=`.
- **Vínculo con captación real**: hoy los opcionadores son tarjetas "overlay" en el Kanban (no son filas de `captaciones`). Si se quiere que un opcionador se convierta en captación nativa, hay que definir esa conversión.

---

## 8) SQL maestro (por si hay que recrear en otro entorno)

Los scripts aplicados: columnas de `cotizaciones_opcionador` (valor_terreno, cliente_nombre/telefono/email, estatus_semaforo, terminos_aceptados*, cuenta_creada); tabla `documentos_opcionador`; bucket `documentos-opcionador`; RPCs `opcionador_bienvenida` / `opcionador_aceptar`; función `es_colaborador()`; trigger de auto-confirmación `trg_auto_confirmar`; políticas RLS (tabla + storage) usando `auth.email()`.
