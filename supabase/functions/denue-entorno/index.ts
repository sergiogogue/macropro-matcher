// ─────────────────────────────────────────────────────────────────────────
// Edge Function: denue-entorno
// Proxy server-side al API DENUE del INEGI para analizar el "entorno" de un
// lote/desarrollo (escuelas, salud, comercio, bancos, restaurantes, etc.)
// dentro de un radio.
//
// ¿Por qué un proxy y no llamar a INEGI desde el navegador?
//   1) El API del INEGI NO envía cabeceras CORS → una llamada directa desde
//      GitHub Pages (otro origen) es bloqueada por el navegador.
//   2) El token del INEGI queda como SECRETO del servidor (Deno.env), nunca
//      embebido en el bundle del cliente.
//
// Despliegue (lo hace el usuario, una sola vez):
//   supabase secrets set INEGI_TOKEN="TU_TOKEN_DENUE"
//   supabase functions deploy denue-entorno --no-verify-jwt
//   (--no-verify-jwt: MacroPro usa la "publishable key" nueva, no un JWT de
//    usuario; esta función solo consulta datos públicos del INEGI.)
//
// El front la invoca con:  sb.functions.invoke('denue-entorno',{body:{lat,lng,radio}})
// ─────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Categorías de interés inmobiliario. El orden importa: la primera que
// coincida gana (de lo más específico a lo más genérico).
const CATEGORIAS: { key: string; label: string; icon: string; re: RegExp }[] = [
  { key: "educacion",    label: "Educación",          icon: "🎓", re: /escuel|educaci|preescolar|primaria|secundaria|bachill|preparatoria|jard[ií]n de ni|universidad|colegi|guarder/i },
  { key: "salud",        label: "Salud",              icon: "🏥", re: /hospital|cl[ií]nic|consultori|m[eé]dic|farmac|dental|dentist|laboratori|salud|enfermer/i },
  { key: "alimentos",    label: "Restaurantes y café",icon: "🍽️", re: /restaurant|cafeter|café|caf[eé]\b|comida|fonda|taquer|pizzer|antojit|bar\b|cantina|alimentos preparad/i },
  { key: "supermercado", label: "Súper y abarrotes",  icon: "🛒", re: /supermercad|abarrot|minis[uú]per|tienda de conveniencia|autoservicio|mercado|frutas y verdur/i },
  { key: "banca",        label: "Bancos y finanzas",  icon: "🏦", re: /banca|banco|cajero|casa de cambio|financ|cr[eé]dito|seguros|afore/i },
  { key: "hospedaje",    label: "Hoteles",            icon: "🏨", re: /hotel|motel|hospedaje|alojamiento|posada/i },
  { key: "gasolina",     label: "Gasolineras",        icon: "⛽", re: /gasolin|combustible|gas l\.?p|estaci[oó]n de servicio/i },
  { key: "comercio",     label: "Comercio",           icon: "🛍️", re: /comercio al por menor|venta al por menor|tienda|boutique|papeler|ferreter|mueble|ropa|calzado/i },
  { key: "servicios",    label: "Servicios",          icon: "🏢", re: /servicio|oficina|despacho|notar|inmobiliar|gimnasio|est[eé]tica|sal[oó]n de bell|lavander/i },
  { key: "industria",    label: "Industria",          icon: "🏭", re: /manufactur|industri|f[aá]bric|taller|construcci|almac[eé]n|bodega/i },
];

function clasificar(clase: string): { key: string; label: string; icon: string } {
  const c = clase || "";
  for (const cat of CATEGORIAS) if (cat.re.test(c)) return { key: cat.key, label: cat.label, icon: cat.icon };
  return { key: "otros", label: "Otros", icon: "📍" };
}

function haversineM(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, dL = (la2 - la1) * Math.PI / 180, dN = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const token = Deno.env.get("INEGI_TOKEN");
  if (!token) return json({ error: "INEGI_TOKEN no configurado en el servidor (supabase secrets set INEGI_TOKEN=...)" }, 500);

  let body: { lat?: number; lng?: number; radio?: number };
  try { body = await req.json(); } catch { return json({ error: "Body JSON inválido" }, 400); }

  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 10 || lat > 35 || lng < -120 || lng > -80) {
    return json({ error: "Coordenadas inválidas o fuera de México (lat 10–35, lng −80…−120)" }, 400);
  }
  // DENUE limita el radio a 5000 m. Aceptamos metros; default 1000.
  const metros = Math.min(Math.max(Math.round(Number(body.radio) || 1000), 100), 5000);

  // Endpoint "buscar" (minúsculas): condición "todos" = todas las actividades.
  const url = `https://www.inegi.org.mx/app/api/denue/v1/consulta/buscar/todos/${lat},${lng}/${metros}/${token}`;

  // Algunos servidores de gobierno rechazan clientes no-navegador → User-Agent.
  // AbortController para no colgarnos si INEGI no responde.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let arr: any[];
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return json({ error: `INEGI respondió ${r.status}`, url, detail: detail.slice(0, 400) }, 502);
    }
    const txt = await r.text();
    let data: unknown = null;
    try { data = JSON.parse(txt); } catch { /* respuesta no-JSON */ }
    // El API devuelve [] (array) o, sin resultados, a veces objeto/cadena vacía.
    arr = Array.isArray(data) ? data : [];
  } catch (e) {
    // El detalle va DENTRO del mensaje para que se vea en el panel de prueba.
    const msg = (e && (e as Error).message) ? (e as Error).message : String(e);
    console.error("DENUE fetch error:", msg, "url:", url);
    return json({ error: "No se pudo contactar al INEGI — " + msg, url }, 502);
  } finally {
    clearTimeout(t);
  }

  // Conteo por categoría + top establecimientos por cercanía.
  const conteo: Record<string, { key: string; label: string; icon: string; count: number }> = {};
  const items = arr.map((e) => {
    const cat = clasificar(e?.Clase_actividad || e?.Clase || "");
    if (!conteo[cat.key]) conteo[cat.key] = { ...cat, count: 0 };
    conteo[cat.key].count++;
    const elat = Number(e?.Latitud), elng = Number(e?.Longitud);
    const dist = (Number.isFinite(elat) && Number.isFinite(elng)) ? Math.round(haversineM(lat, lng, elat, elng)) : null;
    return {
      nombre: e?.Nombre || e?.Razon_social || "Sin nombre",
      clase: e?.Clase_actividad || "",
      cat: cat.key,
      icon: cat.icon,
      lat: Number.isFinite(elat) ? elat : null,
      lng: Number.isFinite(elng) ? elng : null,
      dist_m: dist,
    };
  });

  const categorias = Object.values(conteo).sort((a, b) => b.count - a.count);
  const top = items
    .filter((i) => i.dist_m !== null)
    .sort((a, b) => (a.dist_m! - b.dist_m!))
    .slice(0, 30);

  return json({
    ok: true,
    centro: { lat, lng },
    radio_m: metros,
    total: items.length,
    categorias,
    top,
    fuente: "DENUE · INEGI",
    consultado: new Date().toISOString(),
  });
});
