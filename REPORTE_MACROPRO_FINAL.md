# 🏁 Reporte Final — MacroPro "Option Engine"

**Fecha:** 2026-11-05 · **Repo:** `sergiogogue/macropro-matcher` · **Rama base:** `main`
**Estado:** ✅ Todo desplegado en producción (GitHub Pages) + Supabase.

MacroPro queda convertido en un **Back-Office / Option Engine**: capta terrenos, hace cross-check
con la cartera de clientes, gestiona el expediente legal del propietario vía "Liga Mágica", y **aprueba**
para que la **Landing** publique en el catálogo de macrolotes.

---

## 1. Refactor de UI → Back-Office puro
- **Menú reducido** a 4: **Inicio · Opción/Captación · Documentos · Admin**. El resto (CRM, Metas,
  Ejecutivo, Corretaje, Clientes, Inventario, Matches, Comparador, Búsqueda, Cliente↔Lotes) salió del nav.
- **Redirect:** entrar por URL/recarga a una vista oculta → cae en **Captación** (deep-link `?vista=` idem).
- **Home (Inicio)**: sus accesos ahora apuntan solo a Captación/Documentos/Admin.
- **NADA se borró:** todos los componentes, renders (`view===`) y datos siguen en `index.html`
  (ocultos/reversibles). Accesos viejos del Home preservados con render desactivado (`{false && …}`).

## 2. Cross-Check en el Wizard (terreno → clientes)
- Botón **🔍 "Buscar clientes compatibles"** en el modal de captación (cuando hay superficie+precio+uso+ciudad).
- Llama a la Edge Function **`api-matching`** en modo **`lote→clientes`** → banner *"✨ Este terreno encaja
  con N clientes de tu cartera"* + Top 3 (score 0-100 + razones).

## 3. Publicación → la Landing publica a `lotes` (no vitrina)
- Se corrigió el destino: el catálogo de la Landing es **`lotes` / `v_landing_lotes`**, NO `vitrina_propiedades`.
- **MacroPro ya NO escribe tablas compartidas al publicar.** El botón **"Aprobar para publicar"** solo
  **marca** la captación: `aprobada_publicar`, `aprobada_at`, `aprobada_por`.
- La **Landing** leerá las captaciones aprobadas e insertará en `lotes` con sus reglas
  (`clave_unica` no nula, id minúscula, upsert por clave → anti-duplicados). *(Trabajo de la Landing.)*
- El código viejo que insertaba a `vitrina_propiedades` quedó como función **DEPRECADA** (preservada, sin uso).

## 4. Liga Mágica + Expediente Legal (Fase 2 · A→D)
- **A (SQL):** `captaciones.liga_token` (uuid único) + tabla **`captaciones_legal`**
  (`captacion_id` FK, `tipo_documento`, `url`, `estatus`, `created_at`) + RLS + **RPCs token-gated**
  (`legal_subir_doc`, `legal_estado`).
- **B (MacroPro):** botón **🔗 "Copiar Liga Mágica"** → `captar.html?token=…` al portapapeles.
- **C (Portal público `captar.html`):** con `?token=` muestra el **Timeline** del expediente
  (Datos → Documentos → Revisión → Publicado) y permite **subir INE/escrituras/etc.**
  (Storage anónimo + `legal_subir_doc`). El dueño **no ve precios ni comisiones**.
- **D (MacroPro):** sección **⚖️ "Expediente Legal"** en el modal → **Aprobar/Rechazar** cada documento.
  El botón "Aprobar para publicar" exige expediente legal completo **si** la captación tiene docs legales
  (si no usa Liga Mágica, no bloquea — pendiente futuro: badge visual).

---

## 5. SQL corrido en Supabase (ya aplicado ✅)
| Archivo | Qué crea |
|---|---|
| `sql/captaciones_backoffice_columns.sql` | 7 columnas del Quality Gate (esquema_comision, firmas, checks) |
| `sql/captaciones_aprobacion_publicar.sql` | `aprobada_publicar`, `aprobada_at`, `aprobada_por`, `publicada_lote_id` |
| `sql/liga_magica_expediente.sql` | `liga_token`, tabla `captaciones_legal`, RLS + RPCs |
| `sql/vitrina_dedup_folio.sql` | *(superseded — NO se corrió, sin uso)* |

## 6. Edge Function `api-matching`
- **Endpoint:** `https://xugrrabebphdelgwqnwc.supabase.co/functions/v1/api-matching`
- **Método:** `POST` · **Auth:** requiere sesión Supabase (`Authorization: Bearer <access_token>`) + `apikey`.
- **CORS permitido:** `https://macrolotes.grupoguia.mx`, `https://sergiogogue.github.io`.
- **Dos modos:**
  - `clienteId → lotes`: body `{ "clienteId": "<id>", "limit": 5 }` → `{cliente, total_evaluados, top:[{lote,score,razones}]}`.
  - `lote → clientes` (Cross-Check): body `{ "lote": {superficie_m2, precio_total, ciudad, uso}, "limit": 3 }`
    → `{modo:"lote_a_clientes", total_evaluados, top:[{cliente,score,razones}]}`.
- **Ejemplo desde la Landing** (con sesión del asesor):
  ```js
  const { data } = await supabase.functions.invoke('api-matching', { body: { clienteId } });
  ```

---

## 7. Pendiente del lado de la Landing (para cerrar el círculo)
Repo `grupoguiamacrolotes-landing`, rama `claude/landing-apimatching` (ya con un arranque staged):
1. **Consumir `api-matching`** (botón "Buscar lotes compatibles" en la ficha del cliente).
   ⚠ Resolver el **mismatch de IDs**: la ficha usa `landing_clientes.id` y la función consulta la tabla
   `clientes`. Recomendación: que `api-matching` acepte `body.criterios` (ciudad/uso/sup/presupuesto)
   y se salte la tabla `clientes`.
2. **Publicar captaciones aprobadas:** leer `captaciones where aprobada_publicar=true and publicada_lote_id is null`
   → `upsert` a `lotes` por `clave_unica`/id minúscula → escribir de vuelta `publicada_lote_id`.
3. (Opcional) Kanban sobre `crm_lotes` vía RPCs, y Realtime de catálogo.
   Detalle completo en `REPORTE_NOCHE_LANDING.md` (en ese repo).

## 8. Validación
Cada fase pasó `node scripts/validate.js` (exit 0) y `node scripts/mount.js` (exit 0). `captar.html`
verificado aparte (sintaxis JS OK).

## 9. Protocolo de seguridad respetado
- Trabajo en rama `claude/wizardly-cerf-QhtU1`; merges a `main` solo con autorización explícita.
- Backups: `e35fe50` (pre-refactor), `19b2789` (pre-liga-mágica).
- Cero código destructivo (vistas y funciones viejas ocultadas/deprecadas, no borradas).

---

*MacroPro = Option Engine. Siguiente frente: cerrar la integración en la Landing (sección 7).*
