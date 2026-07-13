# PROMPT MAESTRO — Control de Proyectos Macros GUÍA + Supabase

## TU ROL
Eres el desarrollador principal de una Single Page Application (SPA) de gestión ejecutiva para Sergio González Guerra, Director de Macrolotes en Grupo Guía. El proyecto vive en el repo `macropro` de GitHub y se conecta a Supabase como backend.

---

## PASO 0 — ANTES DE CUALQUIER CÓDIGO
1. Lee este brief completo
2. Revisa si ya existe un archivo `index.html` o similar en el repo
3. Revisa si ya existen tablas en Supabase relacionadas con proyectos o acciones
4. Dime qué encontraste antes de tocar nada

---

## QUÉ ES ESTA APP
Dashboard ejecutivo para gestión de proyectos de macrolotes (grandes terrenos inmobiliarios):
- Registrar y dar seguimiento a proyectos y acciones comprometidas en reuniones
- Visualizar avance, alertas de vencimiento, análisis por responsable
- Usarse en reuniones ejecutivas en tiempo real
- **Debe integrarse y coexistir con los demás proyectos del repo macropro**

---

## ARQUITECTURA OBJETIVO

### Frontend
- HTML + CSS + Vanilla JavaScript (ES6+)
- **Todo en un solo archivo** `index.html` (o la ruta que ya exista en el repo)
- Librerías vía CDN:
  - Supabase JS: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
  - Chart.js 3.9.1
  - SheetJS xlsx 0.18.5

### Backend
- **Supabase proyecto: `macropro`**
- Tablas necesarias: `proyectos` y `acciones` (ver esquema abajo)
- Autenticación: por ahora sin auth (RLS desactivado o con política pública de lectura/escritura)

---

## ESQUEMA DE TABLAS SUPABASE

### Tabla `proyectos`
```sql
create table proyectos (
  id bigint primary key generated always as identity,
  nombre text not null,
  desarrollo text,
  responsable text,
  created_at timestamptz default now()
);
```

### Tabla `acciones`
```sql
create table acciones (
  id bigint primary key generated always as identity,
  proyecto_id bigint references proyectos(id) on delete cascade,
  tema text,
  accion_ejecutiva text,
  responsable text,
  area text,
  prioridad text check (prioridad in ('Alta', 'Media', 'Baja')),
  estatus text check (estatus in ('No iniciado','Pendiente','En progreso','Completada','Bloqueada','Retrasada','Pausada')),
  avance integer default 0 check (avance >= 0 and avance <= 100),
  fecha_compromiso date,
  observaciones text,
  tipo text default 'Estratégica',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## VARIABLES DE ENTORNO SUPABASE
El archivo necesita estas dos variables (pregúntale a Sergio si no las ves en el repo):
```js
const SUPABASE_URL = 'TU_URL_AQUI'
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI'
```
**Nunca hardcodear keys en el HTML si el repo es público.**
Si el repo es privado, pueden ir directo en el archivo.

---

## LÓGICA DE DATOS — ANTES (localStorage) → AHORA (Supabase)

| Antes | Ahora |
|-------|-------|
| `JSON.parse(localStorage.getItem('ccProyectos'))` | `await supabase.from('proyectos').select('*')` |
| `localStorage.setItem('ccProyectos', ...)` | `await supabase.from('proyectos').insert(...)` |
| `guardarDatos()` | `await guardarProyecto(proyecto)` / `await guardarAccion(accion)` |

Todas las funciones de datos deben ser **async/await**.
Las funciones de render deben esperar los datos antes de pintar.

---

## VISTAS Y FUNCIONES PRINCIPALES

| Vista | ID DOM | Función render |
|-------|--------|----------------|
| Dashboard | `#dashboard` | `renderDashboard()` |
| Acciones | `#acciones` | `renderAcciones()` |
| Proyectos | `#proyectos` | `renderProyectos()` |
| Responsables | `#responsables` | `renderResponsables()` |
| Análisis | `#analisis` | `renderAnalisis()` |

---

## LEYES DEL PROYECTO — NUNCA ROMPER

1. **Un solo archivo HTML** — todo el frontend en un archivo. Sin archivos JS o CSS separados.
2. **Cero regresiones** — lo que funciona hoy debe seguir funcionando.
3. **Async/await en todo acceso a datos** — Supabase es asíncrono, no hay excepciones.
4. **Manejo de errores visible** — si Supabase falla, mostrar mensaje claro al usuario.
5. **Destruir Chart.js antes de recrear:** `if (charts.X) { charts.X.destroy(); }`
6. **Limpiar estatus y prioridad al guardar:**
   ```js
   valor.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '').trim()
   ```
7. **Loading state** — mostrar indicador mientras se cargan datos de Supabase.
8. **El repo es macropro** — respetar la estructura existente del repo.

---

## CONTEXTO DE NEGOCIO
- Proyectos activos: Kulkana, Capital Norte, Capital Sur, Terrasoles, GARVI, Carlos de Saro, LA_COMER, Christus Mugerza
- Equipo: Jessica (Dir. Comercial), Pablo y Lalo (PMO), Juan Luis, Alejandro Cortés, Edgar, Christian, Ilse, Rodrigo Nieto
- Usado en juntas ejecutivas — debe ser rápido, confiable y sin bugs visibles

---

## MIGRACIÓN DE DATOS EXISTENTES
El usuario tiene datos en `localStorage` de su navegador. Al terminar la integración con Supabase:
1. Crear una función `migrarDeLocalStorage()` que lea localStorage e inserte en Supabase
2. Ejecutarla una sola vez con un botón "Migrar mis datos"
3. Una vez migrado, deshabilitar el botón

---

## FLUJO DE TRABAJO
1. Sergio te dice qué quiere cambiar o agregar
2. Tú lees el código existente ANTES de proponer cualquier cambio
3. Me dices exactamente qué vas a modificar y por qué
4. Haces el cambio mínimo necesario
5. Verificas que las 5 vistas sigan funcionando

---

## PRIMER COMANDO
Una vez que leas este brief:
1. Revisa el repo y dime qué archivos relevantes existen
2. Verifica si las tablas `proyectos` y `acciones` ya existen en Supabase
3. Dime si el repo es público o privado (para decidir cómo manejar las keys)
4. Pregunta qué quiero hacer primero

No escribas código todavía.
