// ════════════════════════════════════════════════════════════════════════════
// Prueba de MONTAJE real de MacroPro (complementa scripts/validate.js, que solo compila).
// Monta la app en jsdom con un Supabase simulado, compilando IGUAL que el navegador
// (Babel preset env + react), y recorre el flujo Cotización → Captación:
//   tablero (pendientes / aceptadas), Panel (📂 Ficha), ficha (lista única de 8 docs),
//   subir documento (atómico, bucket privado) y Analizar en Intelligence.
// Uso:  npm install --no-save jsdom @babel/standalone react@18.3.1 react-dom@18.3.1
//       node scripts/smoke_mount.js
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const MP = path.resolve(__dirname, '..');
const req = (m) => require(path.join(MP, 'node_modules', m));
const fs = require('fs');
const { JSDOM } = req('jsdom');
const Babel = req('@babel/standalone');

const html = fs.readFileSync(path.join(MP, 'index.html'), 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
const code = Babel.transform(m[1], { presets: ['env', ['react', { runtime: 'classic' }]], sourceType: 'script', filename: 'app.jsx' }).code;

const SERGIO = '0f1ccddf-61b2-4e87-bdde-a8303b399e2e';
const fixtures = {
  cotizaciones_opcionador: [
    { id: SERGIO, cliente_nombre: 'Sergio prueba', terreno_nombre: 'Floresta prueba', terreno_ciudad: 'Ajijic', valor_terreno: '$150,000,000.00', monto_comision: '6%', estatus: 'aceptada', terminos_aceptados: true, captacion_id: 'capta-opc-' + SERGIO, created_at: '2026-11-07T10:00:00Z' },
    { id: '11111111-1111-1111-1111-111111111111', cliente_nombre: 'julio pindter', terreno_nombre: 'Floresta Altos', terreno_ciudad: 'Ajijic', monto_comision: '6%', estatus: 'enviada', terminos_aceptados: false, created_at: '2026-11-06T10:00:00Z' },
    { id: '22222222-2222-2222-2222-222222222222', cliente_nombre: 'Rechazo Test', terreno_nombre: 'Lote X', estatus: 'rechazada', terminos_aceptados: false, created_at: '2026-11-05T10:00:00Z' },
  ],
  captaciones: [
    { id: 'capta-opc-' + SERGIO, pipeline: 'Nueva opción', propietario: 'Sergio prueba', contacto: 'Sergio prueba', telefono: '3316057715', ciudad: 'Ajijic', zona: 'Floresta prueba', superficie: 5000, precio_dueno: 150000000, comision: '6%', asesor_responsable_gg: 'Sergio Gonzalez Guerra', fecha_creacion: '2026-11-07T10:00:00Z', eliminado: false,
      documentos_urls: [
        { tipo: 'Escrituras', nombre: 'escritura.pdf', path: SERGIO + '/escrituras.pdf', bucket: 'documentos-opcionador', subido_por: 'cliente' },
        { tipo: 'Certificado de uso de suelo', nombre: 'uso.pdf', path: SERGIO + '/uso_suelo.pdf', bucket: 'documentos-opcionador', subido_por: 'cliente' },
        { tipo: 'Plano del terreno', nombre: 'plano.pdf', path: SERGIO + '/plano.pdf', bucket: 'documentos-opcionador', subido_por: 'cliente' },
        { tipo: 'Boleta registral / predial', nombre: 'predial.pdf', path: SERGIO + '/predial.pdf', bucket: 'documentos-opcionador', subido_por: 'cliente' },
      ] },
  ],
  documentos_opcionador: [],
};

function q(table) {
  const res = { data: fixtures[table] || [], error: null };
  const p = new Proxy(function () {}, {
    get(_, k) {
      if (k === 'then') return (ok, ko) => Promise.resolve(res).then(ok, ko);
      if (k === 'single' || k === 'maybeSingle') return () => Promise.resolve({ data: (res.data || [])[0] || null, error: null });
      return () => p;
    },
  });
  return p;
}
const rpcCalls = [];
const rpcData = {}; // respuesta simulada por RPC (p. ej. acuerdos_lista)
const sb = {
  from: (t) => q(t),
  rpc: (fn, args) => { rpcCalls.push([fn, args]); const d = rpcData[fn]; return Promise.resolve({ data: typeof d === 'function' ? d(args) : (d === undefined ? null : d), error: null }); },
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { email: 'sergio@grupoguia.mx', id: 'u1' } } } }),
    getUser: () => Promise.resolve({ data: { user: { email: 'sergio@grupoguia.mx' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve({}),
  },
  storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://signed/x' } }), upload: () => Promise.resolve({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://pub/x' } }), remove: () => Promise.resolve({}) }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
};

async function run(view) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://sergiogogue.github.io/macropro-matcher/',
  });
  const w = dom.window;
  const errs = [];
  w.console.error = (...a) => { const s = a.map(String).join(' '); if (!/Warning: |act\(|ReactDOM.render is no longer/.test(s)) errs.push(s); };
  w.console.warn = () => {};
  w.addEventListener('error', (e) => errs.push('window.error: ' + (e.error && e.error.stack || e.message)));
  w.localStorage.setItem('macropro_view_v1', JSON.stringify(view));
  w.sb = sb; w.supabase = { createClient: () => sb };
  w.alert = () => {}; w.confirm = () => true; w.open = () => null; w.scrollTo = () => {};
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  w.eval(fs.readFileSync(path.join(MP, 'node_modules/react/umd/react.development.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(MP, 'node_modules/react-dom/umd/react-dom.development.js'), 'utf8'));
  try { w.eval(code); } catch (e) { errs.push('eval: ' + (e.stack || e.message)); }
  await new Promise((r) => setTimeout(r, 2500));
  return { w, errs, text: () => w.document.body.textContent };
}

(async () => {
  let fallos = 0;
  const check = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fallos++; };

  rpcData.landing_asesores_catalogo = [{ nombre: 'Ana Martínez López', email: 'ana.martinez@grupoguia.mx' }];
  rpcData.acuerdo_crear = { id: 'x', token: 'tok', folio: 'AC-2026-0007', estado: 'pendiente' };
  console.log('▶ Vista Opción / Captación');
  const a = await run('captacion');
  const ta = a.text();
  check(a.errs.length === 0, 'sin errores de JS/React' + (a.errs.length ? ':\n     ' + a.errs.slice(0, 3).join('\n     ') : ''));
  check(/Esperando que el propietario acepte/.test(ta), 'julio (pendiente) aparece como "Esperando que el propietario acepte"');
  check(!/Rechazo Test/.test(ta), 'la cotización rechazada NO aparece en el tablero');
  check(/Sergio prueba/.test(ta), 'Sergio aparece como captación real');
  check(!/OPCIONADOR · LANDING/.test(ta), 'ya no hay tarjetas híbridas "OPCIONADOR · LANDING"');

  console.log('▶ Vista Cotización (Panel)');
  const b = await run('pitch');
  const tb = b.text();
  check(b.errs.length === 0, 'sin errores de JS/React' + (b.errs.length ? ':\n     ' + b.errs.slice(0, 3).join('\n     ') : ''));
  check(/Panel de cotizaciones/.test(tb), 'el Panel se dibuja');
  check(/📂 Ficha/.test(tb), 'Sergio (aceptada) muestra "📂 Ficha"');
  check(/⏳ Sin aceptar/.test(tb), 'julio (pendiente) muestra "⏳ Sin aceptar"');

  console.log('▶ Abrir la ficha desde el Panel');
  const btn = [...b.w.document.querySelectorAll('button')].find((x) => /📂 Ficha/.test(x.textContent));
  if (btn) { btn.dispatchEvent(new b.w.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 1500)); }
  const tc = b.text();
  check(!!btn, 'existe el botón 📂 Ficha');
  check(/Copiar liga del propietario/.test(tc), 'la ficha ofrece "Copiar liga del propietario" (no Liga Mágica)');
  check(/Escrituras/.test(tc) && /INE del propietario/.test(tc) && /Ubicación \(KMZ \/ KML\)/.test(tc), 'la ficha muestra la lista única de 8 documentos');
  check(/del propietario/.test(tc), 'marca los documentos que subió el propietario');
  check(/🧠 Analizar en Intelligence/.test(tc), 'botón "Analizar en Intelligence" en la ficha');
  check(!/Expediente Legal/.test(tc), 'no muestra el Expediente Legal vacío de la Liga Mágica');
  check(b.errs.length === 0, 'sin errores tras abrir la ficha' + (b.errs.length ? ':\n     ' + b.errs.slice(0, 3).join('\n     ') : ''));

  console.log('▶ Acuerdo de comisión en la ficha (reemplaza la "Firma digital" escrita)');
  check(/🤝 Acuerdo de comisión con el asesor opcionador/.test(tc), 'la ficha tiene el bloque del Acuerdo de comisión');
  check(!/Firma digital \(nombre completo del asesor\)/.test(tc) && !b.w.document.querySelector('input[name=esquema_comision]'), 'ya no hay firma escrita a mano ni radio 100/0 · 40/60');
  check(/Semáforo de Viabilidad al 100%/.test(tc), 'se conserva la casilla del semáforo (condición de entrada)');
  {
    const D2 = b.w.document;
    const sel = [...D2.querySelectorAll('select')].find((x) => /Asesor opcionador \(con correo\)/.test(x.textContent));
    check(!!sel && [...sel.options].some((o) => o.value === 'ana.martinez@grupoguia.mx'), 'el selector de asesor trae el catálogo de cuentas (Landing)');
    if (sel) {
      const setter = Object.getOwnPropertyDescriptor(b.w.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, 'ana.martinez@grupoguia.mx'); sel.dispatchEvent(new b.w.Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const gen = [...D2.querySelectorAll('button')].find((x) => /Generar Acuerdo de Comisión/.test(x.textContent));
      rpcCalls.length = 0
      if (gen) { gen.dispatchEvent(new b.w.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 800)); }
      const call = rpcCalls.find((c) => c[0] === 'acuerdo_crear');
      check(!!call && /^capta-opc-/.test(call[1].p_captacion_id) && call[1].p_asesor_email === 'ana.martinez@grupoguia.mx' && call[1].p_lote_id === null, 'Generar crea el acuerdo de ESTA captación a nombre del asesor elegido');
      check(/Liga lista · folio AC-2026-0007/.test(b.text()), 'muestra el folio de la liga generada');
    }
  }

  console.log('▶ Acciones en la ficha');
  const W = b.w, D = W.document;
  // a) Intelligence sin ubicación → debe avisar qué falta (no abrir nada)
  let alerta = ''; W.alert = (m) => { alerta = String(m); };
  const btnIA = [...D.querySelectorAll('button')].find((x) => /🧠 Analizar en Intelligence/.test(x.textContent));
  btnIA.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 400));
  check(/Ubicación/.test(alerta) && !/Plano|predial|uso de suelo/i.test(alerta), 'Intelligence sin ubicación avisa SOLO "Falta Ubicación" → "' + alerta + '"');
  // b) Subir INE desde la ficha → va al bucket PRIVADO y se guarda de forma atómica
  rpcCalls.length = 0;
  const filaINE = [...D.querySelectorAll('span')].find((s) => /^(⬜|✅).*INE del propietario/.test(s.textContent.trim()));
  const inputINE = filaINE && filaINE.parentElement.querySelector('input[type=file]');
  check(!!inputINE, 'la fila "INE del propietario" tiene su botón Subir');
  if (inputINE) {
    const file = new W.File(['%PDF'], 'ine.pdf', { type: 'application/pdf' });
    Object.defineProperty(inputINE, 'files', { value: [file] });
    inputINE.dispatchEvent(new W.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 800));
    const call = rpcCalls.find((c) => c[0] === 'captacion_doc_agregar');
    check(!!call, 'subir usa captacion_doc_agregar (no reescribe toda la ficha)');
    check(call && call[1].p_doc.bucket === 'documentos-opcionador' && !call[1].p_doc.url && call[1].p_doc.tipo === 'INE del propietario', 'INE va al bucket PRIVADO sin URL pública');
  }
  // c) Con liga de Maps → Intelligence sí arranca con TODOS los documentos firmados
  const cap = fixtures.captaciones[0]; cap.liga_maps = 'https://maps.app.goo.gl/abc';
  const c2 = await run('pitch');
  const b2 = [...c2.w.document.querySelectorAll('button')].find((x) => /📂 Ficha/.test(x.textContent));
  b2.dispatchEvent(new c2.w.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 1500));
  let abierto = null; c2.w.open = () => { abierto = { location: '', close() {} }; return abierto; };
  const ia2 = [...c2.w.document.querySelectorAll('button')].find((x) => /🧠 Analizar en Intelligence/.test(x.textContent));
  ia2.dispatchEvent(new c2.w.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 800));
  const pl = JSON.parse(c2.w.localStorage.getItem('valuador_opcionador') || 'null');
  check(pl && pl.documentos.length === 4 && pl.documentos.every((d) => /^https:\/\/signed/.test(d.url)), 'Intelligence recibe los 4 documentos con URL firmada');
  check(abierto && /intelligence\.html\?fuente=opcionador&c=capta-opc-/.test(String(abierto.location)), 'abre intelligence.html con la captación → ' + (abierto && abierto.location));
  check(c2.errs.length === 0, 'sin errores en el flujo de Intelligence' + (c2.errs.length ? ':\n     ' + c2.errs.slice(0, 3).join('\n     ') : ''));

  console.log('▶ Acuerdo ya firmado 60/40: estatus, PDF y validar');
  rpcData.acuerdos_lista = [{ id: '11111111-2222-3333-4444-555555555555', folio: 'AC-2026-0001', estado: 'firmado', esquema: '60/40', asesor_nombre: 'Ana Martínez López', asesor_email: 'ana.martinez@grupoguia.mx', firmado_at: '2026-11-08T00:42:15Z', firma_ip: '189.203.45.12', pdf_path: 'pdf/x/AC-2026-0001.pdf', token: 't' }];
  const d = await run('pitch');
  const bd = [...d.w.document.querySelectorAll('button')].find((x) => /📂 Ficha/.test(x.textContent));
  if (bd) { bd.dispatchEvent(new d.w.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 1500)); }
  const td = d.text();
  check(/AC-2026-0001/.test(td) && /Firmado · falta validar/.test(td), 'muestra folio y "Firmado · falta validar"');
  check(/60\/40 · Macrolotes vende/.test(td) && /Asesor 60%/.test(td) && /Macrolotes 40%/.test(td), 'esquema 60/40 con asesor 60% · Macrolotes 40%');
  check(/IP 189\.203\.45\.12/.test(td), 'muestra la IP de la firma');
  check(/✅ Validar acuerdo/.test(td) && /📄 Ver PDF/.test(td) && /Adenda \(cambiar esquema\)/.test(td), 'botones Validar, Ver PDF y Adenda');
  check(!/Generar Acuerdo de Comisión/.test(td), 'con acuerdo firmado ya no ofrece generar otro (solo adenda)');
  check(d.errs.length === 0, 'sin errores con el acuerdo firmado' + (d.errs.length ? ':\n     ' + d.errs.slice(0, 3).join('\n     ') : ''));

  console.log(fallos ? `\n❌ ${fallos} verificación(es) fallaron` : '\n✅ TODO OK');
  process.exit(fallos ? 1 : 0);
})();
