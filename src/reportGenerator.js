/**
 * MacroPro — Generador de Reportes PPTX (Frontend)
 * Usa pptxgenjs cargado como script global desde /pptxgen.bundle.js
 * 3 tipos: fichaTecnica | matchLoteClientes | matchClienteLotes
 */

// ── BRAND ────────────────────────────────────────────────────────
const C = {
  navy:    "002B49", navyMid: "0A3D5C", navyLt: "1E4A6B",
  gold:    "F5B335", goldLt:  "FFF3D0",
  white:   "FFFFFF", offW:    "F8FAFC",
  grey1:   "E2E8F0", grey2:   "94A3B8", grey3:   "64748B", grey4: "1E293B",
  green:   "1a8a4a", greenLt: "E6F7ED",
  red:     "C0392B", redLt:   "FDECEA",
};

// ── LOGO base64 — logos embebidos ─────────────────────────────────
let LOGO_ML_B64 = null;
let LOGO_GG_B64 = null;

async function fetchLogoAsBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function ensureLogos() {
  if (!LOGO_ML_B64) {
    LOGO_ML_B64 = await fetchLogoAsBase64("/logo_macrolotes.png");
  }
  if (!LOGO_GG_B64) {
    LOGO_GG_B64 = await fetchLogoAsBase64("/logo_grupoguia.png");
  }
}

// ── FORMAT HELPERS ───────────────────────────────────────────────
const fmtM = (v) => {
  if (!v) return "N/D";
  const m = v / 1_000_000;
  return m >= 1 ? `$${m.toFixed(1)} MDP` : `$${(v / 1000).toFixed(0)}K`;
};
const fmtNum = (v) => (v ? Number(v).toLocaleString("es-MX") : "N/D");
const makeShadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.12 });

// ── SLIDE LAYOUT HELPERS ─────────────────────────────────────────
function addHeader(pres, slide, title, subtitle = "") {
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:1.1, fill:{ color:C.navy }, line:{ color:C.navy } });
  slide.addShape(pres.shapes.RECTANGLE, { x:0, y:1.1, w:10, h:0.06, fill:{ color:C.gold }, line:{ color:C.gold } });
  if (LOGO_ML_B64) slide.addImage({ data:LOGO_ML_B64, x:0.3, y:0.15, w:2.2, h:0.37 });
  if (LOGO_GG_B64) slide.addImage({ data:LOGO_GG_B64, x:8.75, y:0.2, w:0.9, h:0.19, sizing:{ type:"contain", w:0.9, h:0.3 } });
  slide.addText(title, { x:0.3, y:1.22, w:9.4, h:0.55, fontSize:20, bold:true, color:C.navy, fontFace:"Arial", margin:0 });
  if (subtitle) {
    slide.addText(subtitle, { x:0.3, y:1.77, w:9.4, h:0.3, fontSize:11, color:C.grey3, fontFace:"Arial", margin:0 });
  }
}

function addFooter(slide) {
  slide.addShape("rect", { x:0, y:5.35, w:10, h:0.275, fill:{ color:C.navy }, line:{ color:C.navy } });
  slide.addText("CONFIDENCIAL · MacroPro · Grupo Guía · Dirección de Macro Lotes · www.grupoguia.mx", {
    x:0.3, y:5.36, w:9.4, h:0.25, fontSize:7, color:C.gold, fontFace:"Arial", align:"center", margin:0,
  });
}

function kpiBox(slide, x, y, w, h, label, value, bgColor = C.navy) {
  slide.addShape("rect", { x, y, w, h, fill:{ color:bgColor }, shadow:makeShadow(), line:{ color:bgColor } });
  slide.addText(label, { x, y:y+0.05, w, h:0.22, fontSize:7, bold:true, color:C.grey2, align:"center", charSpacing:1, margin:0 });
  slide.addText(value, { x, y:y+0.26, w, h:h-0.3, fontSize:15, bold:true, color:C.gold, fontFace:"Arial", align:"center", valign:"middle", margin:0 });
}

