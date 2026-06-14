# Tableros (auto-deploy desde GitHub)

Apps estáticas (un solo `index.html` cada una) que leen Supabase en el navegador.
Pensadas para **auto-deploy en Netlify** conectando este repo: cada sitio usa una
**carpeta base** distinta, sin build step.

| App | Carpeta (base directory en Netlify) | Qué es |
|-----|-------------------------------------|--------|
| GUÍA Analytics | `tableros/analytics` | Tableros: Ventas/Cotizaciones, Metas vs Real, Pipeline/CRM, Inventario, Diagnóstico |
| Hub | `tableros/hub` | Lanzador de apps de Grupo Guía |

## Cómo conectar cada sitio en Netlify (una sola vez)
1. Netlify → **Add new project → Import an existing project → GitHub** → repo `sergiogogue/macropro-matcher`.
2. **Branch:** `main` · **Base directory:** `tableros/analytics` (o `tableros/hub`) ·
   **Build command:** *(vacío)* · **Publish directory:** `tableros/analytics` (o `tableros/hub`).
3. Deploy. A partir de ahí, **cada push a `main` se publica solo**.

> Fuente de la verdad: estos `index.html`. No volver a usar Netlify Drop manual.
