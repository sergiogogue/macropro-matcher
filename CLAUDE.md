# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio. Léela completa antes de editar.

## Qué es MacroPro

CRM inmobiliario de Grupo Guía para macrolotes/desarrollos. Es un **motor de matching**
(Cliente→Lotes y Lote→Clientes) con CRM, dashboard ejecutivo, metas, mapas, búsqueda,
exportación a PDF/PPTX/iCal y sincronización con Supabase. Está construido como PWA instalable.

- **Versión actual:** v8.5.
- **Deploy:** GitHub Pages, repo `sergiogogue/macropro-matcher`, rama `main`.
- **Fuente de la verdad:** `https://raw.githubusercontent.com/sergiogogue/macropro-matcher/main/index.html`
  Bajar con `curl` / `git pull` antes de editar; nunca usar copias viejas.

## Arquitectura

- **Toda la app vive en un solo `index.html`** (~12,790 líneas). No hay build step para la app:
  React 18 + ReactDOM + **Babel standalone** transpilan el JSX en el navegador.
- Librerías por CDN: jsPDF (+ autotable), PDF.js, Leaflet, XLSX (SheetJS), pptxgenjs,
  cliente Supabase v2 (con fallback entre varios CDNs).
- `service-worker.js` para funcionamiento offline (PWA) + `manifest.json`.
- El componente raíz es `MacroProMatcher()`.

## Convenciones del proyecto (IMPORTANTE)

- **El cliente Supabase se llama `sb`** en el código, NO `supabase`.
- **localStorage keys principales:** `macropro_inventory_v1`, `macropro_clients_v1`,
  `macropro_crm_v1` (hay más con prefijo `macropro_`).
- Idioma de UI, comentarios y mensajes: **español**.

## Supabase (verificado 2026-06-03)

- Proyecto: **macropro** (`xugrrabebphdelgwqnwc`), org "Grupo Guia", plan **Free**, región us-east-1.
- **Tablas (esquema public):** `asesores`, `clientes`, `cotizaciones`, `crm_lotes`, `desarrollos`,
  `lotes`, `mapeo_desarrolladores`, `metas`, `plantillas_wa`, `politicas`, `politicas_descuentos`,
  `politicas_planes`, `politicas_v1_legacy`, `politicas_versiones`, `solicitudes_asesor`.
  Backups: `_backup_desarrollos_*`, `_backup_lotes_20260505`, `lotes_backup_*`.
- **⚠ Seguridad:** varias tablas están UNRESTRICTED (RLS desactivado). El endurecimiento de
  RLS es parte del Sprint 6 — ver `SPRINT6_LOGIN_SYNC.md`.

## Decisión de producto

- Son **3 usuarios de confianza**. **TODOS ven y editan TODO.** No hay permisos por territorio.
  El RLS solo distingue "logueado = acceso; sin login = nada". El campo `asesor` de los registros
  es un dato de negocio, NO un control de acceso.

## Reglas de edición y validación

1. **Una fase a la vez.** Subir a producción, validar varios días, y solo entonces la siguiente.
2. **Respaldo antes de tocar nada:** backup del `index.html` + `git tag` + export JSON desde la app.
3. **Probar contra Supabase real ANTES de tocar producción** (usuario de prueba, RLS, lectura/escritura).
4. **No declarar nada "listo" sin probar el flujo real.**
5. **Validar siempre con harness jsdom, no solo con Babel.** Babel puede pasar y el runtime crashear
   por scope de hooks. La app debe montar sin crash.

## Lecciones del proyecto (no repetir errores)

- **Hooks (`useState`/`useEffect`) van en el cuerpo del componente (depth=1)**, nunca dentro de
  funciones helper. El scope incorrecto de hooks crashea en runtime aunque Babel compile.
- **No usar `location.reload()`** tras login/carga: causó loop infinito en iOS PWA.
- **Upsert con cuidado de NULLs:** un upsert con `email`/`clave_unica` en NULL causó duplicación
  masiva (744 clientes, 432 lotes). Validar claves únicas no nulas antes de subir.
- **Sincronización por registro, no por base completa:** upsert por `id`/`clave_unica`
  (last-write-wins por registro), nunca reemplazar toda la tabla — eso permite que un usuario
  pise a otro.
- **ID canónico de lotes = MINÚSCULA.** `loteKey()` (≈línea 187) hace `.toLowerCase()`, así que la
  app siempre escribe ids en minúscula (`cn-001`, `ku-001`). El `id` de Postgres es sensible a
  mayúsculas → `CN-001` ≠ `cn-001` causó duplicación. **No cambiar el case sin migrar todas las
  referencias** (`crm_lotes.lote_id`, etc. apuntan a minúscula).
- **`bajarDeSupabase` (≈línea 1767) HOY solo baja el CRM (`crm_lotes`), NO lotes ni clientes.** Por
  eso un equipo nuevo no se llena solo: hay que importar el Excel (lotes) y/o JSON (clientes/CRM).
  Esto lo resuelve la Fase 2.
- **AuthGate / hooks:** en el scope global del `<script type="text/babel">` solo están
  `useState, useRef, useCallback` (≈línea 126). **`useEffect` NO está** → usar `React.useEffect`.
- **Incidente de datos resuelto 2026-06-03:** la tabla `lotes` tenía 334 filas (duplicados
  mayúscula/minúscula + numeración KU vieja sin cero + un off-by-one en Kulkana). Se reparó contra
  `Inventario_Macrolotes_8.6.xlsx` (147 lotes reales: CN13, CS13, GEN5, KU30, LR1, ML85). Snapshot:
  `lotes_backup_merge_20260603`. Fuente de verdad de lotes = ese Excel; mayúscula KU = autoritativa.

## Cómo se actualiza a los 3 usuarios

- **Código:** al subir versión a GitHub Pages, se recibe al refrescar (hard reload). En iPad/PWA
  puede tardar; abrir en Safari fuerza la última.
- **Datos:** sincronización automática tras las fases 2 y 3 del Sprint 6. Mientras tanto, protocolo
  manual: "bajar al abrir, subir al cerrar, uno sube a la vez".

## Trabajo en curso

Ver **`SPRINT6_LOGIN_SYNC.md`** — paquete de trabajo del Sprint 6 (login de 3 usuarios +
sincronización automática), a ejecutarse POR FASES.
