// ════════════════════════════════════════════════════════════════════
// Edge Function · Importa los deals de HubSpot de MACROLOTES → public.hubspot_deals.
// Usa la BÚSQUEDA de HubSpot filtrando por los PIPELINES de Macrolotes (Venta Desarrollo /
// Venta Corretaje), así trae solo esos (cientos) sin escanear los 50k+ deals de la cuenta.
// Guarda el "Desarrollo de interés" (etiqueta). El token vive AQUÍ. MacroPro solo LEE.
// ════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hsGet(path: string) {
  const r = await fetch("https://api.hubapi.com" + path, {
    headers: { Authorization: "Bearer " + HUBSPOT_TOKEN, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("HubSpot GET " + path + " -> " + r.status + " " + (await r.text()));
  return r.json();
}
async function hsPost(path: string, body: unknown) {
  const r = await fetch("https://api.hubapi.com" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + HUBSPOT_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("HubSpot POST " + path + " -> " + r.status + " " + (await r.text()));
  return r.json();
}
const norm = (s: string) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

Deno.serve(async () => {
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Propiedades de "Desarrollo de interés" (opciones con "macrolotes") + mapa valor→etiqueta
    const devProps: string[] = [];
    const optLabel: Record<string, Record<string, string>> = {};
    try {
      const props = await hsGet("/crm/v3/properties/deals");
      for (const p of (props.results || [])) {
        const opts = p.options || [];
        if (opts.some((o: any) => norm(o.label).includes("macrolotes") || norm(o.value).includes("macrolotes"))) {
          devProps.push(p.name);
          const m: Record<string, string> = {};
          for (const o of opts) m[o.value] = o.label;
          optLabel[p.name] = m;
        }
      }
    } catch (_) {}

    // 2) Pipelines de Macrolotes (Venta Desarrollo / Venta Corretaje) + labels
    const pl = await hsGet("/crm/v3/pipelines/deals");
    const stageLabel: Record<string, string> = {};
    const pipeLabel: Record<string, string> = {};
    const macroPipeIds: string[] = [];
    for (const p of (pl.results || [])) {
      pipeLabel[p.id] = p.label;
      for (const s of (p.stages || [])) stageLabel[s.id] = s.label;
      if (norm(p.label).includes("desarrollo") || norm(p.label).includes("corretaje")) macroPipeIds.push(p.id);
    }
    if (!macroPipeIds.length) throw new Error("No encontré pipelines de Macrolotes (Venta Desarrollo / Venta Corretaje). Pipelines: " + Object.values(pipeLabel).join(", "));

    // 3) Owners → nombre del asesor
    const ownerName: Record<string, string> = {};
    try {
      let oa = "";
      do {
        const op = await hsGet("/crm/v3/owners?limit=100" + (oa ? "&after=" + oa : ""));
        for (const o of (op.results || [])) ownerName[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
        oa = op.paging?.next?.after || "";
      } while (oa);
    } catch (_) {}

    // 4) BÚSQUEDA por pipeline → solo deals de Macrolotes
    const properties = [...new Set(["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id", ...devProps])];
    let after: string | undefined = undefined;
    const rows: Record<string, unknown>[] = [];
    let guard = 0;
    do {
      const body: any = {
        filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "IN", values: macroPipeIds }] }],
        properties, limit: 100,
      };
      if (after) body.after = after;
      const page = await hsPost("/crm/v3/objects/deals/search", body);
      for (const d of (page.results || [])) {
        const pr = d.properties || {};
        let des = "";
        for (const dp of devProps) {
          const raw = (pr[dp] || "").toString();
          if (!raw) continue;
          const label = (optLabel[dp] && optLabel[dp][raw]) || raw;
          if (norm(label).includes("macrolotes")) { des = label; break; }
          if (!des) des = label;
        }
        if (!norm(des).includes("macrolotes")) des = des ? ("MACROLOTES " + des) : "OTRO DESARROLLO MACROLOTES";
        rows.push({
          deal_id: String(d.id),
          dealname: pr.dealname || null,
          dealstage_id: pr.dealstage || null,
          dealstage_label: stageLabel[pr.dealstage] || pr.dealstage || null,
          pipeline: pipeLabel[pr.pipeline] || pr.pipeline || null,
          amount: pr.amount ? Number(pr.amount) : null,
          hubspot_contact_id: null,
          desarrollo: des,
          owner: pr.hubspot_owner_id ? (ownerName[String(pr.hubspot_owner_id)] || null) : null,
          updated_at: new Date().toISOString(),
        });
      }
      after = page.paging?.next?.after;
    } while (after && ++guard < 200);

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("hubspot_deals").upsert(rows.slice(i, i + 500), { onConflict: "deal_id" });
      if (error) throw error;
    }
    return new Response(JSON.stringify({ ok: true, synced: rows.length, pipelines: macroPipeIds.length, devProps }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
