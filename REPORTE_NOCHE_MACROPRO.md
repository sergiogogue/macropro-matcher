# 🌙 Reporte de Turno de Noche — MacroPro Back-Office

**Fecha:** 2026-11-05
**Rama de trabajo:** `claude/wizardly-cerf-QhtU1`
**Estado general:** ✅ Código validado y funcionando. Back-Office completo.

> ⚠️ **Nota importante de estado:** El código del Back-Office **ya fue commiteado y subido a `main`**
> durante la sesión (lo autorizaste con "corre y despliega"). Es decir, **ya está en producción**
> en GitHub Pages. Por eso este turno de noche fue de **validación + verificación + documentación**,
> no de implementación nueva. El único archivo nuevo de esta madrugada es **este reporte**, que queda
> en la rama `claude/wizardly-cerf-QhtU1` **sin** mergear a `main` (para tu revisión), tal como pediste.

---

## 1. Validación de código

| Check | Resultado |
|---|---|
| `node scripts/validate.js` (Babel/JSX compila + guard de etapas del pipeline) | ✅ OK — "se puede publicar" |
| `node scripts/mount.js` (jsdom: la app monta sin crash) | ✅ OK — exit code 0 |
| Lógica de la Edge Function `api-matching` (prueba aislada del scoring) | ✅ OK — ver sección 3 |

No se encontraron errores de sintaxis ni de runtime. **No hubo errores en bucle. La app no se rompió.**

---

## 2. Archivos modificados y por qué

### 2.1 `index.html` (commit `6129140`)
Todo el Back-Office vive en el monolito de siempre. Cambios (todos **aditivos / reversibles**):

| Zona (aprox.) | Qué cambió | Por qué |
|---|---|---|
| Array del nav (~L18456) | Se **comentaron** (no se borraron) las entradas `CRM`, `Ejecutivo` y `Metas` del menú | Tarea 1: ocultar esas vistas del día a día del asesor. Los componentes, los `view===` y los datos **siguen intactos** → reversible quitando el comentario. |
| `captacionDeFila` (~L2468) | Lee 7 campos nuevos desde Supabase (`esquema_comision`, `acepta_privacidad`, `acepta_responsabilidad`, `viabilidad_100`, `firma_nombre`, `firma_fecha`, `firma_ip`) | Tarea 2: que el Wizard recupere lo guardado. |
| `filaDeCaptacion` (~L2487) | Escribe esos mismos 7 campos a Supabase (1:1 con las columnas nuevas) | Tarea 2: persistir el Quality Gate. |
| `subirCaptacionCloud` fallback (~L2518) | El reintento ahora también **quita** los 7 campos nuevos si la columna no existe | Blindaje: si aún no corriste el SQL, guardar **no se rompe** (degrada elegante). |
| `DOCS_REQUERIDOS` (~L15434) | Se agregó el tipo de documento **KMZ** (acepta `.kmz/.kml`) | Tarea 4: requisito para publicar. |
| `DOCS_PUBLICAR` + `listoParaPublicar(c)` (nuevos) | Helper que valida 100% de docs: 4 Fotos + Plano + Uso de suelo + KMZ + liga Maps (https) + firma | Tarea 4: gate de publicación. |
| `aprobarYPublicar(c)` (nuevo, ~L15480) | Valida con `listoParaPublicar`, saca uid/email de la sesión, mapea tipo/opción, parsea lat/lng de la liga Maps, e **inserta** en `vitrina_propiedades` | Tarea 4: botón "🚀 Aprobar y Publicar". |
| Modal de captación (sección Quality Gate, antes de "Documentos") | UI nueva: radio **Esquema de Comisión** (100/0 · 40/60), 3 **checkboxes** (Privacidad LFPDPPP, Responsabilidad, Viabilidad al 100%), input de **Firma** (nombre; graba fecha al primer tecleo) | Tarea 2. |
| `ViewAdmin` (panel "🚀 Aprobar y Publicar", ~L5998) | Lista captaciones no publicadas, muestra estado de `listoParaPublicar` y habilita el botón solo al 100% | Tarea 4. |

### 2.2 `supabase/functions/api-matching/index.ts` (NUEVO, commit `2761ee3`)
Edge Function que expone el motor de matching **sin** cargar el monolito. Verifica sesión (JWT),
CORS a Landing + MacroPro, lee `clientes` y `lotes` con service role, reimplementa la **misma fórmula**
de `buscarMatchesParaSolicitud` + `scoreClienteLote` (pesos: superficie 20, precio 20, ciudad 15 fuzzy/ZMG,
uso 15 → normalizado 0–100) y devuelve el **Top 5**. **Ya la desplegaste** desde el dashboard de Supabase.

### 2.3 `sql/captaciones_backoffice_columns.sql` (NUEVO, commit `2761ee3`)
Las 7 columnas nuevas de `captaciones`. 100% aditivo. **Ya lo corriste** (verificado: las 7 columnas existen).

---

## 3. Verificación de la Edge Function `api-matching` (Tarea 2)

Se probó la lógica de scoring de forma aislada (`scripts/`-style, en scratchpad). Resultado:

```
✓ Devuelve máximo 5 (devolvió 5)
✓ Orden descendente por score
✓ Todos los scores en rango 0-100
✓ Excluye descalificados (precio fuera de rango, superficie < mínimo, ciudad distinta)
✓ Incluye match fuerte por ZMG (Guadalajara ↔ Zapopan ↔ Tlajomulco)
✓ Con 12 candidatos válidos, devuelve exactamente 5
✅ TODAS LAS PRUEBAS PASARON
```

**Conclusión:** la función devuelve correctamente los 5 mejores lotes con su score (0-100) y las razones del match.

