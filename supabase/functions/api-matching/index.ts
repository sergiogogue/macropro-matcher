// ════════════════════════════════════════════════════════════════════
// Edge Function · api-matching  (Spec Back-Office · Tarea 3)
// Expone el motor de matching SIN cargar el monolito de MacroPro.
// Entrada:  POST { clienteId, limit? }   (o ?clienteId=...)
// Salida:   { cliente:{id,nombre}, top: [ {lote, score, razones} ... ] }  (Top 5 por defecto)
//
// Reimplementa la MISMA fórmula de buscarMatchesParaSolicitud + scoreClienteLote
// (pesos: superficie 20, precio 20, ciudad 15 fuzzy/ZMG, uso 15 → normalizado 0–100).
// NO modifica datos (solo lee lotes y clientes con service role, tras verificar sesión).
//
// Despliegue:
//   supabase functions deploy api-matching
// Consumo desde la Landing (con sesión Supabase del usuario):
//   const { data } = await sb.functions.invoke('api-matching', { body: { clienteId } })
// ════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

// Orígenes permitidos (ajusta si cambia el dominio de la Landing/MacroPro).
const ALLOWED = ["https://macrolotes.grupoguia.mx", "https://sergiogogue.github.io"];
const cors = (o: string) => ({
  "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const norm = (s: string) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const ZMG = ["guadalajara","zapopan","tlajomulco","tonala","tlaquepaque","el salto","san pedro","zmg","gdl","zmgdl","zona metropolitana"];
const ciuMatch = (a: string, b: string) => { a = norm(a); b = norm(b); if (!a || !b) return false; if (a.includes(b) || b.includes(a)) return true; return ZMG.some(z => a.includes(z)) && ZMG.some(z => b.includes(z)); };
const n = (v: unknown) => Number(v) || 0;

// Score de UN lote vs UNA "solicitud" simple (misma lógica/pesos que el monolito, criterios de cliente)
function scoreSolicitudLote(sol: any, lote: any) {
  const sup = n(lote.superficie_m2 ?? lote.sup_m2);
  const precio = n(lote.precio_total);
  const lotCiudad = (lote.ciudad || "").toString();
  const lotUso = (lote.uso || lote.uso_suelo || "").toString();
  let score = 0; const razones: string[] = []; let desc = false;
  const supMin = n(sol.sup_min), supMax = n(sol.sup_max), precioMax = n(sol.presupuesto_max);
  if (supMin > 0 && sup < supMin) desc = true; else if (sup >= supMin && supMin > 0) { score += 20; razones.push("Superficie ✓"); } else if (supMin === 0 && sup > 0) { score += 20; }
  if (supMax > 0 && sup > supMax) desc = true;
  if (precioMax > 0) { if (precio > 0 && precio <= precioMax) { score += 20; razones.push("Precio en rango ✓"); } else if (precio > precioMax) desc = true; }
  if (sol.ciudad) { if (ciuMatch(sol.ciudad, lotCiudad)) { score += 15; razones.push("Ciudad ✓"); } else if (lotCiudad) desc = true; }
  if (sol.usoSuelo && lotUso) { const a = norm(sol.usoSuelo), b = norm(lotUso); if (a.includes(b) || b.includes(a)) { score += 15; razones.push("Uso ✓"); } }
  return { score, razones, descalificado: desc };
}

// Score 0–100 CLIENTE↔LOTE (maneja arrays, normaliza sobre criterios aplicables)
function scoreClienteLote(cliente: any, lote: any) {
  const ciudades: string[] = Array.isArray(cliente.ciudad_interes) && cliente.ciudad_interes.length ? cliente.ciudad_interes : [""];
  const usos: string[] = Array.isArray(cliente.uso_interes) && cliente.uso_interes.length ? cliente.uso_interes : [""];
  let best: any = null;
  for (const ci of ciudades) for (const us of usos) {
    const sol = { sup_min: cliente.sup_min, sup_max: cliente.sup_max, presupuesto_max: cliente.presupuesto_max, ciudad: ci || "", usoSuelo: us || "" };
    const m = scoreSolicitudLote(sol, lote);
    if (!best || (m.descalificado === best.descalificado ? m.score > best.score : (!m.descalificado && best.descalificado))) best = m;
  }
  if (!best) return { score: 0, razones: [], descalificado: false, na: true };
  let maxApp = 0;
  if (n(cliente.sup_min) > 0 || n(cliente.sup_max) > 0) maxApp += 20;
  if (n(cliente.presupuesto_max) > 0) maxApp += 20;
  if (ciudades[0] !== "") maxApp += 15;
  if (usos[0] !== "") maxApp += 15;
  const score = maxApp > 0 ? Math.round(Math.min(best.score, maxApp) / maxApp * 100) : 0;
  return { score, razones: best.razones, descalificado: best.descalificado, na: maxApp === 0 };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  // Verifica sesión Supabase (rechaza sin JWT)
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return json({ error: "No autorizado: falta sesión." }, 401, origin);
  try {
    const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error } = await authed.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (error || !user) return json({ error: "Sesión inválida." }, 401, origin);
  } catch { return json({ error: "No autorizado." }, 401, origin); }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 5, 20);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── MODO lote→clientes (Cross-Check del Wizard de Captación) ──
    // Recibe un terreno temporal { superficie_m2, precio_total, ciudad, uso } y devuelve el Top N de CLIENTES.
    if (body.lote) {
      const lote = body.lote;
      const { data: clientes } = await sb.from("clientes").select("*");
      const arr = Array.isArray(clientes) ? clientes : [];
      const scored = arr.map((cl: any) => { const r = scoreClienteLote(cl, lote); return { cliente: { id: cl.id_cliente || cl.id, nombre: cl.nombre }, score: r.score, razones: r.razones, descalificado: r.descalificado, na: r.na }; })
        .filter((m) => !m.descalificado && !m.na && m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return json({ modo: "lote_a_clientes", total_evaluados: arr.length, top: scored }, 200, origin);
    }

    // ── MODO clienteId→lotes (original) ──
    const clienteId = body.clienteId ?? new URL(req.url).searchParams.get("clienteId");
    if (!clienteId) return json({ error: "Falta clienteId (o envía body.lote para el modo lote→clientes)." }, 400, origin);
    // Cliente (por id_cliente o id)
    const { data: cRows } = await sb.from("clientes").select("*").or(`id_cliente.eq.${clienteId},id.eq.${clienteId}`).limit(1);
    const cliente = cRows && cRows[0];
    if (!cliente) return json({ error: "Cliente no encontrado." }, 404, origin);
    // Inventario (lotes disponibles)
    const { data: lotes } = await sb.from("lotes").select("id,nombre,desarrollo,desarrollador,ciudad,estado,superficie_m2,precio_total,precio_m2,uso,usos_todos,status_inventario,maps_url");
    const inv = Array.isArray(lotes) ? lotes : [];

    const scored = inv.map((l) => { const r = scoreClienteLote(cliente, l); return { lote: l, score: r.score, razones: r.razones, descalificado: r.descalificado, na: r.na }; })
      .filter((m) => !m.descalificado && !m.na && m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return json({ cliente: { id: cliente.id_cliente || cliente.id, nombre: cliente.nombre }, total_evaluados: inv.length, top: scored }, 200, origin);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500, origin);
  }
});

function json(obj: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}
