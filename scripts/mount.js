#!/usr/bin/env node
/*
 * R-10 · Test de "monta sin crash" (solo CI/local, NUNCA corre en la app).
 * Compila el bloque Babel de index.html, evalúa el código con React 18 +
 * jsdom y renderiza el componente raíz en UNA pasada (renderToStaticMarkup,
 * sin efectos → sin loops). Si algo tira en la definición o el render, falla.
 *
 * Riesgo para la app: CERO. Este archivo no se sirve ni se importa en runtime;
 * solo lo ejecuta el workflow de CI y el desarrollador en local.
 *
 * Requiere: @babel/standalone, react, react-dom, jsdom (los instala el CI).
 */
const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');
const { JSDOM } = require('jsdom');

const FILE = path.join(path.resolve(__dirname, '..'), 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const m = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!m) { console.error('❌ No se encontró el bloque babel'); process.exit(1); }
const code = m[1];

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://sergiogogue.github.io/macropro-matcher/', pretendToBeVisual: true,
});
const { window } = dom;
global.window = window; global.document = window.document; global.navigator = window.navigator;
global.location = window.location; global.localStorage = window.localStorage;
global.HTMLElement = window.HTMLElement; global.getComputedStyle = window.getComputedStyle;
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.sb = null; window.supabase = { createClient: () => null };
global.fetch = () => Promise.reject(new Error('no-net'));

window.React = require('react'); window.ReactDOM = require('react-dom');
const React = window.React; global.React = React; global.ReactDOM = window.ReactDOM;
const { useState, useEffect, useRef, useCallback, useMemo } = React;
global.useState = useState; global.useEffect = useEffect; global.useRef = useRef;
global.useCallback = useCallback; global.useMemo = useMemo;
const server = require('react-dom/server');

// La app llama ReactDOM.render(...) al final. Lo interceptamos para una pasada
// estática (sin efectos), suficiente para detectar crashes de definición/render.
let rendered = false;
window.ReactDOM.render = (el) => {
  try {
    const s = server.renderToStaticMarkup(el);
    rendered = true;
    console.log('✓ Render OK (1 pasada, sin efectos) · ' + s.length + ' chars');
  } catch (e) {
    console.error('❌ CRASH EN RENDER:\n' + (e && e.stack ? e.stack : e));
    process.exit(1);
  }
};
global.ReactDOM = window.ReactDOM;

try {
  const out = Babel.transform(code, { presets: [['react', { runtime: 'classic' }]], filename: 'app.jsx' }).code;
  eval(out);
} catch (e) {
  console.error('❌ CRASH EN EVAL:\n' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
if (!rendered) { console.error('❌ La app no llegó a renderizar (¿cambió el punto de montaje?)'); process.exit(1); }
console.log('\n✅ MONTA SIN CRASH.');
