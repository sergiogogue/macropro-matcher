#!/usr/bin/env node
/*
 * Guard de publicación de MacroPro (R-07/R-08).
 * Corre: `node scripts/validate.js` (o en CI). Falla (exit 1) si:
 *   1) El bloque <script type="text/babel"> de index.html NO compila (JSX inválido).
 *   2) Alguna LISTA DE ETAPAS del pipeline omite una etapa que sí está en la
 *      fuente única PIPELINE_STAGES (esto causó el bug de "Cotización").
 *
 * Regla anti-bug (R-07): PIPELINE_STAGES es la fuente de la verdad. Cualquier
 * literal que se comporte como "lista completa del pipeline" (contiene Visita,
 * Apartado y Contrato) DEBE contener todas las etapas intermedias de
 * PIPELINE_STAGES. Si agregas una etapa nueva al pipeline, el guard la exige
 * en todas esas listas automáticamente.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
let errors = [];

// ── 1) Compila el bloque Babel ──────────────────────────────────────────
const m = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!m) { console.error('❌ No se encontró el bloque <script type="text/babel"> en index.html'); process.exit(1); }
const code = m[1];
try {
  const Babel = require('@babel/standalone');
  Babel.transform(code, { presets: [['react', { runtime: 'classic' }]], filename: 'app.jsx' });
  console.log('✓ Babel: el bloque JSX compila');
} catch (e) {
  console.error('❌ Babel NO compila:\n' + (e && e.message ? e.message : e));
  process.exit(1);
}

// ── 2) Fuente única: PIPELINE_STAGES ────────────────────────────────────
const pm = code.match(/const\s+PIPELINE_STAGES\s*=\s*\[([^\]]*)\]/);
if (!pm) { console.error('❌ No se encontró PIPELINE_STAGES (la fuente única de etapas).'); process.exit(1); }
const PIPELINE_STAGES = pm[1].split(',')
  .map(s => s.trim().replace(/^["']|["']$/g, ''))
  .filter(Boolean);
console.log('✓ PIPELINE_STAGES: ' + PIPELINE_STAGES.length + ' etapas → ' + PIPELINE_STAGES.join(', '));

// Etapas "intermedias" que SIEMPRE deben viajar juntas en una lista de pipeline.
// Se derivan de PIPELINE_STAGES quitando los extremos (que sí varían por vista).
const EXTREMOS = new Set(['Prospecto', 'Por Contactar', 'Vendido', 'Descartado', 'Disponible']);
const REQUERIDAS = PIPELINE_STAGES.filter(s => !EXTREMOS.has(s));

// Una línea "parece lista de pipeline" si menciona estas 3 a la vez DENTRO de un
// literal de datos (array [...] u objeto {...}), no en lógica de comparación.
// Se excluyen ternarios/comparaciones (contienen "===") porque agrupan etapas por
// color/temperatura y no deben listarlas todas (p. ej. stageColor).
const esListaPipeline = (line) =>
  line.includes('Visita') && line.includes('Apartado') && line.includes('Contrato') &&
  !line.includes('===');
// Excluir listas de HubSpot (otro pipeline) y la propia definición fuente.
const esHubspot = (line) => /Firma de|Escriturado|Cliente (sin )?contactad|Prospecto nuevo|Venta Perdida|Preapartado/.test(line);
const esFuente = (line) => /const\s+PIPELINE_STAGES\s*=/.test(line);

const lines = code.split('\n');
lines.forEach((line, i) => {
  if (!esListaPipeline(line) || esHubspot(line) || esFuente(line)) return;
  const faltan = REQUERIDAS.filter(st => !line.includes(st));
  if (faltan.length) {
    errors.push('índice.html línea ~' + (i + 1) + ' (bloque babel): lista de pipeline SIN [' + faltan.join(', ') + ']');
  }
});

if (errors.length) {
  console.error('\n❌ ' + errors.length + ' lista(s) de etapas incompletas (fuente = PIPELINE_STAGES):');
  errors.forEach(e => console.error('   • ' + e));
  console.error('\nArregla agregando las etapas faltantes, o deriva la lista de PIPELINE_STAGES.');
  process.exit(1);
}

console.log('✓ Etapas: todas las listas de pipeline contienen las intermedias requeridas.');
console.log('\n✅ VALIDACIÓN OK — se puede publicar.');
