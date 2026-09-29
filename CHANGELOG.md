# Changelog — MacroPro

> ⚠ **Versión a unificar (R-11):** el badge de la UI muestra **v5.2** y hay
> referencias internas a **v8.5**. Falta decidir el número canónico y mostrarlo
> desde una sola fuente. **No se cambió el número** para no arriesgar; pendiente
> de decisión.

## 2026-09 · Remediación (spec R-xx) y correcciones

### Seguridad / auditoría
- **R-06** Escaneo de secretos: repo limpio (árbol + historial). Sin API keys reales.
- **R-01** (listo para desplegar) Edge Function `anthropic-proxy` — saca la API key
  de Anthropic del navegador (token en secreto de servidor, exige JWT, CORS restringido).
- **R-03** (listo para aplicar) `sql/rls_audit.sql` — auditoría + endurecimiento RLS por partes.

### Robustez / anti-bugs
- **R-07/R-08** Guard `scripts/validate.js` + CI `.github/workflows/validate.yml`:
  falla si el JSX no compila o si una lista de etapas del pipeline omite una etapa
  de `PIPELINE_STAGES` (fuente única). Previene la clase de bug "etapa desaparecida".
- **R-10** `scripts/mount.js` en CI: verifica que la app monta sin crash.
- **R-09** Auto-sanación de filtros atorados en **Metas** y **Ejecutivo** (no dejan la vista vacía).
- Fix: mapa de orden usaba `"En negociacion"` sin acento (la etapa canónica es
  `"En negociación"`) — un deal en esa etapa se rankeaba mal. (Lo detectó el guard.)

### Limpieza
- **R-17** Eliminados archivos duplicados (`intelligence (8|9).html`).
- **R-16** `docs/ANEXOS_AUDITORIA.md` (A–F) con datos pre-llenados.

## 2026-08/09 · Funcionalidad
- **Pipeline de HubSpot** (solo lectura) desde `hubspot_deals_pendientes`, 7 columnas
  agrupadas, frescura visible, respeta filtros del CRM.
- **Documentos de captación**: subida desde la ficha de Opción y desde `captar.html`
  (checklist, estado "listo para analizar", depuración manual).
- **Bug "Cotización"**: prospectos en esa etapa desaparecían del Ejecutivo — corregido
  en todas las listas de etapas.
- **Control de Vendidos** en Ejecutivo (Con / Ocultar / Solo vendidos).
- **Metas**: persistencia en la nube, scorecard al mes, apartados del mes.
