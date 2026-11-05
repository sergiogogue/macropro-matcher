# 🔎 Diagnóstico de Estado Actual — Pre "Liga Mágica" / "Expediente Legal"

**Fecha:** 2026-11-05 · **Repo:** `macropro-matcher` · **Rama:** `claude/wizardly-cerf-QhtU1`
**Modo:** auditoría (sin programar nada).

> ⚠️ **Límite de esta auditoría:** desde esta sesión **no tengo acceso directo a la base de Supabase**
> (sin CLI, sin credenciales de DB, egress bloqueado). La estructura de `captaciones` la reporto desde
> el **contrato autoritativo del código** (`filaDeCaptacion` / `captacionDeFila`, que es lo que la app
> lee/escribe 1:1 contra la tabla) **más** las 7 columnas que ya verificamos vía tu query. Donde infiero
> un tipo, lo marco. Para la estructura 100% exacta, corre el `select` de la sección 2.4 en Supabase.

---

## 1. Estado de `ViewCaptacion` (el Wizard actual)

- **Componente:** `ViewCaptacion` (`index.html:15582`), montado con `view==="captacion"` (`index.html:18587`).
  El formulario real es el **modal de alta/edición** (`showCaptacionModal && editingCaptacion`, `index.html:18603`),
  con estado `f = editingCaptacion` y `setF()`.

### 1.1 Campos del formulario (todos sobre `editingCaptacion`)
| Grupo | Campos |
|---|---|
| Seguimiento | `pipeline` (de `CAPTACION_PIPELINE`), `viabilidad` (🟢/🟡/🔴, de `VIABILIDAD_CAPTACION`) |
| Propietario/contacto | `propietario`, `contacto`, `telefono`, `email`, `asesorResponsableGG` |
| Ubicación | `estado`, `ciudad`, `zona`, `ubicacion`, `ligaMaps` (valida `https://`) |
| Características | `usoSuelo` (de `USOS_SUELO_OPCIONES`), `superficie`, `frente`, `poligono` |
| Comercial | `precioDueno`, `precioM2` (**auto**: precioDueno÷superficie), `comision` (texto libre, ej "5%"), `tipoAcuerdo`, `vigencia` |
| **Autorización (solo admin)** | `precioAutorizado`, `precioAutorizado/m²` (auto), `observacionesAutorizacion` |
| Responder al asesor | bitácora `respuestas[]` (dictámenes/comentarios enviados por WhatsApp/Email) |
| **Quality Gate (Back-Office)** | `esquema_comision` (radio **100/0 · 40/60**), `acepta_privacidad`, `acepta_responsabilidad`, `viabilidad_100` (checkboxes), `firma_nombre` + `firma_fecha` (se graba sola al teclear) |
| Documentos | `documentos` (texto libre), `documentosUrls[]` (jsonb, checklist con subida real), `notas` |

### 1.2 Subida de documentos al bucket `captaciones-docs`
- **Sube** con `window.sb.storage.from("captaciones-docs").upload(path, file, {upsert:true})` (`index.html:15529`);
  obtiene URL con `getPublicUrl` (`15531`); **borra** con `.remove([...])` (`15545`, `15552`).
- Cada documento se guarda en el jsonb **`documentos_urls`** como `{tipo, url, path, ...}` (se reutiliza el
  mismo bucket que el **dictamen PDF**, que se sube en `subirYGuardarDictamen` → `index.html:15431`).
- **Requiere SQL de Storage** (ambos ya existen en el repo): `sql/captaciones_docs_storage.sql` (crea bucket + políticas)
  y `sql/captaciones_docs_auth_upload.sql` (subida para logueados). Si faltan, la subida avisa y degrada (`index.html:15438`, `15540`).
- Tipos requeridos (`DOCS_REQUERIDOS`, `index.html:15452`): **Fotos (mín 4)**, Certificado de uso de suelo, Plano, **KMZ**, Boleta registral/predial.

### 1.3 Lógica de semáforo / validación de documentos — **SÍ tiene, en 3 capas**
1. **Semáforo de viabilidad (manual):** `viabilidad` 🟢/🟡/🔴 que elige el usuario; alimenta el dictamen y reportes
   (`viabInfo`, `index.html:15376`; reporte `ReporteSemaforo`).
2. **Semáforo de documentos (automático):** `estadoDocsCaptacion(f)` → `{listo, completas, total, faltan}` sobre
   `DOCS_REQUERIDOS`; banner "✅ Listo para analizar / 📥 Documentos n/total" (`index.html:18801`).
3. **Gate de publicación (automático):** `listoParaPublicar(c)` (`index.html:15462`) exige **4 Fotos + Uso de suelo +
   Plano + KMZ + liga Maps (https) + `firma_nombre`**. (La boleta/predial **no** bloquea publicar.)

---

## 2. Estado de la Base de Datos (Supabase)

