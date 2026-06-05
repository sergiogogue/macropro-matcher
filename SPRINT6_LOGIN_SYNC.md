# Sprint 6 — Login + Sincronización automática (MacroPro)

> Paquete de trabajo para Claude Code. Léelo COMPLETO antes de ejecutar nada.
> Objetivo: 3 usuarios (Sergio, gerente, asistente) entran con su cuenta, ven todo lo
> mismo, y los datos se sincronizan solos. Hacerlo POR FASES, sin romper producción.

---

## CONTEXTO DEL PROYECTO

- **App:** MacroPro, CRM inmobiliario. Un solo `index.html` (~12,790 líneas), React 18 + Babel
  standalone (JSX en navegador), jsPDF, PDF.js, Leaflet, XLSX, cliente Supabase.
- **Cliente Supabase en el código:** se llama **`sb`** (NO `supabase`).
- **Deploy:** GitHub Pages, repo `sergiogogue/macropro-matcher`, rama `main`.
- **Fuente de la verdad:** `https://raw.githubusercontent.com/sergiogogue/macropro-matcher/main/index.html`
  (bajar con curl / git pull antes de editar; nunca usar copias viejas).
- **Versión actual:** v8.5.
- **localStorage keys:** `macropro_inventory_v1`, `macropro_clients_v1`, `macropro_crm_v1`.

## SUPABASE (verificado el 2026-06-03)

- Proyecto: **macropro** (`xugrrabebphdelgwqnwc`), org "Grupo Guia", plan **Free**, región us-east-1.
- Acceso: el dueño tiene acceso de administrador al panel. Auth requests = 0 (nadie usa login hoy).
- **Tablas (esquema public):** `asesores`, `clientes`, `cotizaciones`, `crm_lotes`, `desarrollos`,
  `lotes`, `mapeo_desarrolladores`, `metas`, `plantillas_wa`, `politicas`, `politicas_descuentos`,
  `politicas_planes`, `politicas_v1_legacy`, `politicas_versiones`, `solicitudes_asesor`.
  Backups: `_backup_desarrollos_*`, `_backup_lotes_20260505`, `lotes_backup_*`.
- **⚠ ALERTA DE SEGURIDAD:** varias tablas están **UNRESTRICTED** (RLS desactivado):
  `lotes`, `lotes_backup`, `politicas`, `politicas_descuentos`, `politicas_planes`,
  `politicas_v1_legacy`, `politicas_versiones`. Las demás son públicas vía anon key.
  Esto se cierra de forma controlada en la Fase 1.

## DECISIÓN DE PRODUCTO (importante para el diseño)

- Son **3 usuarios de confianza**. **TODOS ven y editan TODO.** NO hay permisos por territorio,
  NO hay "cada quien ve lo suyo". Esto SIMPLIFICA el RLS: solo "logueado = acceso; sin login = nada".
- No se requiere lógica de filtrado por usuario en las políticas RLS. El campo `asesor` de los
  registros sigue siendo un dato de negocio (a quién pertenece el lote/cliente), NO un control de acceso.

---

## REGLA DE ORO DE EJECUCIÓN

1. **Una fase a la vez.** Subir a producción, usar varios días, validar, y solo entonces la siguiente.
2. **Respaldo antes de cada fase** (Fase 0). Si algo falla, volver al estado exacto previo.
3. **Probar contra Supabase real ANTES de tocar producción.** Crear usuario de prueba, activar RLS,
   verificar que la app sigue leyendo/escribiendo. Si RLS se activa mal, la app deja de ver sus datos.
4. **No declarar nada "listo" sin probar el flujo real** (login real, lectura/escritura real).
5. Backup HTML + git tag + export JSON antes de editar el `index.html`.

---

## FASE 0 — Respaldo y red de seguridad (riesgo: nulo)

Antes de cualquier cambio:

1. **Export de datos** desde la app (botón "Exportar JSON") y guardarlo fechado.
2. **Backup de la base** en Supabase: Dashboard → Database → Backups, o vía SQL:
   exportar las tablas clave (`lotes`, `clientes`, `crm_lotes`, `cotizaciones`, `asesores`) a CSV.
3. **Backup del `index.html`** + `git tag v8.5-pre-sprint6`.
4. Verificar que NO haya ventana de mantenimiento de Supabase activa antes de tocar RLS.

Entregable de la fase: respaldos confirmados. Sin tocar código aún.

