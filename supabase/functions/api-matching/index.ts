// ════════════════════════════════════════════════════════════════════
// Edge Function · api-matching  (Spec Back-Office · Tarea 3)
// Expone el motor de matching SIN cargar el monolito de MacroPro.
// Entrada:  POST { clienteId, limit? }   (o ?clienteId=...)
// Salida:   { cliente:{id,nombre}, top: [ {lote, score, razones} ... ] }  (Top 5 por defecto)
//
// Fórmula (reingeniería): pesos superficie 20 · precio 25 · ciudad 15 · uso 20
// (normalizado 0–100), con castigo por sobre-presupuesto (−30, visible) y por uso
// distinto (−20), y bonus de perfil desarrollador (+12). Presupuesto en pesos.
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
const ALLOWED = ["https://macrolotes.grupoguia.mx", "https://grupoguia-macrolotes.netlify.app", "https://sergiogogue.github.io"];
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

// Presupuesto SIEMPRE en pesos. Red de seguridad: si viene un valor chico
// (0 < v < 100000) se asume que quedó capturado en MDP y se pasa a pesos (×1e6),
// para poder compararlo con lote.precio_total. 0/NULL = "sin tope" (no filtra).
const normBudget = (v: unknown) => { const x = Number(v) || 0; return x > 0 && x < 100000 ? x * 1_000_000 : x; };
// Perfil desarrollador: columna derivada es_desarrollador (backfill) o el texto.
const esDesarrollador = (cl: any) => cl?.es_desarrollador === true || /desarrollad/i.test(String(cl?.tipo_comprador || ""));
// El lote sirve para desarrollar si tiene un uso aprovechable (no reserva/agrícola).
const loteDesarrollable = (uso: string) => { const u = norm(uso); return !!u && !/reserva|agricola|sin uso|conservacion/.test(u); };

// Score CLIENTE↔LOTE 0–100. Arrays de ciudad/uso = condiciones OR (se toma la mejor).
// Pesos base (sobre los criterios que el cliente SÍ definió):
//   superficie 20 · precio 25 · ciudad 15 · uso 20.
// Castigos y bonus (Spec reingeniería):
//   · precio > presupuesto      → castigo FUERTE (−30): queda visible pero hundido, NO se elimina.
//   · uso del cliente ≠ del lote → castigo (−20) (antes era neutro).
//   · desarrollador + lote desarrollable → bonus (+12).
// Descalifica (saca del match) SOLO por choques duros: superficie fuera de rango o ciudad distinta.
function scoreClienteLote(cliente: any, lote: any) {
  const sup = n(lote.superficie_m2 ?? lote.sup_m2);
  const precio = n(lote.precio_total);
  const lotCiudad = String(lote.ciudad || "");
  const lotUso = String(lote.uso || lote.uso_suelo || "");
  const supMin = n(cliente.sup_min), supMax = n(cliente.sup_max);
  const presMax = normBudget(cliente.presupuesto_max);
  const ciudades: string[] = Array.isArray(cliente.ciudad_interes) && cliente.ciudad_interes.length ? cliente.ciudad_interes : [""];
  const usos: string[]     = Array.isArray(cliente.uso_interes) && cliente.uso_interes.length ? cliente.uso_interes : [""];

  let best: any = null;
  for (const ci of ciudades) for (const us of usos) {
    let pos = 0, pen = 0, maxApp = 0, desc = false;
    const raz: string[] = [];
    // Superficie — choque duro si el lote cae fuera del rango pedido
    if (supMin > 0 || supMax > 0) {
      maxApp += 20;
      const bajoMin  = supMin > 0 && sup > 0 && sup < supMin;
      const sobreMax = supMax > 0 && sup > 0 && sup > supMax;
      if (bajoMin || sobreMax) desc = true; else { pos += 20; raz.push("Superficie ✓"); }
    }
    // Precio vs presupuesto — castigo fuerte (visible), NO descalifica
    if (presMax > 0) {
      maxApp += 25;
      if (precio > 0 && precio <= presMax) { pos += 25; raz.push("Precio en rango ✓"); }
      else if (precio > presMax) { pen += 30; raz.push("Sobre presupuesto ✗"); }
    }
    // Ciudad — choque duro si el lote es de otra ciudad
    if (ci) {
      maxApp += 15;
      if (ciuMatch(ci, lotCiudad)) { pos += 15; raz.push("Ciudad ✓"); }
      else if (lotCiudad) desc = true;
    }
    // Uso — castigo si no coincide (ya no es neutro)
    if (us) {
      maxApp += 20;
      const a = norm(us), b = norm(lotUso);
      if (lotUso && (a.includes(b) || b.includes(a))) { pos += 20; raz.push("Uso ✓"); }
      else if (lotUso) { pen += 20; raz.push("Uso distinto ✗"); }
    }
    const cand = { pos, pen, maxApp, desc, raz };
    const mejor = !best ? true
      : (cand.desc === best.desc ? (cand.pos - cand.pen) > (best.pos - best.pen) : (!cand.desc && best.desc));
    if (mejor) best = cand;
  }
  if (!best || best.maxApp === 0) return { score: 0, razones: [], descalificado: false, na: true };
  let score = Math.round(Math.max(0, best.pos - best.pen) / best.maxApp * 100);
  // Bonus desarrollador (empresa que construye) sobre un terreno desarrollable
  if (esDesarrollador(cliente) && loteDesarrollable(lotUso)) {
    score = Math.min(100, score + 12);
    best.raz.push("Perfil desarrollador ✓");
  }
  return { score, razones: best.raz, descalificado: best.desc, na: false };
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

    // ── MODO criterios→lotes (ficha de la Landing: manda los criterios directos) ──
    // No depende de que el cliente exista en la tabla `clientes`. La Landing envía:
    //   { ciudad, ciudades[], estados[], uso_suelo, usos[], superficie_min, superficie_max, presupuesto_max }
    // Devuelve { lotes: [ {...lote, score, razones} ] } (la ficha lee l.nombre/score/superficie_m2/precio_total).
    if (body.criterios) {
      const cr = body.criterios;
      const clienteLike = {
        ciudad_interes: (Array.isArray(cr.ciudades) && cr.ciudades.length) ? cr.ciudades : (cr.ciudad ? [cr.ciudad] : []),
        uso_interes: (Array.isArray(cr.usos) && cr.usos.length) ? cr.usos : (cr.uso_suelo ? [cr.uso_suelo] : []),
        sup_min: cr.superficie_min,
        sup_max: cr.superficie_max,
        presupuesto_max: cr.presupuesto_max,
      };
      const { data: lotes } = await sb.from("lotes").select("id,nombre,desarrollo,desarrollador,ciudad,estado,superficie_m2,precio_total,precio_m2,uso,usos_todos,status_inventario,maps_url");
      const inv = Array.isArray(lotes) ? lotes : [];
      const scored = inv.map((l: any) => { const r = scoreClienteLote(clienteLike, l); return { ...l, score: r.score, razones: r.razones, descalificado: r.descalificado, na: r.na }; })
        .filter((m) => !m.descalificado && !m.na && m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return json({ modo: "criterios", total_evaluados: inv.length, lotes: scored }, 200, origin);
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
