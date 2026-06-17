# Entorno del lote (DENUE · INEGI)

Analiza qué hay **alrededor** de un macrolote/desarrollo (escuelas, salud, comercio,
bancos, restaurantes, gasolineras, etc.) usando el **Directorio Estadístico Nacional
de Unidades Económicas (DENUE)** del INEGI.

Vive en **CRM → 📊 Benchmark**, debajo del mapa de competencia: usa el mismo **ancla**
(el desarrollo seleccionado) y el mismo **radio**, y agrega un panel
**"🏘 Entorno del lote (DENUE · INEGI)"** con conteos por categoría y los establecimientos
más cercanos.

## Arquitectura: llamada DIRECTA desde el navegador

MacroPro llama al API del INEGI **directamente desde el navegador del usuario**, sin
servidor intermedio. Esto funciona porque:

1. **El INEGI envía `Access-Control-Allow-Origin: *`** → CORS abierto, el navegador
   puede leer la respuesta desde GitHub Pages.
2. **La IP del usuario es mexicana/residencial.** El API del DENUE rechaza las IP de
   datacenter (probado: una Edge Function de Supabase recibía respuesta vacía/`000`).
   Desde el navegador del usuario sí responde.

```
Navegador (MacroPro)  ──fetch directo──►  https://www.inegi.org.mx/app/api/denue/v1/consulta/buscar/...
   (CORS *, GET simple)                    devuelve JSON con los establecimientos
```

El código vive en `index.html`:
- `getInegiToken()` / `INEGI_TOKEN_DEFAULT` — el token (override por `localStorage`
  con la clave `macropro_inegi_token`).
- `procesarEntornoDENUE()` / `clasificarDENUE()` — clasifican los resultados por
  categoría en el cliente.
- `cargarEntornoDENUE()` (en el componente) — hace el `fetch` y arma el panel.

> **Importante:** se usa un **GET simple sin cabeceras extra** a propósito. Agregar
> cabeceras (Authorization, Content-Type, etc.) dispararía un *preflight* CORS que el
> servidor del INEGI no maneja bien. No añadir cabeceras a esta llamada.

## Token

- El token del DENUE se obtiene gratis en
  <https://www.inegi.org.mx/app/api/denue/interna_v1/tokenVerify.aspx>.
- Por defecto va embebido en `INEGI_TOKEN_DEFAULT` (es gratuito y de **datos públicos**;
  riesgo bajo). Para rotarlo sin tocar código, guarda otro en `localStorage`:
  `localStorage.setItem('macropro_inegi_token', 'NUEVO_TOKEN')`.

## Límites y notas

- **Radio:** el DENUE topa la búsqueda en **5000 m**; se recorta a ese máximo aunque el
  Benchmark esté en 10/15/20 km.
- **Cobertura:** solo México.
- **Intermitencia del API:** el servicio del DENUE por token es a veces inestable (su
  balanceador F5 puede responder `000`/vacío). En ese caso el panel muestra "intenta de
  nuevo en unos minutos" — no es un error de MacroPro. El **mapa** oficial
  (<https://www.inegi.org.mx/app/mapa/denue/>) usa otro servicio y puede estar arriba
  aunque el API por token esté caído.
- **Categorías:** se clasifican por palabras clave sobre `Clase_actividad`. Ajustables
  en el arreglo `DENUE_CATS` de `index.html`.

## Edge Function (descartada)

Se intentó un proxy con una Supabase Edge Function (`denue-entorno`), pero el API del
INEGI **bloquea las IP de datacenter** de Supabase, así que se descartó en favor de la
llamada directa. Si llegaste a desplegar `denue-entorno` en Supabase, puedes **borrarla**;
ya no se usa.
