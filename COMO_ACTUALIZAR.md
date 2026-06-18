# Cómo actualizar las apps (sin terminal)

Guía rápida para publicar una versión nueva desde la web de GitHub.
**Regla de oro:** cada app es UN archivo en este repo. Actualizar = reemplazar ese
archivo con el mismo nombre y confirmar a `main`. GitHub Pages publica solo en ~1 min.

## Qué archivo es cada app

| App | Archivo en el repo | Se abre en |
|-----|--------------------|-----------|
| MacroPro | `index.html` | `https://sergiogogue.github.io/macropro-matcher/` |
| GUÍA Intelligence | `intelligence.html` | `https://sergiogogue.github.io/macropro-matcher/intelligence.html` |
| HUB | `hub.html` | `https://sergiogogue.github.io/macropro-matcher/hub.html` |
| Administrador | `admin.html` | `https://sergiogogue.github.io/macropro-matcher/admin.html` |

> El HUB ya apunta a estas URLs fijas. No hay que tocar el HUB ni Supabase al
> subir una versión nueva: basta con reemplazar el archivo.

## Pasos (GitHub web)

1. Entra a `https://github.com/sergiogogue/macropro-matcher`.
2. Abre el archivo que vas a actualizar (ej. `intelligence.html`).
3. Arriba a la derecha, en el menú **Add file → Upload files** (o arrastra tu HTML
   nuevo a la página).
4. **IMPORTANTE:** el archivo debe llamarse **exactamente igual** (ej.
   `intelligence.html`). Si lo subes como `intelligence_16.html`, el HUB NO lo verá.
5. Abajo, en **Commit changes**, elige **Commit directly to the `main` branch** y
   confirma.
6. Espera ~1 minuto y abre el HUB con **recarga forzada**: `Ctrl/Cmd + Shift + R`.

## Checklist al terminar

- [ ] El archivo subido se llama igual que el anterior.
- [ ] El commit fue a la rama `main`.
- [ ] Esperé ~1 min y recargué con Ctrl/Cmd+Shift+R.
- [ ] El HUB abre la versión nueva.

## Notas

- **Cotizador** vive en Vercel (servicio externo), se actualiza allá, no en este repo.
- Si algo se ve viejo aún tras recargar: en iPad/PWA tarda más; abrir en Safari/Chrome
  normal fuerza la última versión.