function infoCard(slide, x, y, w, h, label, value, accent = false) {
  slide.addShape("rect", { x, y, w, h, fill:{ color: accent ? C.goldLt : C.white }, line:{ color:C.grey1, pt:1 }, shadow:makeShadow() });
  slide.addShape("rect", { x, y, w:0.06, h, fill:{ color: accent ? C.gold : C.navyMid }, line:{ color: accent ? C.gold : C.navyMid } });
  slide.addText(label.toUpperCase(), { x:x+0.12, y:y+0.06, w:w-0.15, h:0.18, fontSize:7, bold:true, color:C.grey2, charSpacing:1, margin:0 });
  slide.addText(String(value || "N/D"), { x:x+0.12, y:y+0.22, w:w-0.15, h:h-0.28, fontSize:10, bold:true, color:C.navy, wrap:true, margin:0 });
}

function scoreCircle(slide, x, y, score) {
  const color = score >= 80 ? C.green : score >= 60 ? "D97706" : C.red;
  slide.addShape("ellipse", { x, y, w:1.1, h:1.1, fill:{ color }, shadow:makeShadow(), line:{ color } });
  slide.addText(`${score}`, { x, y:y+0.18, w:1.1, h:0.55, fontSize:30, bold:true, color:C.white, align:"center", margin:0 });
  slide.addText("SCORE", { x, y:y+0.72, w:1.1, h:0.25, fontSize:7, bold:true, color:C.white, align:"center", charSpacing:2, margin:0 });
}

function argBlock(slide, x, y, w, h, title, items, bgColor, titleColor) {
  slide.addShape("rect", { x, y, w, h, fill:{ color:bgColor }, line:{ color:bgColor }, shadow:makeShadow() });
  slide.addText(title, { x:x+0.12, y:y+0.08, w:w-0.2, h:0.22, fontSize:8, bold:true, color:titleColor, charSpacing:1, margin:0 });
  const rows = items.slice(0, 3).flatMap((t, i) => [
    { text: `${i+1}. `, options: { bold:true, color:titleColor, fontSize:9 } },
    { text: t, options: { color:C.grey4, fontSize:9, breakLine: i < Math.min(items.length,3)-1 } },
  ]);
  if (rows.length) slide.addText(rows, { x:x+0.12, y:y+0.32, w:w-0.2, h:h-0.38, wrap:true, margin:0 });
}

