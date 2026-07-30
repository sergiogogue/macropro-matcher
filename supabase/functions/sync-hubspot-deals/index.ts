// ════════════════════════════════════════════════════════════════════
// Edge Function · Importa los deals de HubSpot de MACROLOTES → public.hubspot_deals.
// "Macrolotes" se identifica por la(s) propiedad(es) de "Desarrollo de interés" cuyas
// OPCIONES contienen "MACROLOTES" (ej. MACROLOTES CAPITAL NORTE, CORRETAJE MACROLOTES).
// Todos los pipelines. El token vive AQUÍ. MacroPro solo LEE la tabla.
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

    // 1) Encontrar TODAS las propiedades cuyas OPCIONES contienen "macrolotes"
    const devProps: string[] = [];
    try {
      const props = await hs("/crm/v3/properties/deals");
      for (const p of (props.results || [])) {
        const opts = p.options || [];
        if (opts.some((o: any) => norm(o.label).includes("macrolotes") || norm(o.value).includes("macrolotes"))) devProps.push(p.name);
      }
      if (!devProps.length) {
        const hit = (props.results || []).find((p: any) => norm(p.label).includes("desarrollo de inter"));
        if (hit) devProps.push(hit.name);
      }
    } catch (_) {}

    // 2) Pipelines → labels
    const pl = await hs("/crm/v3/pipelines/deals");
    const stageLabel: Record<string, string> = {};
    const pipeLabel: Record<string, string> = {};
    for (const p of (pl.results || [])) { pipeLabel[p.id] = p.label; for (const s of (p.stages || [])) stageLabel[s.id] = s.label; }

    // 3) Owners
    const ownerName: Record<string, string> = {};
    try {
      let oa = "";
      do {
        const op = await hs("/crm/v3/owners?limit=100" + (oa ? "&after=" + oa : ""));
        for (const o of (op.results || [])) ownerName[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
        oa = op.paging?.next?.after || "";
      } while (oa);
    } catch (_) {}

    // 4) Deals → guardar SOLO los que tengan un "Desarrollo" que contenga "macrolotes"
    const propList = ["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id", ...devProps];
    const props2 = [...new Set(propList)].join(",");
    let after = "";
    const rows: Record<string, unknown>[] = [];
    let guard = 0;
    do {
      const page = await hs(`/crm/v3/objects/deals?limit=100&properties=${props2}&associations=contacts` + (after ? `&after=${after}` : ""));
      for (const d of (page.results || [])) {
        const pr = d.properties || {};
        let des = "";
        for (const dp of devProps) { const v = (pr[dp] || "").toString(); if (norm(v).includes("macrolotes")) { des = v; break; } }
        if (!des) continue;
        rows.push({
          deal_id: String(d.id),
          dealname: pr.dealname || null,
          dealstage_id: pr.dealstage || null,
          dealstage_label: stageLabel[pr.dealstage] || pr.dealstage || null,
          pipeline: pipeLabel[pr.pipeline] || pr.pipeline || null,
          amount: pr.amount ? Number(pr.amount) : null,
          hubspot_contact_id: d.associations?.contacts?.results?.[0]?.id || null,
          desarrollo: des,
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
    return new Response(JSON.stringify({ ok: true, synced: rows.length, devProps }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