### 2.1 Estructura de `captaciones` (contrato del código — ver caveat arriba)
De `filaDeCaptacion` (`index.html:2487`) / `captacionDeFila` (`index.html:2468`):

| Columna | Tipo (confirmado/inferido) |
|---|---|
| `id` | (PK, clave `onConflict`) |
| `pipeline` | text |
| `fecha_creacion`, `fecha_ultima_actividad` | timestamptz (inferido) |
| `asesor_responsable_gg` | text |
| `propietario`, `contacto`, `telefono`, `email` | text |
| `estado`, `ciudad`, `zona`, `ubicacion`, `liga_maps` | text |
| `uso_suelo`, `poligono` | text |
| `superficie`, `frente`, `precio_dueno`, `precio_m2`, `precio_autorizado` | numeric (inferido) |
| `tipo_acuerdo`, `comision`, `vigencia`, `viabilidad`, `observaciones_autorizacion`, `documentos`, `notas` | text |
| `documentos_urls`, `respuestas` | jsonb |
| `lote_inventario_id` | text |
| **`esquema_comision`** | **text** ✅ |
| **`acepta_privacidad`, `acepta_responsabilidad`, `viabilidad_100`** | **boolean** ✅ |
| **`firma_nombre`** | **text** ✅ · **`firma_fecha`** **timestamptz** ✅ · **`firma_ip`** **text** ✅ |
| `eliminado` | boolean |
| `updated_at` | timestamptz |

SQL base de la tabla: `sql/captaciones.sql`; extensiones: `captaciones_autorizacion.sql`,
`captaciones_respuestas.sql`, `captaciones_backoffice_columns.sql` (las 7 nuevas), `captaciones_form_publico.sql`.

### 2.2 Columnas ya creadas reutilizables (comisiones / firmas / tokens)
- **Comisiones:** `esquema_comision` (100/0·40/60) + `comision` (texto). ✅ Reutilizables tal cual.
- **Firmas:** `firma_nombre` ✅, `firma_fecha` ✅. ⚠️ **`firma_ip` existe pero NUNCA se llena** — no hay captura
  de IP en el código (es client-side). Es un campo "muerto" hoy: o se cablea server-side (Edge Function) o se deja.
- **Tokens:** **NO hay columna de token** en `captaciones`. El formulario público (`captar.html`) inserta por
  **RLS anónimo** (`captaciones_form_publico.sql`: policy `captaciones_anon_insert`), no por token por-registro.
  → Para "Liga Mágica" (link único por dueño/captación) **habría que agregar** algo tipo `liga_token uuid` +
  política RLS por token (aditivo).

### 2.3 Tablas para seguimiento legal o de dueños
- **No existe una tabla dedicada** de expediente legal ni de dueños. Hoy:
  - Datos del dueño → columnas de `captaciones` (`propietario`, `contacto`, `telefono`, `email`).
  - Seguimiento/bitácora → `captaciones.respuestas` (jsonb) + `documentos_urls` (jsonb).
  - (`crm_lotes` tiene `dev_feedback` / `seguimientos_asesor`, pero es de **lotes de inventario**, no de captaciones.)
- → Para **"Expediente Legal"** no hay esquema aún: es **terreno limpio** (habrá que crear tabla(s), aditivo).

### 2.4 Query para la estructura EXACTA (córrela tú en Supabase)
```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='captaciones'
order by ordinal_position;
```

---

## 3. Estado de los cambios de ayer

### 3.1 Kanban (`ViewCRM`) y Metas (`ViewMetas`) — removidos de la UI sin romper nada ✅
- El **array del menú** (`index.html:18535`) ya **NO** incluye `crm`, `metas` ni `ejecutivo`
  (comentario explicativo en `18533`).
- Los **componentes y sus renders siguen montados**: `view==="crm"` (`18562`), `view==="ejecutivo"` (`18564-18576`),
  `view==="metas"` (`18577`). Solo se ocultaron del menú → **reversible** re-agregando la entrada. **Nada se borró.**
- **Validación:** `node scripts/validate.js` ✅ y `node scripts/mount.js` → **exit 0** (monta sin crash).
  El monolito **no se rompió**.

### 3.2 Edge Function `api-matching`
- **Código presente y commiteado**: `supabase/functions/api-matching/index.ts` (commit `2761ee3`).
- **Lógica verificada** (prueba aislada): Top-5, orden desc, score 0-100, excluye descalificados, fuzzy ZMG → **PASA**.
- **Despliegue:** lo desplegaste tú desde el **dashboard de Supabase**. ⚠️ **No puedo verificarlo remotamente**
  desde esta sesión (egress a Supabase bloqueado). **Acción de confirmación:** que `api-matching` aparezca en
  Edge Functions → Functions, junto a `denue-entorno` y `sync-hubspot-deals`.