// ══════════════════════════════════════════════════════════════════
// TIPO 1 — FICHA TÉCNICA INDIVIDUAL
// ══════════════════════════════════════════════════════════════════
async function generarFichaTecnica(lote) {
  await ensureLogos();
  const PptxGenJS = window.PptxGenJS;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = `Ficha Técnica — ${lote.nombre}`;

  const precio = lote.precio_total || (lote.sup_m2 * lote.precio_m2) || 0;

  // SLIDE 1 — PORTADA
  const s1 = pres.addSlide();
  s1.background = { color: C.navy };
  s1.addShape(pres.shapes.RECTANGLE, { x:6.8, y:0, w:3.2, h:5.625, fill:{ color:C.gold }, line:{ color:C.gold } });
  if (LOGO_ML_B64) s1.addImage({ data:LOGO_ML_B64, x:0.5, y:0.38, w:3.5, h:0.59 });
  s1.addText("FICHA TÉCNICA DE MACROLOTE", { x:0.5, y:1.28, w:5.8, h:0.3, fontSize:10, bold:true, color:C.gold, charSpacing:3, margin:0 });
  s1.addText(lote.nombre || "Lote", { x:0.5, y:1.62, w:5.8, h:1.0, fontSize:38, bold:true, color:C.white, fontFace:"Arial", wrap:true, margin:0 });
  s1.addText(lote.desarrollo || "", { x:0.5, y:2.7, w:5.8, h:0.4, fontSize:16, color:C.gold, margin:0 });
  s1.addText(`${lote.ciudad || ""}, ${lote.estado || ""}  ·  ${lote.uso || ""}`, { x:0.5, y:3.12, w:5.8, h:0.3, fontSize:12, color:"A0B4C5", margin:0 });
  s1.addText(fmtM(precio), { x:0.5, y:3.55, w:5.8, h:0.72, fontSize:34, bold:true, color:C.white, fontFace:"Arial", margin:0 });
  const kpis = [
    [fmtNum(lote.sup_m2) + " m²", "SUPERFICIE"],
    ["$" + fmtNum(lote.precio_m2) + "/m²", "PRECIO/M²"],
    [String(lote.cus || "N/D"), "CUS"],
    [String(lote.niveles || "N/D"), "NIVELES"],
  ];
  kpis.forEach(([val, lbl], i) => {
    const ky = 0.5 + i * 1.22;
    s1.addText(val, { x:7.1, y:ky, w:2.8, h:0.6, fontSize:18, bold:true, color:C.navy, fontFace:"Arial", align:"center", margin:0 });
    s1.addText(lbl, { x:7.1, y:ky+0.55, w:2.8, h:0.22, fontSize:8, bold:true, color:C.navyMid, align:"center", charSpacing:2, margin:0 });
    if (i < 3) s1.addShape(pres.shapes.RECTANGLE, { x:7.3, y:ky+0.82, w:2.4, h:0.02, fill:{ color:"E8A020" }, line:{ color:"E8A020" } });
  });
  s1.addShape(pres.shapes.RECTANGLE, { x:0, y:5.35, w:10, h:0.275, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  s1.addText("CONFIDENCIAL · MacroPro · Grupo Guía · Dirección de Macro Lotes · www.grupoguia.mx", { x:0.3, y:5.36, w:9.4, h:0.25, fontSize:7, color:C.gold, align:"center", margin:0 });

  // SLIDE 2 — DATOS TÉCNICOS
  const s2 = pres.addSlide();
  s2.background = { color: C.offW };
  addHeader(pres, s2, `${lote.nombre} — Datos Técnicos`, `${lote.id || ""} · ${lote.desarrollo || ""} · ${lote.ciudad}, ${lote.estado}`);
  addFooter(s2);
  const kpi2 = [
    ["SUPERFICIE", fmtNum(lote.sup_m2) + " m²"],
    ["PRECIO/M²",  "$" + fmtNum(lote.precio_m2)],
    ["PRECIO TOTAL", fmtM(precio)],
    ["CUS", String(lote.cus || "N/D")],
    ["COS", String(lote.cos || "N/D")],
    ["NIVELES", String(lote.niveles || "N/D")],
  ];
  kpi2.forEach(([lbl,val], i) => kpiBox(s2, 0.3 + i*1.6, 2.1, 1.5, 0.9, lbl, val, i===2 ? C.navyMid : C.navy));
  const cards1 = [["Uso de Suelo", lote.uso, true], ["Desarrollo", lote.desarrollo, false], ["Ciudad", lote.ciudad, false], ["Estado", lote.estado, false], ["Colonia / Corredor", lote.colonia, false]];
  cards1.forEach(([lbl,val,acc], i) => infoCard(s2, 0.3 + i*1.9, 3.15, 1.8, 0.68, lbl, val, acc));
  const cards2 = [["Estatus Legal", lote.estatus_legal], ["Topografía", lote.topografia], ["Agua Potable", lote.agua], ["Energía Eléctrica", lote.luz], ["Acceso a Vialidad", lote.acceso]];
  cards2.forEach(([lbl,val], i) => infoCard(s2, 0.3 + i*1.9, 3.97, 1.8, 0.68, lbl, val));

  // SLIDE 3 — ARGUMENTOS COMERCIALES
  const s3 = pres.addSlide();
  s3.background = { color: C.offW };
  addHeader(pres, s3, "Argumentos Comerciales", "Por qué este activo es una oportunidad única");
  addFooter(s3);
  s3.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.15, w:9.4, h:0.85, fill:{ color:C.navy }, shadow:makeShadow(), line:{ color:C.navy } });
  s3.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.15, w:0.12, h:0.85, fill:{ color:C.gold }, line:{ color:C.gold } });
  s3.addText("⭐  FORTALEZA PRINCIPAL", { x:0.5, y:2.18, w:9, h:0.22, fontSize:8, bold:true, color:C.gold, charSpacing:2, margin:0 });
  s3.addText(lote.fortaleza || "Ver ficha técnica completa", { x:0.5, y:2.38, w:9, h:0.55, fontSize:12, color:C.white, wrap:true, margin:0 });
  const atribs = (lote.atributos || "").split(".").map(s=>s.trim()).filter(Boolean);
  argBlock(s3, 0.3, 3.12, 4.55, 1.82, "✦  ATRIBUTOS ESTRATÉGICOS", atribs.length ? atribs : ["Ver ficha técnica completa"], C.goldLt, C.navyMid);
  s3.addShape(pres.shapes.RECTANGLE, { x:5.15, y:3.12, w:4.55, h:1.82, fill:{ color:"EEF4FF" }, line:{ color:C.grey1 }, shadow:makeShadow() });
  s3.addText("🎯  COMPRADOR IDEAL", { x:5.27, y:3.2, w:4.3, h:0.22, fontSize:8, bold:true, color:C.navyMid, charSpacing:1, margin:0 });
  s3.addText(lote.comprador || "Desarrollador inmobiliario", { x:5.27, y:3.42, w:4.3, h:1.45, fontSize:11, color:C.navy, wrap:true, margin:0 });

  // SLIDE 4 — UBICACIÓN
  const s4 = pres.addSlide();
  s4.background = { color: C.offW };
  addHeader(pres, s4, "Ubicación Estratégica", `${lote.ciudad}, ${lote.estado} · ${lote.desarrollo || ""}`);
  addFooter(s4);
  s4.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.15, w:5.8, h:3.0, fill:{ color:C.grey1 }, line:{ color:C.grey1 } });
  s4.addText([
    { text:"📍\n", options:{ fontSize:30, breakLine:true } },
    { text:"INSERTAR MAPA AQUÍ\n", options:{ fontSize:14, bold:true, color:C.grey3, breakLine:true } },
    { text:`Google Maps: ${lote.ciudad}, ${lote.estado}`, options:{ fontSize:10, color:C.grey2 } },
  ], { x:0.8, y:3.0, w:4.8, h:1.5, align:"center" });
  const locData = [["Ciudad", lote.ciudad], ["Estado", lote.estado], ["Colonia / Corredor", lote.colonia || "Ver expediente"], ["Desarrollo", lote.desarrollo], ["Acceso", lote.acceso || "Ver expediente"], ["Entrega", lote.entrega || "Inmediata"]];
  locData.forEach(([lbl,val], i) => {
    const col = Math.floor(i/3), row = i%3;
    infoCard(s4, 6.3 + col*1.85, 2.15 + row*1.0, 1.75, 0.88, lbl, val, i===0);
  });

  await pres.writeFile({ fileName: `MacroPro_FichaTecnica_${(lote.nombre||"lote").replace(/[^a-zA-Z0-9]/g,"-")}.pptx` });
}

