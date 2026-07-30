// ════════════════════════════════════════════════════════════════════
// Edge Function · Importa los deals de HubSpot de MACROLOTES → public.hubspot_deals.
// Búsqueda por PIPELINE (Venta Desarrollo / Venta Corretaje). Maneja rate-limit (429)
// con reintentos + espera. El token vive AQUÍ. MacroPro solo LEE.
// ════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch con reintento en 429 (rate limit) y 5xx
async function hsFetch(path: string, init?: RequestInit): Promise<any> {
  for (let attempt = 0; attempt < 7; attempt++) {
    const r = await fetch("https://api.hubapi.com" + path, {
      ...(init || {}),
      headers: { Authorization: "Bearer " + HUBSPOT_TOKEN, "Content-Type": "application/json", ...((init && init.headers) || {}) },
    });
    if (r.status === 429 || r.status >= 500) {
      const ra = Number(r.headers.get("Retry-After")) || (attempt + 1);
      await sleep(ra * 1000);
      continue;
    }
    if (!r.ok) throw new Error("HubSpot " + ((init && init.method) || "GET") + " " + path + " -> " + r.status + " " + (await r.text()));
    return r.json();
  }
  throw new Error("HubSpot " + path + " -> demasiados 429 (rate limit). Reintenta en 1 minuto.");
}
const hsGet = (p: string) => hsFetch(p);
const hsPost = (p: string, body: unknown) => hsFetch(p, { method: "POST", body: JSON.stringify(body) });
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

    // 2) Pipelines de Macrolotes + labels
    const pl = await hsGet("/crm/v3/pipelines/deals");
    const stageLabel: Record<string, string> = {};
    const pipeLabel: Record<string, string> = {};
    const macroPipeIds: string[] = [];
    for (const p of (pl.results || [])) {
      pipeLabel[p.id] = p.label;
      for (const s of (p.stages || [])) stageLabel[s.id] = s.label;
      if (norm(p.label).includes("desarrollo") || norm(p.label).includes("corretaje")) macroPipeIds.push(p.id);
    }
    if (!macroPipeIds.length) throw new Error("No encontré pipelines de Macrolotes. Pipelines: " + Object.values(pipeLabel).join(", "));

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

    // 4) BÚSQUEDA por pipeline + SOLO últimos 90 días (más liviano, sin rate-limit)
    const properties = [...new Set(["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id", ...devProps])];
    const cutoff = String(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).setUTCHours(0, 0, 0, 0)); // epoch ms · últimos 3 meses
    let after: string | undefined = undefined;
    const rows: Record<string, unknown>[] = [];
    let guard = 0;
    do {
      const body: any = {
        filterGroups: [{ filters: [
          { propertyName: "pipeline", operator: "IN", values: macroPipeIds },
          { propertyName: "createdate", operator: "GTE", value: cutoff },
        ] }],
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
      if (after) await sleep(350);
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
