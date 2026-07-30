// ════════════════════════════════════════════════════════════════════
// Edge Function · Importa los deals de HubSpot de MACROLOTES → public.hubspot_deals.
// "Macrolotes" se identifica por la propiedad "Desarrollo de interés" (ej. MACROLOTES
// CAPITAL NORTE, MACROLOTES KULKANA, CORRETAJE MACROLOTES). Todos los pipelines.
// El token vive AQUÍ. MacroPro solo LEE la tabla (Kanban HubSpot, solo lectura).
//
// Secrets: HUBSPOT_TOKEN (scopes: deals.read, schemas.deals.read, owners.read,
//          contacts.read, properties: crm.schemas.deals.read).
// ════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hs(path: string) {
  const r = await fetch("https://api.hubapi.com" + path, {
    headers: { Authorization: "Bearer " + HUBSPOT_TOKEN, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("HubSpot " + path + " -> " + r.status + " " + (await r.text()));
  return r.json();
}
const norm = (s: string) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

Deno.serve(async () => {
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Descubrir el NOMBRE INTERNO de la propiedad "Desarrollo de interés"
    let devProp = "";
    try {
      const props = await hs("/crm/v3/properties/deals");
      const hit = (props.results || []).find((p: any) =>
        norm(p.label) === "desarrollo de interes" || norm(p.label).includes("desarrollo de inter"));
      if (hit) devProp = hit.name;
    } catch (_) { /* si falla, no filtramos por desarrollo */ }

    // 2) Pipelines → labels de etapa y pipeline
    const pl = await hs("/crm/v3/pipelines/deals");
    const stageLabel: Record<string, string> = {};
    const pipeLabel: Record<string, string> = {};
    for (const p of (pl.results || [])) { pipeLabel[p.id] = p.label; for (const s of (p.stages || [])) stageLabel[s.id] = s.label; }

    // 3) Owners → nombre del asesor
    const ownerName: Record<string, string> = {};
    try {
      let oa = "";
      do {
        const op = await hs("/crm/v3/owners?limit=100" + (oa ? "&after=" + oa : ""));
        for (const o of (op.results || [])) ownerName[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
        oa = op.paging?.next?.after || "";
      } while (oa);
    } catch (_) { /* seguimos sin nombre */ }

    // 4) Deals (todos) → guardar SOLO los de Macrolotes (desarrollo contiene "macrolotes")
    const propList = ["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id"];
    if (devProp) propList.push(devProp);
    const props2 = propList.join(",");
    let after = "";
    const rows: Record<string, unknown>[] = [];
    let guard = 0;
    do {
      const page = await hs(`/crm/v3/objects/deals?limit=100&properties=${props2}&associations=contacts` + (after ? `&after=${after}` : ""));
      for (const d of (page.results || [])) {
        const pr = d.properties || {};
        const des = devProp ? (pr[devProp] || "") : "";
        if (!norm(des).includes("macrolotes")) continue;   // SOLO Macrolotes
        rows.push({
          deal_id: String(d.id),
          dealname: pr.dealname || null,
          dealstage_id: pr.dealstage || null,
          dealstage_label: stageLabel[pr.dealstage] || pr.dealstage || null,
          pipeline: pipeLabel[pr.pipeline] || pr.pipeline || null,
          amount: pr.amount ? Number(pr.amount) : null,
          hubspot_contact_id: d.associations?.contacts?.results?.[0]?.id || null,
          desarrollo: des || null,
          owner: pr.hubspot_owner_id ? (ownerName[String(pr.hubspot_owner_id)] || null) : null,
          updated_at: new Date().toISOString(),
        });
      }
      after = page.paging?.next?.after || "";
    } while (after && ++guard < 500);

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("hubspot_deals").upsert(rows.slice(i, i + 500), { onConflict: "deal_id" });
      if (error) throw error;
    }
    return new Response(JSON.stringify({ ok: true, synced: rows.length, devProp }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
