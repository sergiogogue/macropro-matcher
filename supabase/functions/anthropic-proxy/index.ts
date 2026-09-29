// ════════════════════════════════════════════════════════════════════
// Edge Function · anthropic-proxy  (R-01 del spec de remediación)
// Proxy servidor para la IA: la app YA NO manda la API key de Anthropic
// desde el navegador. El token vive AQUÍ como secreto de Edge Function.
//
// Despliegue:
//   1) supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (la key NUEVA rotada)
//   2) supabase functions deploy anthropic-proxy
//   3) En index.html, reemplazar las llamadas a api.anthropic.com por:
//        const { data, error } = await sb.functions.invoke('anthropic-proxy',
//          { body: { prompt, model, max_tokens, system } });
//   4) Borrar el uso de localStorage 'macropro_api_key'.
//   5) Rotar/revocar la key vieja en Anthropic Console.
//
// Seguridad:
//   - Exige sesión Supabase válida (Authorization: Bearer <access_token>).
//   - CORS restringido al origen de MacroPro.
//   - La key nunca sale al cliente.
// ════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Orígenes permitidos (ajusta si cambia el dominio de la app).
const ALLOWED_ORIGINS = [
  "https://sergiogogue.github.io",
  "https://macrolotes.grupoguia.mx",
];
const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });

  // 1) Exigir sesión Supabase válida (rechaza sin JWT)
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "No autorizado: falta sesión." }, 401, origin);
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await sb.auth.getUser(jwt);
    if (error || !user) return json({ error: "No autorizado: sesión inválida." }, 401, origin);
  } catch (_) {
    return json({ error: "No autorizado." }, 401, origin);
  }

  // 2) Llamar a Anthropic con la key del secreto (nunca sale al cliente)
  try {
    const body = await req.json();
    const model = body.model || "claude-sonnet-5";
    const max_tokens = Math.min(Number(body.max_tokens) || 1024, 8192);
    const messages = body.messages || [{ role: "user", content: String(body.prompt || "") }];
    const payload: Record<string, unknown> = { model, max_tokens, messages };
    if (body.system) payload.system = body.system;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return json(data, r.status, origin);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500, origin);
  }
});

function json(obj: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
