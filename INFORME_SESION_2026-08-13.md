# Informe de sesión — MacroPro (`macropro-matcher`)

_Estado a 2026-08-13 · `main` = `a116d0e` (revert de la migración a Netlify)_

## 1. Qué es y dónde vive
- **MacroPro**: app de matching/CRM inmobiliario de Grupo Guía. **Todo en un solo `index.html`**
  (React 18 + Babel-standalone en el navegador, sin build step).
- **Deploy real: GitHub Pages** → `https://sergiogogue.github.io/macropro-matcher/`, rama `main`.
  **Pages sirve la RAÍZ del repo tal cual** (no corre `vite build`). Está **ACTIVO** (deploya en cada push a main).
- **Supabase compartido**: proyecto `xugrrabebphdelgwqnwc` (cliente se llama `sb`, key publishable en `index.html` ~línea 198).
  Lo comparten MacroPro, la Landing y MacroCotizador.
- **Arquitectura (según `hub.html`)**: son **apps separadas** con el mismo Supabase: MacroPro (matching),
  **Landing Macrolotes = `grupoguia-macrolotes.netlify.app` (OTRO repo/deploy en Netlify)**,
  Guía Intelligence (el valuador `intelligence.html`), MacroCotizador, Control de Proyectos, etc.

## 2. Trabajo terminado y en producción esta sesión (módulo Metas)
- **Columna editable "🔖 Apartados del mes"** (unidades + monto $ miles) en el Scorecard por Desarrollo;
  en **naranja** para identificarla; persistida por `AÑO-MES-desarrollo` en `localStorage` (`macropro_apartados_v1`).
  Monto con **2 decimales** (input texto, acepta coma o punto: helper `parseMonto`).
- **Tarjeta "Meta acumulada al mes"**: muestra **Vendido** + **🔖 Apartado** aparte.
- **Segundo "Scorecard al mes"** (meta acumulada Ene→mes en curso) para ver avance real vs meta al día.
- **Botón 🖨️ Imprimir / PDF** en Metas → reporte de **2 hojas**: (1) resumen + scorecard anual + scorecard al mes;
  (2) tendencia mensual + gráfica de ventas reales + KPIs. Función `imprimirReporteMetas` en `ViewMetas`.
- **Metas ahora se guardan en la nube**: al importar el Excel se sube a `app_config` clave `metas_v1`
  (`subirMetasCloud`, update-or-insert); la descarga al abrir ya existía → **no hay que re-subir el Excel**.
- (Antes en la sesión: Fase 1 catálogos `uso_interes` (10) / `tipo_comprador` (4) exactos,
  baja lógica `activo=false`, `updated_at` en cada escritura de cliente.)

## 3. Episodio Netlify — REVERTIDO (importante)
- Un doc del dev de la Landing pidió mover las páginas públicas a `public/` para servir el valuador
  "desde Netlify", **asumiendo que macropro-matcher deploya a Netlify**.
- Se hizo (PRs **#26** y **#27**, ya mergeados) + se cambiaron ligas a `grupoguia-macrolotes.netlify.app`.
- **Error de raíz**: ese dominio es **la LANDING (otra app)**, no macropro-matcher. Y como MacroPro vive en
  **github.io (sirve la raíz)**, mover a `public/` **rompió** las páginas (404).
- **Todo revertido** en `main` (commit `a116d0e`): archivos de vuelta a la **raíz**, ligas de vuelta a **github.io**.
  **Se conservó SOLO el proxy** (`/.netlify/functions/claude`, v72) en `intelligence.html`.
- **Verificado**: las 6 URLs cargan en github.io (`intelligence`, `captar`, `buscar`, `hub`, `admin` `.html` + `guia-asesores.pdf`).

## 4. Estado actual (`main = a116d0e`)
- github.io Pages **activo**; páginas públicas en la **raíz**.
- Existen `netlify.toml`, `netlify/functions/claude.js`, `vite`, `public/` — **pero NO hay sitio Netlify de
  macropro-matcher conectado** (migración en pausa).

## 5. Pendiente / decisión abierta
- **Valuador (`intelligence.html` v72)**: su IA llama al proxy `/.netlify/functions/claude` → **no corre en github.io**.
  Para activarlo hay que **montar un sitio Netlify propio para macropro-matcher**
  (Netlify → New site → import repo → usa `netlify.toml` → build `dist/`). **Decisión pendiente del usuario.**
- `github.io` restantes no urgentes: `index.html:862` (pie de los `.ics`, cosmético).
  `redirect_uri` de OAuth Drive quedó en github.io (registrado en Google Cloud; también registraron el de Netlify).

## 6. Gotchas para el próximo Claude
- **MacroPro = GitHub Pages (raíz), NO Netlify.** No mover archivos a `public/` (rompe Pages).
- **`grupoguia-macrolotes.netlify.app` = LANDING**, repo distinto. No confundir.
- **Validar con harness jsdom** (montar sin crash), no solo Babel. Harness en el scratchpad de sesión
  (`validar.js`, `mount_metas.js`).
- **Deploy flow usado**: commit en rama → `git push origin <rama>:main` → `git branch -f main origin/main`.
  Pages deploya solo en cada push a `main`.
- **Caché/PWA**: el service worker cachea; recordar **hard reload** al validar en vivo.
- Desde el entorno de Claude **no hay salida a github.io ni a Netlify** (egress bloqueado): no se pueden abrir
  las URLs en vivo; validar por repo + pedir al usuario que abra.
