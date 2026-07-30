// ════════════════════════════════════════════════════════════════════
// Edge Function · Sincroniza TODOS los deals de HubSpot → public.hubspot_deals
// (la tabla ESPEJO que lee MacroPro para el "🔶 Kanban HubSpot").
// MacroPro NUNCA toca HubSpot: solo lee esta tabla. Aquí vive el token, del lado servidor.
//
// Secrets requeridos (Supabase → Project Settings → Edge Functions → Secrets):
//   HUBSPOT_TOKEN                (token privado de HubSpot con scope crm.objects.deals.read)
//   SUPABASE_URL                 (se inyecta solo en Edge Functions)
//   SUPABASE_SERVICE_ROLE_KEY    (se inyecta solo; omite RLS para poder escribir)
//
// Deploy:  supabase functions deploy sync-hubspot-deals --no-verify-jwt
// Probar:  supabase functions invoke sync-hubspot-deals   (o abrir su URL)
// Cron:    en Supabase → Database → Cron (pg_cron) llama la función cada X min (ver README).
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── AJUSTA SI HACE FALTA ──────────────────────────────────────────────
// Nombre INTERNO de la propiedad de HubSpot que guarda el desarrollo (para el filtro
// de desarrollos en MacroPro). Si no tienes una, déjalo así y `desarrollo` quedará null.
const DESARROLLO_PROP = "desarrollo";
// Filtra por este pipeline (por su LABEL). Deja "" para traer TODOS los pipelines.
const PIPELINE_LABEL = "Venta Desarrollo";
// ──────────────────────────────────────────────────────────────────────

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

    // 1) Pipelines → mapas stageId→label y pipelineId→label (para poblar dealstage_label)
    const pl = await hs("/crm/v3/pipelines/deals");
    const stageLabel: Record<string, string> = {};
    const pipelineLabel: Record<string, string> = {};
    let targetPipelineId = "";
    for (const p of (pl.results || [])) {
      pipelineLabel[p.id] = p.label;
      if (PIPELINE_LABEL && p.label === PIPELINE_LABEL) targetPipelineId = p.id;
      for (const s of (p.stages || [])) stageLabel[s.id] = s.label;
    }

    // 2) Traer TODOS los deals (paginado) con sus propiedades + contacto asociado
    const props = ["dealname", "amount", "dealstage", "pipeline", DESARROLLO_PROP]
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
        if (targetPipelineId && pr.pipeline && pr.pipeline !== targetPipelineId) continue;
        const contactId = d.associations?.contacts?.results?.[0]?.id || null;
        rows.push({
          deal_id: String(d.id),
          dealname: pr.dealname || null,
          dealstage_id: pr.dealstage || null,
          dealstage_label: stageLabel[pr.dealstage] || null,
          pipeline: pipelineLabel[pr.pipeline] || pr.pipeline || null,
          amount: pr.amount ? Number(pr.amount) : null,
          hubspot_contact_id: contactId,
          desarrollo: pr[DESARROLLO_PROP] || null,
          updated_at: new Date().toISOString(),
        });
      }
      after = page.paging?.next?.after || "";
    } while (after && ++guard < 500);

    // 3) Upsert en la tabla espejo (por deal_id)
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("hubspot_deals")
        .upsert(rows.slice(i, i + 500), { onConflict: "deal_id" });
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