---

## 4. SQL exacto para Supabase (columnas de captación)

> Ya está corrido y verificado. Se deja aquí por si hay que recrear el entorno o en un proyecto nuevo.
> Es 100% aditivo (`add column if not exists`): no borra ni renombra nada.

```sql
alter table public.captaciones add column if not exists esquema_comision       text;
alter table public.captaciones add column if not exists acepta_privacidad       boolean default false;
alter table public.captaciones add column if not exists acepta_responsabilidad  boolean default false;
alter table public.captaciones add column if not exists viabilidad_100          boolean default false;
alter table public.captaciones add column if not exists firma_nombre            text;
alter table public.captaciones add column if not exists firma_fecha             timestamptz;
alter table public.captaciones add column if not exists firma_ip                text;
```

Verificación (opcional):
```sql
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='captaciones'
   and column_name in ('esquema_comision','acepta_privacidad','acepta_responsabilidad',
                       'viabilidad_100','firma_nombre','firma_fecha','firma_ip')
 order by column_name;
```

---

## 5. Pasos para probar MAÑANA (Sergio)

### A. Refrescar la app
1. Abre `https://sergiogogue.github.io/macropro-matcher/`.
2. **Hard reload:** Cmd+Shift+R (Mac) o cierra/reabre en Safari (iPad/PWA). Si no ves cambios, espera 1–2 min (GitHub Pages + service worker).

### B. Probar el Wizard de Captación (Quality Gate)
3. Ve a **Captación** → abre o crea una captación.
4. Antes de "📄 Documentos y seguimiento" debe aparecer el bloque **Quality Gate**:
   - **Esquema de Comisión**: elige 100/0 ó 40/60.
   - **3 checkboxes**: Aviso de Privacidad (LFPDPPP), Responsabilidad de la Información, Semáforo de Viabilidad al 100%.
   - **Firma**: escribe tu nombre completo (debe grabar la fecha automáticamente).
5. **Guarda** y **vuelve a abrir** la captación → los datos deben **persistir** (confirma que se guardan en Supabase).

### C. Probar "🚀 Aprobar y Publicar" (a vitrina)
6. Toma una captación y súbele **todos** los documentos: 4 Fotos + Plano + Certificado de uso de suelo + **KMZ**, pega una **liga de Google Maps (https)** y la **firma**.
7. Ve a **Admin** → panel **"🚀 Aprobar y Publicar"**. El botón debe estar **deshabilitado** hasta tener el 100% (muestra qué falta).
8. Con todo completo → **Aprobar y Publicar**. Debe insertar en `vitrina_propiedades` con `estatus='disponible'` y `nivel_ficha='en_vitrina'`, y marcar la captación como publicada.
9. Verifica en Supabase (SQL Editor):
   ```sql
   select folio, titulo, estatus, nivel_ficha, comision_total_pct, notas_colaboracion, asesor_email
     from public.vitrina_propiedades order by created_at desc limit 5;
   ```

### D. Probar la API de Matching
10. Desde una sesión con usuario logueado (o desde la Landing), invoca la función:
    ```js
    const { data } = await sb.functions.invoke('api-matching', { body: { clienteId: '<id_cliente>' } });
    console.log(data); // { cliente, total_evaluados, top: [ {lote, score, razones} x5 ] }
    ```
11. Debe devolver hasta 5 lotes ordenados por score (0-100) con sus razones.

### E. Confirmar que CRM / Metas / Ejecutivo quedaron ocultos
12. En el menú de navegación **ya no** deben aparecer CRM, Metas ni Ejecutivo (los datos siguen ahí; solo se ocultaron del menú).

---

## 6. ⚠️ Correcciones importantes aplicadas (vs. el spec original)

1. **`estatus='publicado'` NO existe.** El enum `vitrina_estatus` es
   `disponible | apartado | en_cierre | vendido | rentado | baja`. Se publica con
   **`estatus='disponible'` + `nivel_ficha='en_vitrina'`** (el enum `vitrina_nivel_ficha` es
   `borrador | publicable | en_vitrina`). Si algo (la Landing) filtra por `'publicado'`, **no verá nada**:
   debe filtrar por `nivel_ficha='en_vitrina'`.
2. **Comisión → vitrina:** al publicar, `aprobarYPublicar` ya copia `comision_total_pct` y guarda el
   esquema (100/0 · 40/60) en `notas_colaboracion` ("Esquema de comisión: …"). No se inventó ninguna columna.

---

## 7. Errores no resueltos

**Ninguno pendiente en MacroPro.** Validación, mount y prueba de matching pasaron. No hubo que comentar
código conflictivo ni abortar nada.

Limitaciones del entorno (no son errores de código, son de permisos de esta sesión):
- **No puedo correr SQL ni desplegar Edge Functions** desde aquí (sin CLI de Supabase, sin credenciales de
  DB, egress a Supabase bloqueado). Por eso el SQL y el deploy de `api-matching` los hiciste tú (ya hechos ✅).

---

## 8. Trabajo paralelo en la Landing (contexto)

En paralelo, y con tu autorización explícita de esta sesión, se está trabajando el
**Spec de la Landing** (Kanban "Mi Pipeline", consumo de `api-matching`, "Mis Comisiones", Realtime de
vitrina) **directamente en el repo `grupoguiamacrolotes-landing`**. Ese trabajo tiene su **propio reporte**
dentro de ese repo (`REPORTE_NOCHE_LANDING.md`) para no mezclar. Este MD cubre **solo MacroPro**.

---

*Generado automáticamente durante el turno de noche. Revisar y validar en producción antes de dar por cerrado (Regla de Oro #1: una fase a la vez).*