---

## FASE 1 — Login de los 3 usuarios (riesgo: medio, manejable)

### 1A. Crear usuarios en Supabase
Dashboard → Authentication → Users → "Add user" (x3): correo + contraseña para Sergio, gerente,
asistente. Confirmar email manualmente (o desactivar confirmación por email en Auth settings para
uso interno). Anotar los UUID que Supabase asigna a cada uno.

### 1B. Activar RLS de forma SEGURA (probar en una tabla primero)
**CRÍTICO:** activar RLS sin políticas = la tabla queda inaccesible y la app "se rompe".
Por eso: para CADA tabla, activar RLS Y crear la política en la misma operación.

Política única para todas las tablas de datos (los 3 ven todo):

```sql
-- EJEMPLO para una tabla. Repetir por cada tabla de datos.
-- Probar PRIMERO en una tabla no crítica (ej. 'metas') y verificar que la app sigue funcionando.

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_autenticados_todo" ON public.lotes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

Tablas a las que aplicar (todas las de datos):
`lotes`, `clientes`, `crm_lotes`, `cotizaciones`, `asesores`, `desarrollos`, `metas`,
`plantillas_wa`, `politicas`, `politicas_descuentos`, `politicas_planes`, `solicitudes_asesor`,
`mapeo_desarrolladores`.
(Las tablas `_backup_*` y `*_legacy` pueden quedar sin acceso público — revisar que la app NO
dependa de ellas antes de restringirlas.)

**Verificación obligatoria tras activar RLS en cada tabla:**
- Con sesión iniciada: la app lee y escribe normal.
- Sin sesión (anon): la app NO puede leer (eso es lo correcto y deseado).
- Si la app deja de leer estando logueada → la política está mal, revertir y revisar.

### 1C. Cambios en el código (`index.html`)
- Añadir una **pantalla de login** (AuthGate) que se muestre antes de la app si no hay sesión.
  Usa `sb.auth.signInWithPassword({email, password})` y `sb.auth.getSession()`.
- La llamada de datos del cliente `sb` ahora usará la sesión del usuario logueado (el anon key
  deja de dar acceso porque RLS exige `authenticated`).
- Botón de "Cerrar sesión" (`sb.auth.signOut()`).
- **Patrón seguro de hooks (lección del proyecto):** los `useState`/`useEffect` del AuthGate van
  en el cuerpo del componente (depth=1), nunca dentro de funciones helper. Validar con harness jsdom,
  no solo Babel: Babel puede pasar y el runtime crashear por scope de hooks.

### 1D. Validación de la Fase 1
- Babel 0 errores + harness jsdom (monta sin crash).
- Probar login real con un usuario de prueba contra el Supabase real.
- Confirmar: con login la app funciona igual que hoy; sin login no entra.
- Subir a producción, los 3 prueban entrar. Vivir con esto unos días.

---

## FASE 2 — Bajada automática (riesgo: bajo, solo lee)

- Quitar la dependencia del botón "Bajar de Supabase".
- En el AuthGate, tras login exitoso, cargar datos con `setInventory/setClients/setCrmData`
  directamente desde Supabase, dentro de un `useEffect` de sesión.
- **NO usar `location.reload()`** (causó loop infinito en iOS PWA antes — lección documentada).
- Mantener el botón manual como respaldo hasta confirmar que la carga automática es 100% fiable.

---

## FASE 3 — Subida automática con protección de conflictos (riesgo: el más alto)

- Quitar dependencia del botón "Migrar a nube": los cambios se guardan solos (upsert por registro).
- **Protección de conflictos obligatoria:** upsert por `id`/`clave_unica`, nunca reemplazar la base
  completa (eso es lo que hoy permite que un usuario pise a otro). Last-write-wins por registro,
  no por base entera.
- **Cuidado con NULLs:** un upsert con `email`/`clave_unica` en NULL causó duplicación masiva
  (744 clientes, 432 lotes) en un incidente previo. Validar que las claves únicas no sean NULL
  antes de subir.
- Considerar Supabase Realtime para que los cambios de uno aparezcan en los otros sin refrescar.
- Esta fase necesita simular DOS usuarios editando a la vez y verificar que nadie pierde datos.
  Es la fase que más justifica el entorno de pruebas de Claude Code.

---

## SOBRE "QUE A LOS 3 SE LES ACTUALICE" (pregunta original del dueño)

- **Código (la app):** al subir versión nueva a GitHub Pages, los 3 la reciben al refrescar el
  navegador (hard reload). En iPad/PWA puede tardar; abrir en Safari fuerza la última. Documentar
  el "cómo refrescar" para el equipo.
- **Datos:** tras Fase 2 y 3, se sincronizan solos. Mientras tanto, protocolo manual:
  "bajar al abrir, subir al cerrar, uno sube a la vez".

## PRIMER MENSAJE SUGERIDO PARA CLAUDE CODE

> Lee SPRINT6_LOGIN_SYNC.md y CLAUDE.md completos. Vamos a implementar el Sprint 6 (login + sync)
> POR FASES, empezando por Fase 0 (respaldo) y Fase 1 (login de 3 usuarios). NO ejecutes las 4 fases
> de golpe. Antes de tocar producción, probaremos login y RLS contra el Supabase real
> (proyecto xugrrabebphdelgwqnwc). Confírmame que leíste todo y dime tu plan para la Fase 1 antes
> de escribir código. Recuerda: cliente Supabase se llama `sb`, validar hooks con harness jsdom,
> y nunca activar RLS sin su política en la misma operación.

---

## BITÁCORA / ESTADO (actualizado 2026-06-03)

### ✅ Fase 0 — Respaldos
Hechos: export JSON, CSV de tablas clave, copia fechada del `index.html`
(`backups/index_v8.5_pre-sprint6_2026-06-03.html`), tag `v8.5-pre-sprint6`.

### ✅ Fase 0.5 — Limpieza de datos (no estaba planeada, surgió aquí)
La tabla `lotes` tenía **334 filas** corruptas: duplicados por *case* (`CN-001`/`cn-001`),
numeración KU vieja **sin cero** (`KU-16…38`, descartada) y un **off-by-one** en Kulkana.
Se reconcilió contra `Inventario_Macrolotes_8.6.xlsx` → **147 lotes** correctos
(CN13, CS13, GEN5, KU30, LR1, ML85). Snapshot de seguridad: `lotes_backup_merge_20260603`.
Decisión: **id canónico = minúscula**; para KU la **mayúscula con cero era la autoritativa**.

### ✅ Fase 1 — Login (DESPLEGADO en producción vía PR #1)
- `AuthGate` en `index.html` (login antes de la app + botón "Salir"); validado con Babel + jsdom
  y prueba real de login (5/5). Cliente `sb`, sin `location.reload()`, hooks con `React.useEffect`.
- **3 usuarios** creados en Supabase Auth.
- **⚠ RLS: se activó por error y se REVIRTIÓ → hoy está OFF** en las tablas de datos
  (`cotizaciones` sigue ON con sus políticas anon). Las políticas `usuarios_autenticados_todo`
  YA están definidas en todas las tablas; **solo falta reactivar con `ENABLE`** (empezar por
  `metas`, verificar, luego el resto). **No activar RLS hasta confirmar que el login lleva días
  funcionando en producción** (si no, la app anónima se rompe).

### ⏳ Pendientes (en orden)
1. **Reactivar RLS** tras unos días con login estable → cierra Fase 1.
2. **Fase 2 — bajada automática:** que `bajarDeSupabase` traiga **lotes + clientes + crm** (hoy solo
   trae crm). Esto además llena solo un equipo nuevo (p. ej. el iPad de Sergio) al iniciar sesión.
3. **Fase 3 — subida automática + OFFLINE real (pedido de Sergio):** trabajar sin conexión y que
   suba solo al reconectar; service worker cacheando la app/librerías (hoy el SW **borra caché en
   cada apertura**, así que no hay offline confiable). **Pilotar primero solo con Sergio** (reduce
   conflictos). Upsert por registro, claves no nulas.

### Notas operativas vigentes
- Otros usuarios: **verificar su inventario (147, KU bien) ANTES de "Migrar a nube"**; su
  `localStorage` puede tener datos viejos y pisar la nube.
- Pasar datos entre equipos hoy: **Exportar JSON → Importar** (porque la bajada de Supabase es
  parcial hasta la Fase 2). Protocolo manual: "uno a la vez".

---

## SINCRONIZACIÓN AUTOMÁTICA — estado y plan (2026-06-04)

### Incidente recurrente (¡importante!)
Al usar los botones **"Migrar a nube" / "Migrar TODO" / "Solo Lotes"**, los lotes se **re-duplicaron**
(147 → 294, pares `cn-001` + `CN-001`). Causa: una **subida en MAYÚSCULA** (versión VIEJA en caché de
otro equipo, o ruta de subida que no minimiza el id) choca con la nube en minúscula y duplica. Es el
**mismo bug** del incidente original de 334. Recuperado borrando las MAYÚSCULAS (anclado al Excel) → 147.

### Cimientos YA aplicados (seguros)
1. **Índice único anti-duplicados** en la base — impide físicamente duplicar por mayúscula/espacios,
   venga de la versión/usuario que venga:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS lotes_id_norm_uniq
     ON public.lotes (lower(regexp_replace(btrim(id), '\s+', '_', 'g')));
   ```