// ══════════════════════════════════════════════════════════════════
// TIPO 2 — MATCH LOTE → CLIENTES
// ══════════════════════════════════════════════════════════════════
async function generarMatchLoteClientes(lote, resultados) {
  await ensureLogos();
  const PptxGenJS = window.PptxGenJS;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = `Match Lote-Clientes — ${lote.nombre}`;
  const precio = lote.precio_total || (lote.sup_m2 * lote.precio_m2) || 0;

  // PORTADA
  const s1 = pres.addSlide();
  s1.background = { color: C.navy };
  s1.addShape(pres.shapes.RECTANGLE, { x:0, y:4.5, w:10, h:1.125, fill:{ color:C.gold }, line:{ color:C.gold } });
  if (LOGO_ML_B64) s1.addImage({ data:LOGO_ML_B64, x:0.5, y:0.35, w:3.2, h:0.54 });
  s1.addText("REPORTE DE MATCHING", { x:0.5, y:1.2, w:9, h:0.35, fontSize:10, bold:true, color:C.gold, charSpacing:3, margin:0 });
  s1.addText("Lote → Clientes Potenciales", { x:0.5, y:1.55, w:9, h:0.6, fontSize:28, bold:true, color:C.white, fontFace:"Arial", margin:0 });
  s1.addText(`${lote.nombre}  ·  ${lote.desarrollo || lote.ciudad}`, { x:0.5, y:2.2, w:9, h:0.4, fontSize:16, color:C.gold, margin:0 });
  s1.addText(`${lote.uso || ""}  ·  ${fmtNum(lote.sup_m2)} m²  ·  ${fmtM(precio)}`, { x:0.5, y:2.62, w:9, h:0.3, fontSize:12, color:"A0B4C5", margin:0 });
  s1.addText(`${resultados.length}`, { x:0.5, y:3.1, w:1.2, h:0.9, fontSize:52, bold:true, color:C.white, fontFace:"Arial", align:"center", margin:0 });
  s1.addText("CLIENTES\nRANKEADOS", { x:1.8, y:3.3, w:2.5, h:0.7, fontSize:12, bold:true, color:C.gold, wrap:true, margin:0 });
  s1.addText(`Top score: ${resultados[0]?.score || "--"}`, { x:4.5, y:3.3, w:3, h:0.4, fontSize:14, color:C.white, margin:0 });
  s1.addShape(pres.shapes.RECTANGLE, { x:0, y:5.35, w:10, h:0.275, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  s1.addText("CONFIDENCIAL · MacroPro · Grupo Guía · Dirección de Macro Lotes", { x:0.3, y:5.36, w:9.4, h:0.25, fontSize:7, color:C.gold, align:"center", margin:0 });

  // RESUMEN LOTE
  const s2 = pres.addSlide();
  s2.background = { color: C.offW };
  addHeader(pres, s2, `${lote.nombre} — Activo en Oferta`, `${lote.id || ""}  ·  ${lote.ciudad}, ${lote.estado}  ·  ${lote.uso}`);
  addFooter(s2);
  const kpis = [["SUPERFICIE", fmtNum(lote.sup_m2)+" m²"],["PRECIO/M²","$"+fmtNum(lote.precio_m2)],["PRECIO TOTAL",fmtM(precio)],["CUS",String(lote.cus||"N/D")],["ENTREGA",lote.entrega||"Inmediata"]];
  kpis.forEach(([l,v],i) => kpiBox(s2, 0.3+i*1.9, 2.15, 1.8, 0.9, l, v, i===2 ? C.navyMid : C.navy));
  s2.addShape(pres.shapes.RECTANGLE, { x:0.3, y:3.18, w:9.4, h:1.82, fill:{ color:C.navy }, shadow:makeShadow(), line:{ color:C.navy } });
  s2.addShape(pres.shapes.RECTANGLE, { x:0.3, y:3.18, w:0.12, h:1.82, fill:{ color:C.gold }, line:{ color:C.gold } });
  s2.addText("FORTALEZA PRINCIPAL", { x:0.52, y:3.24, w:9, h:0.22, fontSize:8, bold:true, color:C.gold, charSpacing:2, margin:0 });
  s2.addText(lote.fortaleza || "Ver ficha técnica completa", { x:0.52, y:3.46, w:8.9, h:1.45, fontSize:12, color:C.white, wrap:true, margin:0 });

  // UN CLIENTE POR SLIDE (top 5)
  resultados.slice(0, 5).forEach((r, idx) => {
    const sc = pres.addSlide();
    sc.background = { color: C.offW };
    addHeader(pres, sc, `#${idx+1} — ${r.nombre || r.id}`, `${r.empresa || ""}  ·  Score: ${r.score}/100  ·  ${r.match_label || ""}`);
    addFooter(sc);
    scoreCircle(sc, 8.55, 2.0, r.score);
    sc.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.0, w:8.0, h:0.72, fill:{ color:C.navy }, shadow:makeShadow(), line:{ color:C.navy } });
    sc.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.0, w:0.12, h:0.72, fill:{ color:C.gold }, line:{ color:C.gold } });
    sc.addText(r.razon_principal || "Alta compatibilidad con el perfil del cliente", { x:0.52, y:2.06, w:7.7, h:0.6, fontSize:11, bold:true, color:C.white, wrap:true, margin:0 });
    argBlock(sc, 0.3, 2.85, 3.55, 2.1, "✦  ARGUMENTOS DE VENTA", r.argumentos || [], C.greenLt, C.green);
    argBlock(sc, 4.05, 2.85, 2.55, 2.1, "⚠  POSIBLE OBJECIÓN", [r.objeccion || "Sin objeciones identificadas"], C.redLt, C.red);
    argBlock(sc, 6.78, 2.85, 2.92, 2.1, "⚡  URGENCIA / CIERRE", [r.urgencia || "Seguimiento en próximas 48 horas"], C.goldLt, "92600A");
  });

  // RANKING FINAL
  const sf = pres.addSlide();
  sf.background = { color: C.navy };
  sf.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:1.1, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  if (LOGO_ML_B64) sf.addImage({ data:LOGO_ML_B64, x:0.35, y:0.18, w:2.2, h:0.37 });
  sf.addText("RANKING COMPLETO", { x:0.35, y:1.25, w:9.3, h:0.38, fontSize:11, bold:true, color:C.gold, charSpacing:2, margin:0 });
  sf.addText(`${lote.nombre}  ·  ${resultados.length} clientes rankeados`, { x:0.35, y:1.63, w:9.3, h:0.5, fontSize:18, bold:true, color:C.white, margin:0 });
  const tHeader = [[
    { text:"#",       options:{ bold:true, color:C.white, fill:{ color:C.navyMid }, align:"center" } },
    { text:"CLIENTE", options:{ bold:true, color:C.white, fill:{ color:C.navyMid } } },
    { text:"EMPRESA", options:{ bold:true, color:C.white, fill:{ color:C.navyMid } } },
    { text:"SCORE",   options:{ bold:true, color:C.white, fill:{ color:C.navyMid }, align:"center" } },
    { text:"MATCH",   options:{ bold:true, color:C.white, fill:{ color:C.navyMid } } },
  ]];
  const tRows = resultados.slice(0,6).map((r,i) => [
    { text:String(i+1), options:{ align:"center", bold:true, color:C.gold } },
    { text:r.nombre || r.id || "" },
    { text:r.empresa || "", options:{ color:C.grey2 } },
    { text:String(r.score), options:{ align:"center", bold:true, color: r.score>=80 ? C.green : r.score>=60 ? "D97706" : C.red } },
    { text:r.match_label || "" },
  ]);
  sf.addTable([...tHeader, ...tRows], { x:0.35, y:2.25, w:9.3, h:2.9, colW:[0.4,2.5,2.5,0.8,3.1], border:{ pt:0.5, color:"1E3245" }, fill:{ color:"051828" }, color:C.white, fontSize:10, fontFace:"Arial", rowH:0.42 });
  sf.addShape(pres.shapes.RECTANGLE, { x:0, y:5.35, w:10, h:0.275, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  sf.addText("CONFIDENCIAL · MacroPro · Grupo Guía · Dirección de Macro Lotes", { x:0.3, y:5.36, w:9.4, h:0.25, fontSize:7, color:C.gold, align:"center", margin:0 });

  const fn = `MacroPro_Match_Lote_${(lote.nombre||"lote").replace(/[^a-zA-Z0-9]/g,"-")}.pptx`;
  await pres.writeFile({ fileName: fn });
}

// ══════════════════════════════════════════════════════════════════
// TIPO 3 — MATCH CLIENTE → LOTES
// ══════════════════════════════════════════════════════════════════
async function generarMatchClienteLotes(cliente, resultados) {
  await ensureLogos();
  const PptxGenJS = window.PptxGenJS;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = `Propuesta — ${cliente.nombre}`;

  // PORTADA
  const s1 = pres.addSlide();
  s1.background = { color: C.navy };
  s1.addShape(pres.shapes.RECTANGLE, { x:7.5, y:0, w:2.5, h:5.625, fill:{ color:C.gold }, line:{ color:C.gold } });
  if (LOGO_ML_B64) s1.addImage({ data:LOGO_ML_B64, x:0.5, y:0.35, w:3.2, h:0.54 });
  s1.addText("PROPUESTA PERSONALIZADA DE MACROLOTES", { x:0.5, y:1.25, w:6.8, h:0.35, fontSize:9, bold:true, color:C.gold, charSpacing:2, margin:0 });
  s1.addText(cliente.nombre || "Cliente", { x:0.5, y:1.6, w:6.8, h:0.9, fontSize:30, bold:true, color:C.white, fontFace:"Arial", wrap:true, margin:0 });
  s1.addText(cliente.empresa || "", { x:0.5, y:2.55, w:6.8, h:0.4, fontSize:16, color:C.gold, margin:0 });
  s1.addText([
    { text:"Presupuesto: ", options:{ color:"A0B4C5", fontSize:11 } },
    { text:`${fmtM(cliente.presupuesto_min)} – ${fmtM(cliente.presupuesto_max)}`, options:{ color:C.white, bold:true, fontSize:11 } },
  ], { x:0.5, y:3.0, w:6.8, h:0.35, margin:0 });
  s1.addText([
    { text:"Uso buscado: ", options:{ color:"A0B4C5", fontSize:11 } },
    { text:(cliente.uso_interes||[]).join(", "), options:{ color:C.white, bold:true, fontSize:11 } },
  ], { x:0.5, y:3.38, w:6.8, h:0.35, margin:0 });
  s1.addText(`${resultados.length}`, { x:7.65, y:1.2, w:2.2, h:1.0, fontSize:60, bold:true, color:C.navy, fontFace:"Arial", align:"center", margin:0 });
  s1.addText("LOTES\nRECOMENDADOS", { x:7.65, y:2.2, w:2.2, h:0.8, fontSize:11, bold:true, color:C.navy, align:"center", wrap:true, margin:0 });
  s1.addText(`Mejor match: ${resultados[0]?.score || "--"}/100`, { x:7.65, y:3.2, w:2.2, h:0.35, fontSize:11, color:C.navy, align:"center", bold:true, margin:0 });
  s1.addShape(pres.shapes.RECTANGLE, { x:0, y:5.35, w:10, h:0.275, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  s1.addText("CONFIDENCIAL · MacroPro · Grupo Guía · Dirección de Macro Lotes", { x:0.3, y:5.36, w:9.4, h:0.25, fontSize:7, color:C.gold, align:"center", margin:0 });

  // PERFIL DEL CLIENTE
  const s2 = pres.addSlide();
  s2.background = { color: C.offW };
  addHeader(pres, s2, `Perfil del Cliente — ${cliente.nombre}`, `${cliente.empresa || ""}  ·  Asesor: ${cliente.asesor || "Director"}`);
  addFooter(s2);
  const pCards = [
    ["Tipo de Comprador", cliente.tipo || "Desarrollador"],
    ["Ciudades de Interés", (cliente.ciudad_interes||[]).join(", ")],
    ["Uso de Suelo Buscado", (cliente.uso_interes||[]).join(", ")],
    ["Presupuesto Mín", fmtM(cliente.presupuesto_min)],
    ["Presupuesto Máx", fmtM(cliente.presupuesto_max)],
    ["Superficie Mínima", fmtNum(cliente.sup_min)+" m²"],
    ["Superficie Máxima", fmtNum(cliente.sup_max)+" m²"],
    ["Plazo para Cerrar", cliente.plazo || "3 meses"],
    ["Temperatura", cliente.temperatura || "Tibio"],
    ["Status CRM", cliente.status || "Activo"],
  ];
  pCards.forEach(([lbl,val], i) => {
    infoCard(s2, 0.3 + (i%5)*1.9, 2.15 + Math.floor(i/5)*1.1, 1.8, 0.92, lbl, val, i===3||i===4);
  });
  if (cliente.notas) {
    s2.addShape(pres.shapes.RECTANGLE, { x:0.3, y:4.42, w:9.4, h:0.65, fill:{ color:C.goldLt }, line:{ color:C.gold } });
    s2.addText("NOTAS DEL ASESOR", { x:0.45, y:4.46, w:9, h:0.18, fontSize:7, bold:true, color:C.navyMid, charSpacing:1, margin:0 });
    s2.addText(cliente.notas, { x:0.45, y:4.62, w:9, h:0.4, fontSize:10, color:C.navy, wrap:true, margin:0 });
  }

  // UN LOTE POR SLIDE (top 5)
  resultados.slice(0, 5).forEach((r, idx) => {
    const pr = r.precio_total || (r.sup_m2 * r.precio_m2) || 0;
    const sl = pres.addSlide();
    sl.background = { color: C.offW };
    addHeader(pres, sl, `#${idx+1} — ${r.nombre || r.id}`, `${r.desarrollo||""}  ·  ${r.ciudad}, ${r.estado}  ·  ${r.uso}  ·  Score: ${r.score}/100`);
    addFooter(sl);
    scoreCircle(sl, 8.55, 2.0, r.score);
    const lKpis = [["SUPERFICIE", fmtNum(r.sup_m2)+" m²"],["PRECIO/M²","$"+fmtNum(r.precio_m2)],["PRECIO TOTAL",fmtM(pr)],["CUS",String(r.cus||"N/D")],["ENTREGA",r.entrega||"Inmediata"]];
    lKpis.forEach(([l,v],i) => kpiBox(sl, 0.3+i*1.6, 2.05, 1.5, 0.78, l, v, i===2 ? C.navyMid : C.navy));
    sl.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.95, w:8.0, h:0.68, fill:{ color:C.navyLt }, shadow:makeShadow(), line:{ color:C.navyLt } });
    sl.addShape(pres.shapes.RECTANGLE, { x:0.3, y:2.95, w:0.12, h:0.68, fill:{ color:C.gold }, line:{ color:C.gold } });
    sl.addText(r.razon_principal || "Alta compatibilidad", { x:0.52, y:2.99, w:7.7, h:0.58, fontSize:11, bold:true, color:C.white, wrap:true, margin:0 });
    argBlock(sl, 0.3, 3.76, 3.55, 1.45, "✦  ARGUMENTOS DE VENTA", r.argumentos||[], C.greenLt, C.green);
    argBlock(sl, 4.05, 3.76, 2.55, 1.45, "⚠  POSIBLE OBJECIÓN", [r.objeccion||"Sin objeciones identificadas"], C.redLt, C.red);
    argBlock(sl, 6.78, 3.76, 2.92, 1.45, "⚡  URGENCIA / CIERRE", [r.urgencia||"Agendar visita esta semana"], C.goldLt, "92600A");
  });

  // TABLA COMPARATIVA
  const sf = pres.addSlide();
  sf.background = { color: C.navy };
  sf.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:10, h:1.1, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  if (LOGO_ML_B64) sf.addImage({ data:LOGO_ML_B64, x:0.35, y:0.18, w:2.2, h:0.37 });
  sf.addText("TABLA COMPARATIVA DE LOTES", { x:0.35, y:1.25, w:9.3, h:0.38, fontSize:11, bold:true, color:C.gold, charSpacing:2, margin:0 });
  sf.addText(`${cliente.nombre}  ·  ${resultados.length} opciones rankeadas`, { x:0.35, y:1.63, w:9.3, h:0.5, fontSize:18, bold:true, color:C.white, margin:0 });
  const th = [[
    { text:"#",          options:{ bold:true, color:C.white, fill:{ color:C.navyMid }, align:"center" } },
    { text:"LOTE",       options:{ bold:true, color:C.white, fill:{ color:C.navyMid } } },
    { text:"CIUDAD",     options:{ bold:true, color:C.white, fill:{ color:C.navyMid } } },
    { text:"USO",        options:{ bold:true, color:C.white, fill:{ color:C.navyMid } } },
    { text:"SUPERFICIE", options:{ bold:true, color:C.white, fill:{ color:C.navyMid }, align:"center" } },
    { text:"PRECIO",     options:{ bold:true, color:C.white, fill:{ color:C.navyMid }, align:"center" } },
    { text:"SCORE",      options:{ bold:true, color:C.white, fill:{ color:C.navyMid }, align:"center" } },
  ]];
  const tr = resultados.slice(0,6).map((r,i) => {
    const pr = r.precio_total || (r.sup_m2*r.precio_m2) || 0;
    return [
      { text:String(i+1), options:{ align:"center", bold:true, color:C.gold } },
      { text:r.nombre||r.id||"", options:{ bold:true } },
      { text:r.ciudad||"", options:{ color:C.grey2 } },
      { text:r.uso||"", options:{ color:C.grey2 } },
      { text:fmtNum(r.sup_m2)+" m²", options:{ align:"center" } },
      { text:fmtM(pr), options:{ align:"center", bold:true, color:C.gold } },
      { text:String(r.score), options:{ align:"center", bold:true, color: r.score>=80 ? C.green : r.score>=60 ? "D97706" : C.red } },
    ];
  });
  sf.addTable([...th, ...tr], { x:0.35, y:2.28, w:9.3, h:2.9, colW:[0.35,1.8,1.5,1.7,1.3,1.2,0.7], border:{ pt:0.5, color:"1E3245" }, fill:{ color:"051828" }, color:C.white, fontSize:9, fontFace:"Arial", rowH:0.42 });
  sf.addShape(pres.shapes.RECTANGLE, { x:0, y:5.35, w:10, h:0.275, fill:{ color:"001E35" }, line:{ color:"001E35" } });
  sf.addText("CONFIDENCIAL · MacroPro · Grupo Guía · Dirección de Macro Lotes", { x:0.3, y:5.36, w:9.4, h:0.25, fontSize:7, color:C.gold, align:"center", margin:0 });

  const fn = `MacroPro_Propuesta_${(cliente.nombre||"cliente").replace(/[^a-zA-Z0-9]/g,"-")}.pptx`;
  await pres.writeFile({ fileName: fn });
}

// ── PUBLIC API ────────────────────────────────────────────────────
export { generarFichaTecnica, generarMatchLoteClientes, generarMatchClienteLotes };
