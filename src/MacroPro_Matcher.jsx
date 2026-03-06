import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── BRAND TOKENS ────────────────────────────────────────────────
const B = {
  navy: "#002B49", navyD: "#001a2e", navyL: "#0a3d5c",
  gold: "#F5B335", goldD: "#d4952a", goldL: "#ffd678",
  white: "#FFFFFF", offW: "#F8FAFC",
  grey1: "#E8EDF2", grey2: "#C5D0DC", grey3: "#8FA3B4",
  grey4: "#4A6175", grey5: "#1E3245",
  green: "#1a8a4a", greenL: "#e6f7ed",
  red: "#c0392b", redL: "#fdecea",
  blue: "#2563AC", blueL: "#EEF4FF",
};

// ─── SAMPLE INVENTORY (25 lotes Capital Norte + Capital Sur) ──────
const SAMPLE_INVENTORY = [
  { id:"CN-001", nombre:"G2-10B", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Habitacional Vertical", sup_m2:9145.41, precio_m2:8000, precio_total:73163280, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:76, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Avenida principal", fortaleza:"Habitacional vertical con vistas directas a reserva natural protegida, a pie de avenida principal en el acceso al desarrollo.", atributos:"Vistas a reserva natural protegida. Acceso directo a desarrollo consolidado. 76 viviendas máx. Financiamiento directo disponible.", comprador:"Desarrollador habitacional vertical", asesor:"" },
  { id:"CN-002", nombre:"G2-8B", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Mixto H+C", sup_m2:6684.21, precio_m2:8000, precio_total:53473680, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:55, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Avenida principal alto flujo", fortaleza:"Uso mixto frente a avenida de alto flujo, colindante con tienda de conveniencia y a 50m de glorieta estratégica.", atributos:"Colinda con condominio Manzanos. Contra esquina Instituto Tepeyac. A 50m de glorieta Capital Norte-Abié-Valle Imperial.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CN-003", nombre:"G2-8A", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Mixto H+C", sup_m2:15503.22, precio_m2:8000, precio_total:124025760, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:129, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Avenida principal", fortaleza:"Mayor lote mixto de Capital Norte, contra esquina Instituto Tepeyac, vistas a reserva natural, 30m de glorieta estratégica.", atributos:"Lote de mayor superficie mixta del desarrollo. Vista directa a reserva natural protegida. Acceso a vialidad de alto flujo.", comprador:"Desarrollador de usos mixtos", asesor:"" },
  { id:"CN-004", nombre:"G2-5", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Habitacional Vertical", sup_m2:11501.42, precio_m2:8000, precio_total:92011360, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:95, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Avenida principal", fortaleza:"Habitacional vertical parte alta Capital Norte, 190 KVA disponibles, vistas a reserva natural.", atributos:"Mayor suministro eléctrico del grupo (190 KVA). 95 viviendas máx. Vistas privilegiadas a reserva natural.", comprador:"Desarrollador habitacional vertical", asesor:"" },
  { id:"CN-005", nombre:"F11-1", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Mixto H+C", sup_m2:2213.73, precio_m2:10000, precio_total:22137300, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:48, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Vialidad directa", fortaleza:"Mixto colindante con condominio TERRA, próximo a Hospital Santa María Chapalita y parque lineal.", atributos:"Vistas a El Diente y Bosque El Nixticuil. Entorno habitacional consolidado con hospital próximo.", comprador:"Desarrollador de usos mixtos", asesor:"" },
  { id:"CN-006", nombre:"F6-2-3B", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Mixto H+C", sup_m2:3151.51, precio_m2:9500, precio_total:29939345, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Hasta 50 niveles", viv_max:83, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Vialidad conectora multi-comunidades", fortaleza:"ÚNICO lote en Capital Norte con hasta 50 niveles permitidos — oportunidad de torre icónica.", atributos:"El único lote del desarrollo que permite hasta 50 niveles. Ubicación elevada con vistas panorámicas. Índice edificación 240.", comprador:"Desarrollador habitacional vertical", asesor:"" },
  { id:"CN-007", nombre:"F6-2-1", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Comercial / Retail", sup_m2:3151.51, precio_m2:9500, precio_total:29939345, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Vialidad conectora multi-comunidades", fortaleza:"Único lote 100% comercial sobre vialidad estratégica de alto flujo que conecta múltiples comunidades.", atributos:"Uso comercial puro. Flujo constante Capital Norte-ALVA-Alva Apartments-Plenares. Índice edificación 370.", comprador:"Retailer / Tienda de conveniencia", asesor:"" },
  { id:"CN-008", nombre:"F4-1-4", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Comercial / Retail", sup_m2:699.54, precio_m2:12000, precio_total:8394480, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Zona 100% comercial", fortaleza:"Zona comercial pura, 300m del Hospital Santa María próxima apertura — tráfico garantizado.", atributos:"Todos los predios colindantes son comerciales. Hospital próximo generador de tráfico. Plaza comercial proyectada.", comprador:"Retailer / Tienda de conveniencia", asesor:"" },
  { id:"CN-009", nombre:"F4-1-3", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Comercial / Retail", sup_m2:699.54, precio_m2:12000, precio_total:8394480, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Zona 100% comercial", fortaleza:"Lote comercial colindante F4-1-4, opción de compra conjunta para superficie mayor.", atributos:"Compra conjunta con F4-1-4 = ~1,400m². Hospital Santa María próxima apertura a 300m.", comprador:"Retailer / Tienda de conveniencia", asesor:"" },
  { id:"CN-010", nombre:"F4-1-2", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Comercial / Retail", sup_m2:776.70, precio_m2:12000, precio_total:9320400, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Zona 100% comercial", fortaleza:"Mayor lote del clúster F4-1, adquisición conjunta posible = 2,175m² comerciales.", atributos:"Mayor superficie del clúster comercial F4-1. Compra conjunta F4-1-2+3+4 viable.", comprador:"Retailer / Tienda de conveniencia", asesor:"" },
  { id:"CN-011", nombre:"F1-2", desarrollo:"Capital Norte", ciudad:"Zapopan", estado:"Jalisco", uso:"Mixto H+C", sup_m2:11469.44, precio_m2:10000, precio_total:114694400, status:"Disponible", entrega:"Inmediata", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:163, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"2 vialidades directas", fortaleza:"Frente al Parque del Lago de Capital Norte, el principal espacio recreativo, acceso a DOS vialidades.", atributos:"Vista al Parque del Lago. Frente a torre ALTURES consolidada. Acceso a dos vialidades. 163 viviendas máx.", comprador:"Desarrollador de usos mixtos", asesor:"" },
  { id:"CN-012", nombre:"E1SB1-28", desarrollo:"Capital Norte — Sierra Bosque", ciudad:"Zapopan", estado:"Jalisco", uso:"Mixto H+C", sup_m2:1661.76, precio_m2:11750, precio_total:19525680, status:"Disponible", entrega:"Preventa", cos:0.7, cus:2.1, niveles:"Según COS y CUS", viv_max:44, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Avenida alto flujo proyectada", fortaleza:"PREVENTA etapa Sierra Bosque — precio de entrada antes de plusvalía. 200m del Hospital Santa María.", atributos:"En preventa. Nueva etapa Sierra Bosque. A 200m Hospital Santa María Chapalita Capital Norte. Agua incorporada.", comprador:"Desarrollador de usos mixtos", asesor:"" },
  { id:"CS-001", nombre:"Manzana 3 L13", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:5000, precio_m2:5000, precio_total:25000000, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"30,000m² construibles en 10 niveles, escriturado, entrega inmediata en ZM Querétaro.", atributos:"CUS 6.0 = 30,000m² construibles. Escriturado. Estudios generales disponibles. ZM Querétaro en expansión.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-002", nombre:"Manzana 21 L9", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:2753.19, precio_m2:5200, precio_total:14316603, status:"Disponible", entrega:"12 meses", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"16,519m² construibles en 10 niveles en ZM Querétaro de mayor crecimiento económico.", atributos:"CUS 6.0. Estudios generales disponibles. Escriturado. Pendiente 7% — favorable.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-003", nombre:"Manzana 21 L10", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:1280.64, precio_m2:5200, precio_total:6659322, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"Lote accesible desde $6.6 MDP en ZM Querétaro con 7,683m² construibles.", atributos:"CUS 6.0. Escriturado. Entrega inmediata. Precio competitivo $5,200/m².", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-004", nombre:"Manzana 21 L11", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:1275.66, precio_m2:5200, precio_total:6633432, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"Lote comercial escriturado con entrega inmediata en Capital Sur.", atributos:"CUS 6.0 = 7,653m² construibles. Escriturado. Entrega inmediata. Pendiente 8.4%.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-005", nombre:"Manzana 21 L12", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:2359.40, precio_m2:5200, precio_total:12268900, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"14,156m² construibles en ZM Querétaro con entrega inmediata.", atributos:"CUS 6.0. Escriturado. Estudios generales disponibles para due diligence rápida.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-006", nombre:"Manzana 46 L1", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:3425.54, precio_m2:5200, precio_total:17812828, status:"Disponible", entrega:"Dic 2027", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"20,553m² construibles en Capital Sur, pendiente favorable 3.87%.", atributos:"CUS 6.0. Estudios disponibles. Entrega Dic 2027. Pendiente leve muy favorable.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-007", nombre:"Manzana 46 L2", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:2995.68, precio_m2:5200, precio_total:15577551, status:"Disponible", entrega:"Dic 2027", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"17,974m² construibles, Manzana 46 con pendiente mínima 4.9%.", atributos:"CUS 6.0. Escriturado. Pendiente muy leve. Adyacente Manzana 46 L1.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-008", nombre:"Manzana 21 L3", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Mixto H+C", sup_m2:19048.72, precio_m2:3800, precio_total:72385128, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:180, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"Mayor lote de Capital Sur: 114,292m² construibles, uso mixto, 180 viviendas permitidas, entrega inmediata.", atributos:"Mayor superficie del desarrollo (19,048m²). 114,292m² construibles. Densidad 180 unidades. Precio $3,800/m².", comprador:"Desarrollador de usos mixtos", asesor:"" },
  { id:"CS-009", nombre:"Manzana 21 L8", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Mixto H+C", sup_m2:7482.89, precio_m2:4500, precio_total:33673009, status:"Disponible", entrega:"12 meses", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:126, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"44,897m² construibles mixto, 126 unidades habitacionales, ZM Querétaro.", atributos:"CUS 6.0. 126 unidades. Uso mixto H+C. Pendiente 2.60% — el más plano de la manzana.", comprador:"Desarrollador de usos mixtos", asesor:"" },
  { id:"CS-010", nombre:"Manzana 21 L4", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:2714.98, precio_m2:5000, precio_total:13574915, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"16,289m² construibles comerciales, precio competitivo $5,000/m².", atributos:"CUS 6.0. Escriturado. Entrega inmediata. Precio intermedio competitivo.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-011", nombre:"Manzana 21 L5", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:2960.16, precio_m2:3800, precio_total:11248623, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"Mejor precio/m² de Capital Sur a $3,800/m², 17,760m² construibles.", atributos:"Precio más bajo del portafolio Capital Sur. CUS 6.0. Escriturado. Entrega inmediata.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-012", nombre:"Manzana 21 L7", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:3324.85, precio_m2:5200, precio_total:17289235, status:"Disponible", entrega:"12 meses", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"19,949m² construibles en Capital Sur, pendiente moderada manejable 5%.", atributos:"CUS 6.0. Estudios disponibles. Pendiente 5.01%. Escriturado.", comprador:"Desarrollador comercial", asesor:"" },
  { id:"CS-013", nombre:"Manzana 13A L4", desarrollo:"Capital Sur", ciudad:"El Marqués", estado:"Querétaro", uso:"Comercial / Retail", sup_m2:1773.17, precio_m2:5200, precio_total:9220473, status:"Disponible", entrega:"Inmediata", cos:0.60, cus:6.0, niveles:"10 niveles", viv_max:0, agua:"Sí", luz:"Sí", drenaje:"Sí", acceso:"Blvd. Villas del Mesón", fortaleza:"Producto sugerido: Punto de Venta / locales comerciales. Entrega inmediata. 10,639m² construibles.", atributos:"Vocación de punto de venta y locales comerciales. CUS 6.0. Escriturado. Pendiente leve 4.26%.", comprador:"Retailer / Tienda de conveniencia", asesor:"" },
];

// ─── DEMO CLIENTS ─────────────────────────────────────────────────
const DEMO_CLIENTS = [
  { id:"CLI-001", nombre:"Martín Campos", empresa:"Campos Desarrollos", asesor:"Director", ciudad_interes:["Zapopan","El Marqués"], uso_interes:["Mixto H+C","Habitacional Vertical"], presupuesto_min:50000000, presupuesto_max:150000000, sup_min:5000, sup_max:20000, temperatura:"Caliente", status:"Negociando", notas:"Desarrollador con experiencia en vertical. Busca lote grande con servicios completos.", fecha_contacto:"2026-02-15" },
  { id:"CLI-002", nombre:"Grupo Palmar", empresa:"Palmar Inmobiliaria", asesor:"Director", ciudad_interes:["El Marqués","Zapopan"], uso_interes:["Comercial / Retail"], presupuesto_min:10000000, presupuesto_max:30000000, sup_min:1000, sup_max:5000, temperatura:"Tibio", status:"Calificado", notas:"Cadena de retail buscando expansión en Querétaro y GDL.", fecha_contacto:"2026-02-20" },
  { id:"CLI-003", nombre:"Inversiones Nortek", empresa:"Nortek Capital", asesor:"Director", ciudad_interes:["Zapopan"], uso_interes:["Mixto H+C","Comercial / Retail"], presupuesto_min:80000000, presupuesto_max:200000000, sup_min:10000, sup_max:20000, temperatura:"Caliente", status:"Presentación activa", notas:"Fondo inmobiliario buscando lote de gran formato en Capital Norte.", fecha_contacto:"2026-03-01" },
];

// ─── HELPERS ──────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN", maximumFractionDigits:0 }).format(n);
const fmtM = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)} MDP` : fmt(n);
const scoreColor = (s) => s >= 80 ? B.green : s >= 60 ? B.gold : s >= 40 ? B.blue : B.grey3;
const tempColor = (t) => t==="Caliente" ? B.red : t==="Tibio" ? B.gold : B.grey3;
const tempBg = (t) => t==="Caliente" ? B.redL : t==="Tibio" ? "#fff8e7" : B.grey1;

// ─── ICONS ────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    match: "🎯", client: "👤", lot: "🏗", filter: "⚡", score: "📊",
    city: "📍", type: "🏢", price: "💲", area: "📐", advisor: "👨‍💼",
    hot: "🔥", warm: "〰", cold: "❄", add: "➕", upload: "📤",
    download: "⬇", search: "🔍", arrow: "→", star: "★", check: "✓",
    close: "✕", menu: "☰", logo: "◆", spark: "✦", warning: "⚠",
    export: "📄", back: "←", refresh: "↺", edit: "✏",
  };
  return <span style={{ fontSize: size }}>{icons[name] || "•"}</span>;
};

// ─── SCORE RING ───────────────────────────────────────────────────
const ScoreRing = ({ score, size = 64 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={B.grey1} strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.8s ease" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize: size > 56 ? 18 : 13, fontWeight:800, color, fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{score}</span>
        <span style={{ fontSize:9, color:B.grey3, fontFamily:"'DM Sans',sans-serif" }}>SCORE</span>
      </div>
    </div>
  );
};

// ─── TAG ──────────────────────────────────────────────────────────
const Tag = ({ label, color = B.navy, bg = B.blueL }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 10px",
    borderRadius:20, fontSize:11, fontWeight:600, color, backgroundColor:bg,
    fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>
    {label}
  </span>
);

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function MacroProMatcher() {
  const [view, setView] = useState("home"); // home | matchClient | matchLot | clients | lots | result
  const [inventory, setInventory] = useState(SAMPLE_INVENTORY);
  const [clients, setClients] = useState(DEMO_CLIENTS);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [matchResults, setMatchResults] = useState(null);
  const [matchMode, setMatchMode] = useState(null); // "clientToLots" | "lotToClients"
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [filterCity, setFilterCity] = useState("Todas");
  const [filterUso, setFilterUso] = useState("Todos");
  const [filterAsesor, setFilterAsesor] = useState("Todos");
  const [filterSupMin, setFilterSupMin] = useState("");
  const [filterSupMax, setFilterSupMax] = useState("");
  const [filterPrecioMax, setFilterPrecioMax] = useState("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddLot, setShowAddLot] = useState(false);
  const [newClient, setNewClient] = useState({ nombre:"", empresa:"", asesor:"", ciudad_interes:[], uso_interes:[], presupuesto_min:"", presupuesto_max:"", sup_min:"", sup_max:"", temperatura:"Tibio", status:"Nuevo", notas:"" });
  const [toastMsg, setToastMsg] = useState("");
  const fileRef = useRef();

  const cities = ["Todas", ...new Set(inventory.map(l => l.ciudad))];
  const usos = ["Todos", ...new Set(inventory.map(l => l.uso))];
  const asesores = ["Todos", ...new Set(clients.map(c => c.asesor).filter(Boolean))];

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); };

  // ── EXCEL UPLOAD ─────────────────────────────────────────────────
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type:"binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval:"" });
        if (data.length > 0) {
          const mapped = data.map((row, i) => ({
            id: row["ID Macrolote"] || row["id"] || `LOT-${i+1}`,
            nombre: row["Nombre / Clave"] || row["nombre"] || `Lote ${i+1}`,
            desarrollo: row["Desarrollo / Proyecto"] || row["desarrollo"] || "",
            ciudad: row["Ciudad / Municipio"] || row["ciudad"] || "",
            estado: row["Estado"] || row["estado"] || "",
            uso: row["Uso de Suelo"] || row["uso_suelo"] || row["uso"] || "",
            sup_m2: parseFloat(row["Superficie (m²)"] || row["sup_m2"] || 0),
            precio_m2: parseFloat(row["Precio por m² ($MXN)"] || row["precio_m2"] || 0),
            precio_total: parseFloat(row["Precio Total ($MXN)"] || row["precio_total"] || 0),
            status: row["Status"] || row["status"] || "Disponible",
            entrega: row["Fecha Entrega"] || row["entrega"] || "",
            cos: parseFloat(row["COS"] || row["cos"] || 0),
            cus: parseFloat(row["CUS"] || row["cus"] || 0),
            niveles: row["Niveles Permitidos"] || row["niveles"] || "",
            viv_max: parseInt(row["Viviendas Máx"] || row["viv_max"] || 0),
            agua: row["Agua Potable"] || row["agua"] || "",
            luz: row["Energía Eléctrica"] || row["luz"] || "",
            drenaje: row["Drenaje Sanitario"] || row["drenaje"] || "",
            acceso: row["Acceso a Vialidad"] || row["acceso"] || "",
            fortaleza: row["Fortaleza Principal"] || row["fortaleza"] || "",
            atributos: row["Atributos Estratégicos"] || row["atributos"] || "",
            comprador: row["Comprador Ideal"] || row["comprador"] || "",
            asesor: row["Asesor Responsable"] || row["asesor"] || "",
          }));
          setInventory(mapped);
          toast(`✓ ${mapped.length} lotes cargados correctamente`);
        }
      } catch(err) { toast("⚠ Error al leer el archivo Excel"); }
    };
    reader.readAsBinaryString(file);
  };

  // ── CLAUDE MATCH ENGINE ──────────────────────────────────────────
  const runMatch = async (mode, subject, targets) => {
    setLoading(true);
    setMatchResults(null);

    const msgs = ["Analizando perfil...", "Calculando compatibilidad...", "Generando argumentos de venta...", "Rankeando resultados..."];
    let mi = 0;
    setLoadingMsg(msgs[0]);
    const interval = setInterval(() => { mi = (mi+1) % msgs.length; setLoadingMsg(msgs[mi]); }, 1800);

    try {
      let prompt = "";
      if (mode === "clientToLots") {
        prompt = `Eres el mejor estratega inmobiliario de México, especializado en macrolotes. Analiza este perfil de cliente y rankea los lotes del inventario por compatibilidad.

PERFIL DEL CLIENTE:
- Nombre: ${subject.nombre} / ${subject.empresa}
- Ciudades de interés: ${subject.ciudad_interes?.join(", ")}
- Usos de interés: ${subject.uso_interes?.join(", ")}
- Presupuesto: ${fmtM(subject.presupuesto_min)} - ${fmtM(subject.presupuesto_max)}
- Superficie buscada: ${subject.sup_min?.toLocaleString()} - ${subject.sup_max?.toLocaleString()} m²
- Temperatura: ${subject.temperatura}
- Notas: ${subject.notas}

INVENTARIO DE LOTES DISPONIBLES:
${targets.map(l => `[${l.id}] ${l.nombre} | ${l.ciudad}, ${l.estado} | ${l.uso} | ${l.sup_m2?.toLocaleString()} m² | $${l.precio_m2?.toLocaleString()}/m² | Total: ${fmtM(l.precio_total)} | Fortaleza: ${l.fortaleza}`).join("\n")}

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown:
{
  "resultados": [
    {
      "id": "CN-001",
      "score": 85,
      "match_label": "Match Excelente",
      "razon_principal": "texto corto 1 oración",
      "argumentos": ["arg1", "arg2", "arg3"],
      "objeccion": "posible objeción del cliente",
      "respuesta_objecion": "cómo responderla",
      "urgencia": "por qué actuar ahora"
    }
  ]
}
Incluye TODOS los lotes rankeados de mayor a menor score. Score 0-100.`;
      } else {
        prompt = `Eres el mejor estratega inmobiliario de México. Analiza este macrolote y rankea los clientes por compatibilidad.

MACROLOTE:
- ID: ${subject.id} | ${subject.nombre}
- Ciudad: ${subject.ciudad}, ${subject.estado}
- Uso: ${subject.uso}
- Superficie: ${subject.sup_m2?.toLocaleString()} m²
- Precio: $${subject.precio_m2?.toLocaleString()}/m² | Total: ${fmtM(subject.precio_total)}
- Fortaleza: ${subject.fortaleza}
- Atributos: ${subject.atributos}
- Comprador ideal: ${subject.comprador}

CLIENTES EN CARTERA:
${targets.map(c => `[${c.id}] ${c.nombre} / ${c.empresa} | Ciudades: ${c.ciudad_interes?.join(",")} | Usos: ${c.uso_interes?.join(",")} | Presupuesto: ${fmtM(c.presupuesto_min)}-${fmtM(c.presupuesto_max)} | Superficie: ${c.sup_min?.toLocaleString()}-${c.sup_max?.toLocaleString()} m² | Temp: ${c.temperatura} | Notas: ${c.notas}`).join("\n")}

Responde ÚNICAMENTE con JSON válido:
{
  "resultados": [
    {
      "id": "CLI-001",
      "score": 85,
      "match_label": "Match Excelente",
      "razon_principal": "texto corto 1 oración",
      "argumentos": ["arg1", "arg2", "arg3"],
      "objeccion": "posible objeción",
      "respuesta_objecion": "cómo responderla",
      "urgencia": "por qué actuar ahora"
    }
  ]
}
Incluye TODOS los clientes rankeados.`;
      }

      const response = await fetch("/.netlify/functions/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          messages: [{ role:"user", content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      // Enrich results with full data
      const enriched = parsed.resultados.map(r => {
        const item = mode === "clientToLots"
          ? targets.find(l => l.id === r.id)
          : targets.find(c => c.id === r.id);
        return { ...r, data: item };
      }).sort((a,b) => b.score - a.score);

      setMatchResults({ mode, subject, results: enriched });
      setView("result");
    } catch(err) {
      toast("⚠ Error en el análisis. Verifica la API key.");
      console.error(err);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // ── FILTER RESULTS ────────────────────────────────────────────────
  const applyFilters = (results) => {
    if (!results) return [];
    return results.filter(r => {
      const item = r.data;
      if (!item) return false;
      const isLot = matchResults?.mode === "clientToLots";
      if (isLot) {
        if (filterCity !== "Todas" && item.ciudad !== filterCity) return false;
        if (filterUso !== "Todos" && item.uso !== filterUso) return false;
        if (filterSupMin && item.sup_m2 < parseFloat(filterSupMin)) return false;
        if (filterSupMax && item.sup_m2 > parseFloat(filterSupMax)) return false;
        if (filterPrecioMax && item.precio_total > parseFloat(filterPrecioMax) * 1000000) return false;
      } else {
        if (filterAsesor !== "Todos" && item.asesor !== filterAsesor) return false;
      }
      return true;
    });
  };

  // ── ADD CLIENT ────────────────────────────────────────────────────
  const addClient = () => {
    const id = `CLI-${String(clients.length + 1).padStart(3,"0")}`;
    const ciudadArr = newClient.ciudad_interes_raw?.split(",").map(s=>s.trim()).filter(Boolean) || [];
    const usoArr = newClient.uso_interes_raw?.split(",").map(s=>s.trim()).filter(Boolean) || [];
    setClients([...clients, { ...newClient, id, ciudad_interes: ciudadArr, uso_interes: usoArr,
      presupuesto_min: parseFloat(newClient.presupuesto_min)*1000000||0,
      presupuesto_max: parseFloat(newClient.presupuesto_max)*1000000||0,
      sup_min: parseFloat(newClient.sup_min)||0,
      sup_max: parseFloat(newClient.sup_max)||0,
      fecha_contacto: new Date().toISOString().slice(0,10) }]);
    setNewClient({ nombre:"", empresa:"", asesor:"", ciudad_interes:[], uso_interes:[], presupuesto_min:"", presupuesto_max:"", sup_min:"", sup_max:"", temperatura:"Tibio", status:"Nuevo", notas:"" });
    setShowAddClient(false);
    toast("✓ Cliente agregado correctamente");
  };

  // ─────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────
  const s = {
    app: { minHeight:"100vh", backgroundColor:B.offW, fontFamily:"'DM Sans',sans-serif", color:B.navy },
    nav: { backgroundColor:B.navy, height:64, display:"flex", alignItems:"center",
      padding:"0 32px", gap:24, position:"sticky", top:0, zIndex:100,
      boxShadow:"0 2px 20px rgba(0,43,73,0.3)" },
    navLogo: { display:"flex", alignItems:"center", gap:10, cursor:"pointer" },
    navLogoText: { fontSize:20, fontWeight:800, color:B.white, fontFamily:"'Playfair Display',serif", letterSpacing:"-0.5px" },
    navGold: { color:B.gold },
    navLinks: { display:"flex", gap:4, marginLeft:"auto" },
    navBtn: (active) => ({ padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer",
      backgroundColor: active ? B.gold : "transparent",
      color: active ? B.navy : B.grey2, fontSize:13, fontWeight:600,
      fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }),
    page: { maxWidth:1200, margin:"0 auto", padding:"32px 24px" },
    // HOME
    hero: { background:`linear-gradient(135deg, ${B.navy} 0%, ${B.navyL} 60%, ${B.navy} 100%)`,
      borderRadius:20, padding:"56px 48px", marginBottom:32, position:"relative", overflow:"hidden" },
    heroDecor: { position:"absolute", top:-40, right:-40, width:300, height:300,
      borderRadius:"50%", background:`radial-gradient(circle, ${B.gold}22 0%, transparent 70%)`,
      pointerEvents:"none" },
    heroEyebrow: { fontSize:11, fontWeight:700, letterSpacing:3, color:B.gold,
      textTransform:"uppercase", marginBottom:12 },
    heroTitle: { fontSize:42, fontWeight:800, color:B.white, lineHeight:1.1,
      fontFamily:"'Playfair Display',serif", marginBottom:16 },
    heroSub: { fontSize:16, color:B.grey2, maxWidth:560, lineHeight:1.6 },
    statsRow: { display:"flex", gap:32, marginTop:36 },
    stat: { display:"flex", flexDirection:"column" },
    statNum: { fontSize:28, fontWeight:800, color:B.gold, fontFamily:"'Playfair Display',serif" },
    statLabel: { fontSize:12, color:B.grey3, fontWeight:500 },
    // CARDS
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 },
    modeCard: (active) => ({ background:B.white, borderRadius:16, padding:32, cursor:"pointer",
      border:`2px solid ${active ? B.gold : B.grey1}`,
      boxShadow: active ? `0 8px 32px ${B.gold}33` : "0 2px 12px rgba(0,43,73,0.06)",
      transition:"all 0.25s", display:"flex", flexDirection:"column", gap:12 }),
    modeIcon: { fontSize:36 },
    modeTitle: { fontSize:18, fontWeight:700, color:B.navy, fontFamily:"'Playfair Display',serif" },
    modeSub: { fontSize:13, color:B.grey3, lineHeight:1.5 },
    // SECTION
    sectionTitle: { fontSize:24, fontWeight:800, color:B.navy, fontFamily:"'Playfair Display',serif",
      marginBottom:6 },
    sectionSub: { fontSize:14, color:B.grey3, marginBottom:24 },
    // FILTERS BAR
    filterBar: { background:B.white, borderRadius:12, padding:"16px 20px",
      display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", marginBottom:24,
      boxShadow:"0 2px 12px rgba(0,43,73,0.06)", border:`1px solid ${B.grey1}` },
    filterLabel: { fontSize:11, fontWeight:700, color:B.grey3, textTransform:"uppercase", letterSpacing:1 },
    select: { padding:"8px 12px", borderRadius:8, border:`1px solid ${B.grey1}`, fontSize:13,
      color:B.navy, backgroundColor:B.offW, fontFamily:"'DM Sans',sans-serif", outline:"none",
      cursor:"pointer" },
    input: { padding:"8px 12px", borderRadius:8, border:`1px solid ${B.grey1}`, fontSize:13,
      color:B.navy, backgroundColor:B.offW, fontFamily:"'DM Sans',sans-serif", outline:"none",
      width:100 },
    // RESULT CARD
    resultCard: (rank) => ({ background:B.white, borderRadius:16, padding:24, marginBottom:16,
      border:`1px solid ${rank === 0 ? B.gold : B.grey1}`,
      boxShadow: rank === 0 ? `0 4px 24px ${B.gold}22` : "0 2px 8px rgba(0,43,73,0.04)",
      position:"relative", overflow:"hidden" }),
    rankBadge: (rank) => ({ position:"absolute", top:16, right:16, width:32, height:32,
      borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
      backgroundColor: rank === 0 ? B.gold : rank === 1 ? B.grey2 : rank === 2 ? "#cd7f32" : B.grey1,
      color: rank < 3 ? B.navy : B.grey3, fontSize:13, fontWeight:800 }),
    // BUTTONS
    btn: (variant="primary") => ({
      padding: variant === "sm" ? "8px 16px" : "12px 24px",
      borderRadius:10, border:"none", cursor:"pointer", fontWeight:700,
      fontSize: variant === "sm" ? 13 : 14, fontFamily:"'DM Sans',sans-serif",
      display:"inline-flex", alignItems:"center", gap:8, transition:"all 0.2s",
      backgroundColor: variant === "primary" ? B.gold : variant === "navy" ? B.navy : variant === "ghost" ? "transparent" : B.grey1,
      color: variant === "primary" ? B.navy : variant === "ghost" ? B.grey3 : B.white,
      boxShadow: variant === "primary" ? `0 4px 16px ${B.gold}44` : "none",
    }),
    // CLIENT CARD
    clientCard: (sel) => ({ background: sel ? B.navy : B.white, borderRadius:14, padding:20,
      cursor:"pointer", border:`2px solid ${sel ? B.gold : B.grey1}`,
      transition:"all 0.2s", marginBottom:12 }),
    // LOT CARD
    lotCard: (sel) => ({ background: sel ? B.navy : B.white, borderRadius:14, padding:20,
      cursor:"pointer", border:`2px solid ${sel ? B.gold : B.grey1}`,
      transition:"all 0.2s", marginBottom:12 }),
    // MODAL
    overlay: { position:"fixed", inset:0, backgroundColor:"rgba(0,27,46,0.7)",
      zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 },
    modal: { background:B.white, borderRadius:20, padding:36, width:"100%", maxWidth:560,
      maxHeight:"90vh", overflowY:"auto" },
    // LOADING
    loadingOverlay: { position:"fixed", inset:0, backgroundColor:"rgba(0,27,46,0.85)",
      zIndex:300, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 },
    spinner: { width:56, height:56, border:`4px solid ${B.grey5}`,
      borderTopColor:B.gold, borderRadius:"50%",
      animation:"spin 0.9s linear infinite" },
    // TOAST
    toast: { position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)",
      backgroundColor:B.navy, color:B.white, padding:"12px 24px", borderRadius:12,
      fontSize:14, fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,0.3)", zIndex:400,
      border:`1px solid ${B.gold}` },
  };

  // ─────────────────────────────────────────────────────────────────
  // VIEWS
  // ─────────────────────────────────────────────────────────────────

  // ── HOME ─────────────────────────────────────────────────────────
  const ViewHome = () => (
    <div style={s.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={s.hero}>
        <div style={s.heroDecor} />
        <div style={s.heroEyebrow}>⬡ GRUPO GUÍA — MACROPRO</div>
        <div style={s.heroTitle}>Motor de Matching<br/><span style={{ color:B.gold }}>Macrolote × Cliente</span></div>
        <div style={s.heroSub}>Cruza inteligentemente tu inventario con el perfil exacto de cada cliente. Score de compatibilidad en segundos con IA.</div>
        <div style={s.statsRow}>
          <div style={s.stat}><span style={s.statNum}>{inventory.length}</span><span style={s.statLabel}>Lotes activos</span></div>
          <div style={s.stat}><span style={s.statNum}>{clients.length}</span><span style={s.statLabel}>Clientes en cartera</span></div>
          <div style={s.stat}><span style={s.statNum}>{[...new Set(inventory.map(l=>l.ciudad))].length}</span><span style={s.statLabel}>Ciudades</span></div>
          <div style={s.stat}><span style={s.statNum}>{fmtM(inventory.reduce((a,l)=>a+l.precio_total,0))}</span><span style={s.statLabel}>Valor portafolio</span></div>
        </div>
      </div>

      <div style={{ marginBottom:12 }}>
        <div style={s.sectionTitle}>¿Qué análisis quieres hacer?</div>
        <div style={s.sectionSub}>Elige el modo de cruce según tu necesidad del momento</div>
      </div>

      <div style={s.grid2}>
        <div style={s.modeCard(false)} onClick={() => setView("matchClient")}
          onMouseEnter={e => e.currentTarget.style.transform="translateY(-4px)"}
          onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
          <div style={s.modeIcon}>👤</div>
          <div style={s.modeTitle}>Cliente → Lotes</div>
          <div style={s.modeSub}>Selecciona un cliente específico y obtén el ranking de todos los macrolotes ordenados por compatibilidad con su perfil.</div>
          <div style={{ marginTop:"auto" }}>
            <button style={s.btn("primary")} onClick={() => setView("matchClient")}>Seleccionar cliente →</button>
          </div>
        </div>
        <div style={s.modeCard(false)} onClick={() => setView("matchLot")}
          onMouseEnter={e => e.currentTarget.style.transform="translateY(-4px)"}
          onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
          <div style={s.modeIcon}>🏗</div>
          <div style={s.modeTitle}>Lote → Clientes</div>
          <div style={s.modeSub}>Selecciona un macrolote y descubre qué clientes de tu cartera tienen mayor compatibilidad. Ideal cuando baja un precio o entra inventario nuevo.</div>
          <div style={{ marginTop:"auto" }}>
            <button style={s.btn("navy")} onClick={() => setView("matchLot")}>Seleccionar lote →</button>
          </div>
        </div>
      </div>

      {/* Upload + Quick actions */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:8 }}>
        <button style={s.btn("ghost")} onClick={() => fileRef.current?.click()}>
          📤 Cargar Excel de inventario
        </button>
        <button style={s.btn("ghost")} onClick={() => setView("clients")}>
          👤 Gestionar clientes
        </button>
        <button style={s.btn("ghost")} onClick={() => setView("lots")}>
          🏗 Ver inventario completo
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={handleExcelUpload} />
      </div>
    </div>
  );

  // ── SELECT CLIENT ─────────────────────────────────────────────────
  const ViewMatchClient = () => (
    <div style={s.page}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28 }}>
        <button style={s.btn("ghost")} onClick={() => setView("home")}>← Inicio</button>
        <div>
          <div style={s.sectionTitle}>Selecciona el cliente</div>
          <div style={s.sectionSub}>El análisis cruzará su perfil con todos los lotes del inventario</div>
        </div>
        <button style={{ ...s.btn("primary"), marginLeft:"auto" }} onClick={() => setShowAddClient(true)}>
          ➕ Nuevo cliente
        </button>
      </div>

      {clients.map(c => (
        <div key={c.id} style={s.clientCard(selectedClient?.id === c.id)}
          onClick={() => setSelectedClient(c)}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", backgroundColor: selectedClient?.id===c.id ? B.gold : B.blueL,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>👤</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                <span style={{ fontWeight:700, fontSize:16, color: selectedClient?.id===c.id ? B.white : B.navy }}>{c.nombre}</span>
                <Tag label={c.temperatura} color={tempColor(c.temperatura)} bg={selectedClient?.id===c.id ? "rgba(255,255,255,0.15)" : tempBg(c.temperatura)} />
                <Tag label={c.status} color={B.blue} bg={selectedClient?.id===c.id ? "rgba(255,255,255,0.15)" : B.blueL} />
              </div>
              <div style={{ fontSize:13, color: selectedClient?.id===c.id ? B.grey2 : B.grey3 }}>
                {c.empresa} &nbsp;·&nbsp; Asesor: {c.asesor} &nbsp;·&nbsp; {c.ciudad_interes?.join(", ")}
              </div>
              <div style={{ fontSize:12, color: selectedClient?.id===c.id ? B.grey2 : B.grey3, marginTop:2 }}>
                {c.uso_interes?.join(" / ")} &nbsp;·&nbsp; {fmtM(c.presupuesto_min)} – {fmtM(c.presupuesto_max)} &nbsp;·&nbsp; {c.sup_min?.toLocaleString()}–{c.sup_max?.toLocaleString()} m²
              </div>
            </div>
            {selectedClient?.id===c.id && <div style={{ color:B.gold, fontSize:22 }}>✓</div>}
          </div>
        </div>
      ))}

      {selectedClient && (
        <div style={{ position:"sticky", bottom:24, display:"flex", justifyContent:"center", marginTop:16 }}>
          <button style={{ ...s.btn("primary"), padding:"16px 40px", fontSize:16,
            boxShadow:`0 8px 32px ${B.gold}55` }}
            onClick={() => { setMatchMode("clientToLots"); runMatch("clientToLots", selectedClient, inventory); }}>
            🎯 &nbsp;Generar Match para {selectedClient.nombre}
          </button>
        </div>
      )}
    </div>
  );

  // ── SELECT LOT ────────────────────────────────────────────────────
  const ViewMatchLot = () => {
    const [localFilter, setLocalFilter] = useState("Todos");
    const filtered = localFilter === "Todos" ? inventory : inventory.filter(l => l.ciudad === localFilter);
    return (
      <div style={s.page}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28 }}>
          <button style={s.btn("ghost")} onClick={() => setView("home")}>← Inicio</button>
          <div>
            <div style={s.sectionTitle}>Selecciona el macrolote</div>
            <div style={s.sectionSub}>Cruzará contra todos los clientes de la cartera</div>
          </div>
          <select style={{ ...s.select, marginLeft:"auto" }} value={localFilter}
            onChange={e => setLocalFilter(e.target.value)}>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {filtered.map(lot => (
          <div key={lot.id} style={s.lotCard(selectedLot?.id === lot.id)} onClick={() => setSelectedLot(lot)}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:44, height:44, borderRadius:10, backgroundColor: selectedLot?.id===lot.id ? B.gold : B.navy,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:11,
                fontWeight:800, color: selectedLot?.id===lot.id ? B.navy : B.white, flexShrink:0 }}>
                {lot.id.split("-")[0]}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:15, color: selectedLot?.id===lot.id ? B.white : B.navy }}>{lot.nombre}</span>
                  <Tag label={lot.uso} color={B.navy} bg={selectedLot?.id===lot.id ? "rgba(255,255,255,0.15)" : B.blueL} />
                  <Tag label={lot.status} color={B.green} bg={selectedLot?.id===lot.id ? "rgba(255,255,255,0.15)" : B.greenL} />
                </div>
                <div style={{ fontSize:13, color: selectedLot?.id===lot.id ? B.grey2 : B.grey3 }}>
                  {lot.desarrollo} &nbsp;·&nbsp; {lot.ciudad}, {lot.estado}
                </div>
                <div style={{ fontSize:13, color: selectedLot?.id===lot.id ? B.grey2 : B.grey3, marginTop:2, display:"flex", gap:16 }}>
                  <span>{lot.sup_m2?.toLocaleString()} m²</span>
                  <span>${lot.precio_m2?.toLocaleString()}/m²</span>
                  <span style={{ fontWeight:700, color: selectedLot?.id===lot.id ? B.gold : B.navy }}>{fmtM(lot.precio_total)}</span>
                </div>
              </div>
              {selectedLot?.id===lot.id && <div style={{ color:B.gold, fontSize:22 }}>✓</div>}
            </div>
          </div>
        ))}

        {selectedLot && (
          <div style={{ position:"sticky", bottom:24, display:"flex", justifyContent:"center", marginTop:16 }}>
            <button style={{ ...s.btn("primary"), padding:"16px 40px", fontSize:16 }}
              onClick={() => { setMatchMode("lotToClients"); runMatch("lotToClients", selectedLot, clients); }}>
              🎯 &nbsp;Encontrar clientes para {selectedLot.nombre}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── RESULTS ───────────────────────────────────────────────────────
  const ViewResults = () => {
    if (!matchResults) return null;
    const { mode, subject, results } = matchResults;
    const isClientMode = mode === "clientToLots";
    const filtered = applyFilters(results);

    return (
      <div style={s.page}>
        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${B.navy},${B.navyL})`, borderRadius:16,
          padding:"28px 32px", marginBottom:24, display:"flex", alignItems:"center", gap:20 }}>
          <button style={{ ...s.btn("ghost"), color:B.grey2 }} onClick={() => setView(isClientMode ? "matchClient" : "matchLot")}>← Volver</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:B.gold, textTransform:"uppercase", marginBottom:6 }}>
              Resultados del Match · {isClientMode ? "Cliente → Lotes" : "Lote → Clientes"}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:B.white, fontFamily:"'Playfair Display',serif" }}>
              {isClientMode ? subject.nombre : subject.nombre}
              <span style={{ color:B.gold }}> · {results.length} resultados rankeados</span>
            </div>
            <div style={{ fontSize:13, color:B.grey2, marginTop:4 }}>
              {isClientMode
                ? `${subject.empresa} · ${subject.uso_interes?.join(", ")} · ${fmtM(subject.presupuesto_min)}–${fmtM(subject.presupuesto_max)}`
                : `${subject.ciudad}, ${subject.estado} · ${subject.uso} · ${subject.sup_m2?.toLocaleString()} m²`}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {results[0] && <ScoreRing score={results[0].score} size={72} />}
          </div>
        </div>

        {/* FILTERS */}
        <div style={s.filterBar}>
          <span style={s.filterLabel}>⚡ Filtrar resultados:</span>
          {isClientMode ? (<>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:B.grey3, fontWeight:600 }}>CIUDAD</span>
              <select style={s.select} value={filterCity} onChange={e=>setFilterCity(e.target.value)}>
                {cities.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:B.grey3, fontWeight:600 }}>USO DE SUELO</span>
              <select style={s.select} value={filterUso} onChange={e=>setFilterUso(e.target.value)}>
                {usos.map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:B.grey3, fontWeight:600 }}>SUP. MÍN (m²)</span>
              <input style={s.input} type="number" placeholder="Ej: 5000" value={filterSupMin} onChange={e=>setFilterSupMin(e.target.value)} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:B.grey3, fontWeight:600 }}>SUP. MÁX (m²)</span>
              <input style={s.input} type="number" placeholder="Ej: 20000" value={filterSupMax} onChange={e=>setFilterSupMax(e.target.value)} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:B.grey3, fontWeight:600 }}>PRECIO MÁX (MDP)</span>
              <input style={s.input} type="number" placeholder="Ej: 100" value={filterPrecioMax} onChange={e=>setFilterPrecioMax(e.target.value)} />
            </div>
          </>) : (<>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:B.grey3, fontWeight:600 }}>ASESOR</span>
              <select style={s.select} value={filterAsesor} onChange={e=>setFilterAsesor(e.target.value)}>
                {asesores.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
          </>)}
          <div style={{ marginLeft:"auto", fontSize:13, color:B.grey3 }}>
            Mostrando <strong style={{ color:B.navy }}>{filtered.length}</strong> de {results.length}
          </div>
        </div>

        {/* RESULT CARDS */}
        {filtered.map((r, i) => {
          const item = r.data;
          if (!item) return null;
          return (
            <div key={r.id} style={s.resultCard(i)}>
              <div style={s.rankBadge(i)}>#{i+1}</div>
              <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>
                <ScoreRing score={r.score} size={80} />
                <div style={{ flex:1, minWidth:0 }}>
                  {/* Header */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:18, fontWeight:800, color:B.navy, fontFamily:"'Playfair Display',serif" }}>
                      {isClientMode ? item.nombre : item.nombre}
                    </span>
                    <Tag label={r.match_label} color={scoreColor(r.score)} bg={r.score>=80?B.greenL:r.score>=60?"#fff8e7":B.blueL} />
                    {isClientMode && <Tag label={item.uso} color={B.navy} bg={B.blueL} />}
                    {isClientMode && <Tag label={item.ciudad} color={B.navy} bg={B.grey1} />}
                    {!isClientMode && <Tag label={item.temperatura||""} color={tempColor(item.temperatura)} bg={tempBg(item.temperatura)} />}
                  </div>

                  {/* Info row */}
                  <div style={{ fontSize:13, color:B.grey3, marginBottom:12, display:"flex", gap:16, flexWrap:"wrap" }}>
                    {isClientMode ? (<>
                      <span>📐 {item.sup_m2?.toLocaleString()} m²</span>
                      <span>💲 ${item.precio_m2?.toLocaleString()}/m²</span>
                      <span style={{ fontWeight:700, color:B.navy }}>{fmtM(item.precio_total)}</span>
                      <span>⚡ Entrega: {item.entrega}</span>
                      {item.niveles && <span>🏢 {item.niveles}</span>}
                    </>) : (<>
                      <span>🏢 {item.empresa}</span>
                      <span>👨‍💼 Asesor: {item.asesor}</span>
                      <span>💲 {fmtM(item.presupuesto_min)}–{fmtM(item.presupuesto_max)}</span>
                      <span>📐 {item.sup_min?.toLocaleString()}–{item.sup_max?.toLocaleString()} m²</span>
                    </>)}
                  </div>

                  {/* Razón principal */}
                  <div style={{ background:`linear-gradient(90deg,${B.gold}18,transparent)`,
                    borderLeft:`3px solid ${B.gold}`, padding:"10px 14px",
                    borderRadius:"0 8px 8px 0", marginBottom:12, fontSize:14,
                    color:B.navy, fontWeight:600 }}>
                    {r.razon_principal}
                  </div>

                  {/* Grid: argumentos + objeción */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div style={{ background:B.greenL, borderRadius:10, padding:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:B.green, letterSpacing:1,
                        textTransform:"uppercase", marginBottom:8 }}>✦ Argumentos de venta</div>
                      {r.argumentos?.map((a,ai) => (
                        <div key={ai} style={{ fontSize:13, color:B.grey4, marginBottom:6,
                          display:"flex", gap:8 }}>
                          <span style={{ color:B.green, fontWeight:700, flexShrink:0 }}>{ai+1}.</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ background:B.redL, borderRadius:10, padding:14, marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:B.red, letterSpacing:1,
                          textTransform:"uppercase", marginBottom:6 }}>⚠ Posible objeción</div>
                        <div style={{ fontSize:13, color:B.grey4 }}>{r.objeccion}</div>
                        <div style={{ fontSize:13, color:B.green, marginTop:6, fontWeight:600 }}>→ {r.respuesta_objecion}</div>
                      </div>
                      <div style={{ background:AMBER_LT||"#fff8e7", borderRadius:10, padding:14, border:`1px solid ${B.gold}44` }}>
                        <div style={{ fontSize:11, fontWeight:700, color:B.goldD, letterSpacing:1,
                          textTransform:"uppercase", marginBottom:6 }}>⚡ Urgencia / Cierre</div>
                        <div style={{ fontSize:13, color:B.grey4 }}>{r.urgencia}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:48, color:B.grey3 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <div style={{ fontSize:16, fontWeight:600 }}>Sin resultados con estos filtros</div>
            <div style={{ fontSize:13 }}>Ajusta los filtros para ver más lotes</div>
          </div>
        )}
      </div>
    );
  };

  // ── CLIENTS LIST ──────────────────────────────────────────────────
  const ViewClients = () => (
    <div style={s.page}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
        <button style={s.btn("ghost")} onClick={() => setView("home")}>← Inicio</button>
        <div style={s.sectionTitle}>Base de Clientes</div>
        <button style={{ ...s.btn("primary"), marginLeft:"auto" }} onClick={() => setShowAddClient(true)}>
          ➕ Nuevo cliente
        </button>
      </div>
      {clients.map(c => (
        <div key={c.id} style={{ ...s.clientCard(false), cursor:"default" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>{c.nombre}</span>
                <Tag label={c.temperatura} color={tempColor(c.temperatura)} bg={tempBg(c.temperatura)} />
                <Tag label={c.status} color={B.blue} bg={B.blueL} />
              </div>
              <div style={{ fontSize:13, color:B.grey3 }}>{c.empresa} · {c.asesor} · {c.ciudad_interes?.join(", ")}</div>
              <div style={{ fontSize:12, color:B.grey3, marginTop:2 }}>{c.notas}</div>
            </div>
            <button style={s.btn("sm")} onClick={() => { setSelectedClient(c); setView("matchClient"); }}>
              🎯 Match
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── LOTS LIST ─────────────────────────────────────────────────────
  const ViewLots = () => (
    <div style={s.page}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
        <button style={s.btn("ghost")} onClick={() => setView("home")}>← Inicio</button>
        <div style={s.sectionTitle}>Inventario de Macrolotes</div>
        <button style={{ ...s.btn("ghost"), marginLeft:"auto" }} onClick={() => fileRef.current?.click()}>📤 Actualizar Excel</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={handleExcelUpload} />
      </div>
      <div style={s.filterBar}>
        <select style={s.select} value={filterCity} onChange={e=>setFilterCity(e.target.value)}>
          {cities.map(c=><option key={c}>{c}</option>)}
        </select>
        <select style={s.select} value={filterUso} onChange={e=>setFilterUso(e.target.value)}>
          {usos.map(u=><option key={u}>{u}</option>)}
        </select>
        <span style={{ marginLeft:"auto", fontSize:13, color:B.grey3 }}>
          {inventory.filter(l=>(filterCity==="Todas"||l.ciudad===filterCity)&&(filterUso==="Todos"||l.uso===filterUso)).length} lotes
        </span>
      </div>
      {inventory.filter(l=>(filterCity==="Todas"||l.ciudad===filterCity)&&(filterUso==="Todos"||l.uso===filterUso)).map(lot => (
        <div key={lot.id} style={{ ...s.lotCard(false), cursor:"default" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:40, height:40, borderRadius:8, backgroundColor:B.navy,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:800, color:B.gold, flexShrink:0 }}>
              {lot.id.split("-")[0]}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{lot.nombre}</span>
                <Tag label={lot.uso} color={B.navy} bg={B.blueL} />
                <Tag label={lot.ciudad} color={B.grey4} bg={B.grey1} />
              </div>
              <div style={{ fontSize:13, color:B.grey3, display:"flex", gap:16 }}>
                <span>{lot.sup_m2?.toLocaleString()} m²</span>
                <span>${lot.precio_m2?.toLocaleString()}/m²</span>
                <span style={{ fontWeight:700, color:B.navy }}>{fmtM(lot.precio_total)}</span>
                <span>Entrega: {lot.entrega}</span>
              </div>
            </div>
            <button style={s.btn("sm")} onClick={() => { setSelectedLot(lot); setView("matchLot"); }}>🎯 Match</button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── ADD CLIENT MODAL ──────────────────────────────────────────────
  const ModalAddClient = () => (
    <div style={s.overlay} onClick={e => e.target===e.currentTarget && setShowAddClient(false)}>
      <div style={s.modal}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontSize:22, fontWeight:800, color:B.navy, fontFamily:"'Playfair Display',serif" }}>Nuevo Cliente</div>
          <button style={s.btn("ghost")} onClick={() => setShowAddClient(false)}>✕</button>
        </div>
        {[
          ["Nombre completo ★", "nombre", "text", "Ej: Martín Campos"],
          ["Empresa / Fondo", "empresa", "text", "Ej: Campos Desarrollos"],
          ["Asesor responsable ★", "asesor", "text", "Ej: Director, Juan Pérez"],
          ["Ciudades de interés (separadas por coma)", "ciudad_interes_raw", "text", "Ej: Zapopan, El Marqués"],
          ["Usos de interés (separados por coma)", "uso_interes_raw", "text", "Ej: Mixto H+C, Habitacional Vertical"],
          ["Presupuesto mínimo (millones MXN)", "presupuesto_min", "number", "Ej: 20"],
          ["Presupuesto máximo (millones MXN)", "presupuesto_max", "number", "Ej: 100"],
          ["Superficie mínima (m²)", "sup_min", "number", "Ej: 5000"],
          ["Superficie máxima (m²)", "sup_max", "number", "Ej: 20000"],
          ["Notas / Perfil del cliente", "notas", "text", "Descripción libre del cliente y sus necesidades"],
        ].map(([lbl, key, type, ph]) => (
          <div key={key} style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:B.grey4, marginBottom:5 }}>{lbl}</div>
            {key === "notas" ? (
              <textarea style={{ ...s.input, width:"100%", height:70, resize:"none", padding:"10px 12px" }}
                placeholder={ph} value={newClient[key]||""}
                onChange={e => setNewClient({...newClient,[key]:e.target.value})} />
            ) : (
              <input style={{ ...s.input, width:"100%" }} type={type} placeholder={ph}
                value={newClient[key]||""}
                onChange={e => setNewClient({...newClient,[key]:e.target.value})} />
            )}
          </div>
        ))}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:B.grey4, marginBottom:5 }}>Temperatura</div>
            <select style={{ ...s.select, width:"100%" }} value={newClient.temperatura}
              onChange={e => setNewClient({...newClient,temperatura:e.target.value})}>
              {["Caliente","Tibio","Frío"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:B.grey4, marginBottom:5 }}>Status</div>
            <select style={{ ...s.select, width:"100%" }} value={newClient.status}
              onChange={e => setNewClient({...newClient,status:e.target.value})}>
              {["Nuevo","Calificado","Presentación activa","Negociando","Cerrado"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button style={{ ...s.btn("primary"), width:"100%", justifyContent:"center", padding:"14px" }}
          onClick={addClient}>
          ➕ Agregar cliente
        </button>
      </div>
    </div>
  );

  // ── LOADING OVERLAY ───────────────────────────────────────────────
  const LoadingView = () => (
    <div style={s.loadingOverlay}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🎯</div>
        <div style={{ fontSize:22, fontWeight:800, color:B.white, fontFamily:"'Playfair Display',serif",
          marginBottom:8 }}>Analizando con IA</div>
        <div style={{ fontSize:15, color:B.grey2, marginBottom:32 }}>{loadingMsg}</div>
        <div style={s.spinner} />
        <div style={{ marginTop:24, fontSize:13, color:B.grey3 }}>Esto tarda 5-10 segundos...</div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  const AMBER_LT = "#fff8e7";

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .result-card { animation: fadeIn 0.3s ease both; }
        textarea { font-family: 'DM Sans', sans-serif; }
        input, select { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navLogo} onClick={() => setView("home")}>
          <div style={{ width:32, height:32, background:B.gold, borderRadius:8,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, fontWeight:800, color:B.navy }}>M</div>
          <span style={s.navLogoText}>Macro<span style={s.navGold}>Pro</span></span>
          <span style={{ fontSize:11, color:B.grey3, fontWeight:500, marginLeft:4 }}>by Grupo Guía</span>
        </div>
        <div style={s.navLinks}>
          {[["home","🏠 Inicio"],["matchClient","👤 Cliente→Lotes"],["matchLot","🏗 Lote→Clientes"],["clients","👥 Clientes"],["lots","📦 Inventario"]].map(([v,l])=>(
            <button key={v} style={s.navBtn(view===v)} onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
      </nav>

      {/* VIEWS */}
      {view === "home" && <ViewHome />}
      {view === "matchClient" && <ViewMatchClient />}
      {view === "matchLot" && <ViewMatchLot />}
      {view === "result" && <ViewResults />}
      {view === "clients" && <ViewClients />}
      {view === "lots" && <ViewLots />}

      {/* MODALS */}
      {showAddClient && <ModalAddClient />}

      {/* LOADING */}
      {loading && <LoadingView />}

      {/* TOAST */}
      {toastMsg && <div style={s.toast}>{toastMsg}</div>}
    </div>
  );
}
