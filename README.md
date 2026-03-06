# MacroPro Matcher — Grupo Guía

Motor de Matching Macrolote × Cliente con Inteligencia Artificial.

## ¿Qué hace esta app?

- Cruza el perfil de un cliente con todos los lotes del inventario
- Genera un score de compatibilidad 0-100 con IA
- Muestra argumentos de venta personalizados por cliente
- Permite filtrar por ciudad, uso de suelo, superficie y precio
- Genera propuestas en PPTX listas para presentar

## Cómo correr localmente

```bash
npm install
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## Cómo construir para producción

```bash
npm run build
```

## Variables de entorno

La API key de Anthropic se configura en Netlify:
- `VITE_ANTHROPIC_API_KEY` — tu API key de Anthropic

## Tecnologías

- React 18
- Vite
- SheetJS (lectura de Excel)
- Anthropic Claude API
- Netlify (hosting)

---

**Grupo Guía — Dirección de Macro Lotes**  
Sistema MacroPro — Confidencial, uso interno