2. **`bajarDeSupabase` ahora FUSIONA (no reemplaza)** el CRM → bajar de la nube ya nunca borra lo local.

### Plan del auto-sync (por incrementos PROBADOS — es la fase de mayor riesgo)
- **Inc. 0 (hecho):** no se puede duplicar (índice) · bajar no borra (fusión).
- **Inc. 1 — sembrar la nube:** dejar lotes(147)/clientes/CRM correctos y completos en la nube.
  Pendiente: el **CRM no está subido** (`crm=4`); subirlo con **"Solo CRM"** (ya seguro con el índice).
  Verificar `clientes` (estaba en 249, confirmar que es correcto). **NO subir lotes** (ya están limpios).
- **Inc. 2 — bajada automática:** al iniciar sesión, si el equipo está vacío, baja lotes+clientes+CRM
  de la nube (equipos nuevos/iPad se llenan solos). Mapear cloud→local. Validar jsdom + probar real.
- **Inc. 3 — subida automática + Realtime:** cada cambio sube solo, **por registro** (upsert id/email/
  lote_id, claves no nulas, **id siempre en minúscula**), sin pisar a otros. Probar con 2 usuarios.

### Reglas para esta fase
- **La subida DEBE minimizar el id** (`loteKey`) siempre; idealmente **deshabilitar/blindar los botones
  manuales** ("Migrar TODO", "Solo Lotes") para evitar el footgun.
