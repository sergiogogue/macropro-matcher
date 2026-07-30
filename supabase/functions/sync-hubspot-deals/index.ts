// ════════════════════════════════════════════════════════════════════
// Edge Function · Importa TODOS los deals de HubSpot (todos los pipelines) →
// public.hubspot_deals (el espejo que lee el "🔶 Kanban HubSpot" de MacroPro).
// El token vive AQUÍ (servidor). MacroPro nunca toca HubSpot; solo lee la tabla.
//
// Secrets (Supabase → Project Settings → Edge Functions → Secrets):
//   HUBSPOT_TOKEN   (token privado; scopes: crm.objects.deals.read, crm.schemas.deals.read,
//                    crm.objects.owners.read, crm.objects.contacts.read)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (los inyecta Supabase solo)
//
// Deploy:  supabase functions deploy sync-hubspot-deals --no-verify-jwt
// Probar:  supabase functions invoke sync-hubspot-deals   → { ok:true, synced:N }
// Cron:    ver README.md (pg_cron cada 10 min)
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Propiedad interna de HubSpot con el desarrollo (ajústala si tienes otra; si no, quedará null).
const DESARROLLO_PROP = "desarrollo";

async function hs(path: string) {
  const r = await fetch("https://api.hubapi.com" + path, {
    headers: { Authorization: "Bearer " + HUBSPOT_TOKEN, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error("HubSpot " + path + " → " + r.status + " " + (await r.text()));
  return r.json();
}

Deno.serve(async () => {
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Pipelines → labels de etapa y de pipeline (TODOS los pipelines)
    const pl = await hs("/crm/v3/pipelines/deals");
    const stageLabel: Record<string, string> = {};
    const pipeLabel: Record<string, string> = {};
    for (const p of (pl.results || [])) {
      pipeLabel[p.id] = p.label;
      for (const s of (p.stages || [])) stageLabel[s.id] = s.label;
    }

    // 2) Owners → nombre del asesor
    const ownerName: Record<string, string> = {};
    try {
      let oa = "";
      do {
        const op = await hs("/crm/v3/owners?limit=100" + (oa ? "&after=" + oa : ""));
        for (const o of (op.results || [])) {
          ownerName[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
        }
        oa = op.paging?.next?.after || "";
      } while (oa);
    } catch (_) { /* si falla owners, seguimos sin nombre */ }

    // 3) Todos los deals (paginado) con propiedades + contacto asociado
    const props = ["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id", DESARROLLO_PROP]
      .filter(Boolean).join(",");
    let after = "";
    const rows: Record<string, unknown>[] = [];
    let guard = 0;
    do {
      const page = await hs(
        `/crm/v3/objects/deals?limit=100&properties=${props}&associations=contacts` +
        (after ? `&after=${after}` : "")
      );
      for (const d of (page.results || [])) {
        const pr = d.properties || {};
        rows.push({
          deal_id: String(d.id),
          dealname: pr.dealname || null,
          dealstage_id: pr.dealstage || null,
          dealstage_label: stageLabel[pr.dealstage] || pr.dealstage || null,
          pipeline: pipeLabel[pr.pipeline] || pr.pipeline || null,
          amount: pr.amount ? Number(pr.amount) : null,
          hubspot_contact_id: d.associations?.contacts?.results?.[0]?.id || null,
          desarrollo: pr[DESARROLLO_PROP] || null,
          owner: pr.hubspot_owner_id ? (ownerName[String(pr.hubspot_owner_id)] || null) : null,
          updated_at: new Date().toISOString(),
        });
      }
      after = page.paging?.next?.after || "";
    } while (after && ++guard < 500);

    // 4) Upsert en el espejo
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("hubspot_deals").upsert(rows.slice(i, i + 500), { onConflict: "deal_id" });
      if (error) throw error;
    }
    return new Response(JSON.stringify({ ok: true, synced: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
