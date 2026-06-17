# Entorno del lote (DENUE · INEGI)

Analiza qué hay **alrededor** de un macrolote/desarrollo (escuelas, salud, comercio,
bancos, restaurantes, gasolineras, etc.) usando el **Directorio Estadístico Nacional
de Unidades Económicas (DENUE)** del INEGI.

Vive en la pestaña **CRM → 📊 Benchmark**, debajo del mapa de competencia: usa el mismo
**ancla** (el desarrollo seleccionado) y el mismo **radio**, y agrega un panel
**"🏘 Entorno del lote (DENUE · INEGI)"** con conteos por categoría y los establecimientos
más cercanos.

## Arquitectura (importante)

La app **no** llama al INEGI directo desde el navegador, por dos razones:

1. **CORS.** El API del INEGI no envía cabeceras CORS → una llamada directa desde
   GitHub Pages (otro origen) la bloquea el navegador.
2. **Token.** El token del DENUE queda como **secreto del servidor**, nunca embebido
   en el `index.html` público.

Por eso hay un **proxy**: la Edge Function de Supabase `denue-entorno`
(`supabase/functions/denue-entorno/index.ts`). El front la invoca con
`sb.functions.invoke('denue-entorno', { body: { lat, lng, radio } })`, la función
consulta al INEGI server-side, clasifica los resultados y devuelve JSON con CORS.

```
Navegador (GitHub Pages)  ──►  Edge Function 'denue-entorno'  ──►  API DENUE (INEGI)
   sb.functions.invoke          (token = secreto INEGI_TOKEN)        Buscar/todos/...
```

## Despliegue (una sola vez)

Requiere la [CLI de Supabase](https://supabase.com/docs/guides/cli) logueada y enlazada
al proyecto `macropro` (`xugrrabebphdelgwqnwc`).

```bash
# 1) Enlazar el proyecto (si no lo está)
supabase link --project-ref xugrrabebphdelgwqnwc

# 2) Guardar el token del DENUE como secreto del servidor
supabase secrets set INEGI_TOKEN="TU_TOKEN_DENUE_DEL_INEGI"

# 3) Desplegar la función
#    --no-verify-jwt: MacroPro usa la "publishable key" nueva (no un JWT de usuario);
#    esta función solo consulta datos públicos del INEGI.
supabase functions deploy denue-entorno --no-verify-jwt
```

> El token del DENUE se obtiene gratis en
> <https://www.inegi.org.mx/app/api/denue/interna_v1/tokenVerify.aspx>.

## Probar el flujo real (regla del proyecto: no declarar "listo" sin probarlo)

1. Desde la consola del navegador en MacroPro (ya logueado), o con `curl`:

```bash
curl -s -X POST \
  "https://xugrrabebphdelgwqnwc.supabase.co/functions/v1/denue-entorno" \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_n-EUveYY5vHlCQdDLEOU7w_4ndCZaJ0" \
  -d '{"lat":20.67,"lng":-103.35,"radio":1000}' | head -c 800
```

   Debe devolver `{"ok":true,"total":N,"categorias":[...],"top":[...]}`.

2. En la app: **CRM → Benchmark**, elige un desarrollo ancla con coordenadas, fija el
   radio y pulsa **🔍 Analizar entorno**. Deben aparecer las tarjetas por categoría y
   la lista de más cercanos.

## Notas / límites

- **Radio:** el DENUE topa la búsqueda en **5000 m**; la función recorta a ese máximo
  aunque el Benchmark esté en 10/15/20 km.
- **Cobertura:** solo México (la función valida lat 10–35, lng −80…−120).
- **Categorías:** se clasifican por palabras clave sobre `Clase_actividad` (educación,
  salud, restaurantes, súper/abarrotes, banca, hoteles, gasolineras, comercio,
  servicios, industria, otros). Ajustables en el arreglo `CATEGORIAS` de la función.
- **Costo:** el API del DENUE es gratuito; las Edge Functions entran en el plan Free de
  Supabase.