- **No activar la bajada automática** hasta confirmar que la nube está completa y correcta.
- Probar contra Supabase real + simular 2 usuarios antes de producción.

---

## BLOQUEO DETECTADO (2026-06-05): el CRM quedó desenganchado de los lotes limpios

Al intentar sembrar el CRM en la nube ("Solo CRM"), resultado:
**"0 seguimientos CRM migrados (13 omitidos — lote no encontrado en nube)"**.

**Causa:** la limpieza de lotes eliminó la numeración VIEJA de Kulkana (`ku-16…ku-38`) y dejó la
correcta (`ku-001…ku-030`). Pero el CRM local (109 prospectos en 13 lotes) **sigue apuntando a las
claves viejas** → la nube no las encuentra y omite todo. El CRM está **a salvo en local**, no se perdió.

**Pendiente antes de sembrar el CRM y activar el auto-sync:**
1. **Re-enganchar el CRM**: construir el mapeo viejo→nuevo de ids KU (por nombre/precio del lote;
   ej. `ku-16` "Mz 13 Lt 01" → `ku-024`) y reescribir las claves de `crmData` (localStorage
   `macropro_crm_v1`). Requiere ver las 13 claves reales del CRM. Fuentes para el mapeo: snapshots
   `lotes_backup_294_20260604` / `lotes_backup_merge_20260603` (tienen los lotes viejos) + el Excel 8.6.
2. Luego sí: subir CRM/clientes (con el índice ya protegiendo lotes) → nube completa.
3. Probar la **bajada automática (Inc. 2, ya en la rama)** contra Supabase real → desplegar.
4. Después, **Inc. 3** (subida automática por registro + Realtime).

**Estado del código (rama `claude/wizardly-cerf-QhtU1`, NO desplegado aún):**
- Inc. 2 listo: mapeadores `loteFromSupabase`/`clienteFromSupabase` + `bajarTodoDeSupabase()` +
  auto-llenado en equipos vacíos. Validado con jsdom + unit-test de mapeadores. Falta sembrar
  la nube (bloqueado por el re-enganche del CRM) y probar contra Supabase real antes de desplegar.

⛔ Mientras tanto: NO usar "Migrar TODO a la nube" (re-duplica). El CRM vive sano en el equipo de Sergio.