---

## 4. Riesgos detectados

### 4.1 Escrituras a `lotes` / `vitrina_propiedades`
- **`MP_READONLY_SHARED = true`** (`index.html:204`) neutraliza TODAS las escrituras a tablas compartidas:
  `lotes` (`651`), `clientes` (`688`, `2196`), `inventario_full` (`3043`, `3250`), `desarrollos` (`3302`, `5973`),
  `landing_clientes` (`5836`). → **Sin conflicto con `lotes`** (están bloqueadas por diseño). ✅
- ⚠️ **EXCEPCIÓN:** el `insert` a **`vitrina_propiedades`** de `aprobarYPublicar` (`index.html:15505`) **NO está
  gateado** por ese flag. Es intencional (el Back-Office debe publicar), **pero**:
  - La `vitrina_propiedades` es tabla "de la Landing" (el CLAUDE.md dice que la Landing es la única que escribe lo
    compartido). Esto es **la única escritura de MacroPro a una tabla compartida que se salta el candado** →
    tenerlo consciente para no reintroducir el patrón en otras tablas.
  - Usa **`INSERT`** (no upsert) y la marca `publicadoVitrina:true` es **solo local** (no hay restricción única en DB).
    **RIESGO: doble publicación = filas duplicadas en vitrina.** Recomendación: antes del insert, verificar si ya
    existe (por `folio`/captación) o poner índice único por `folio`/origen.

### 4.2 Código duplicado / "muerto" que podría estorbar para Liga Mágica / Expediente Legal
- 🟢 **Base reutilizable (NO es código muerto):** ya existe un **formulario público** (`captar.html` +
  `sql/captaciones_form_publico.sql` con RLS `anon insert`). Es el **cimiento natural de "Liga Mágica"**:
  reutiliza el patrón de inserción pública en vez de inventar uno nuevo. (También hay `solicitudes_form_publico.sql`
  y `buscar.html`, `hub.html`, `admin.html`, `intelligence.html` como entry points.)
- 🟡 **Vistas congeladas:** `ViewCRM`, `ViewMetas`, `ViewEjecutivo` quedan montadas pero sin acceso desde el menú.
  No son "muertas" (reversibles), pero **no construyas encima de ellas**: están en pausa y migran a Landing/Intelligence.
- 🟡 **`firma_ip`:** columna existe, nunca se llena → decide si la cableas (server-side) o la ignoras.
- 🟢 **Sin choque de nombres:** **no existe** código previo de "liga mágica" ni "expediente legal" en el monolito
  (grep limpio). Terreno limpio → menos riesgo de colisión.
- 🟡 **Enum `vitrina_estatus`:** `'publicado'` NO existe; se publica con `disponible` + `nivel_ficha='en_vitrina'`.
  Cualquier flujo nuevo que escriba vitrina debe respetar los enums reales.

### 4.3 Resumen de riesgos priorizado
| # | Riesgo | Severidad | Mitigación sugerida |
|---|---|---|---|
| 1 | Doble publicación → duplicados en `vitrina_propiedades` (INSERT sin unique) | 🔴 Alta | Índice único por `folio`/origen, o check antes de insertar |
| 2 | `vitrina_propiedades` se escribe desde MacroPro saltando `MP_READONLY_SHARED` | 🟡 Media | Documentar como excepción única; no replicar el patrón |
| 3 | `firma_ip` sin poblar (firma sin sello server-side) | 🟡 Media | Capturar IP/fecha en una Edge Function al firmar |
| 4 | "Liga Mágica" sin token por-registro (hoy solo anon-insert global) | 🟡 Media | Agregar `liga_token` + RLS por token (aditivo) |
| 5 | Vistas ocultas pero montadas | 🟢 Baja | No construir encima; mantener solo como reversibles |

---

## 5. Recomendación para construir "Liga Mágica" + "Expediente Legal" sin romper nada
1. **Liga Mágica:** partir del patrón público ya existente (`captar.html` + RLS anon). Agregar, **aditivo**:
   columna `liga_token uuid default gen_random_uuid()` en `captaciones` + política RLS que permita al dueño
   (vía token en la URL) **ver/editar su propia captación** (no todas). Nada que borrar.
2. **Expediente Legal:** tabla **nueva** (p.ej. `captaciones_legal` con FK a `captaciones.id`) para documentos/estatus
   legales, en vez de sobrecargar `documentos_urls`. 100% aditivo, no toca lo existente.
3. **Antes de tocar `vitrina_propiedades`:** resolver primero el riesgo #1 (unicidad), ya que cualquier publicación
   nueva heredaría el bug de duplicados.
4. Mantener `MP_READONLY_SHARED` y **no** abrir más escrituras a tablas compartidas salvo la de vitrina ya existente.

---

*Diagnóstico generado en modo auditoría. No se modificó código ni base de datos.*
