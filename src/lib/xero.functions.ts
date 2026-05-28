import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const XERO_SCOPES = "offline_access accounting.transactions accounting.settings accounting.journals";

function getRedirectUri(originOverride?: string) {
  if (originOverride) return `${originOverride.replace(/\/$/, "")}/api/public/xero/callback`;
  // Fallback: derive from forwarded headers (public origin), not the internal worker URL
  const forwardedHost = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host");
  const forwardedProto = getRequestHeader("x-forwarded-proto") ?? "https";
  if (!forwardedHost) throw new Error("Cannot determine redirect origin");
  return `${forwardedProto}://${forwardedHost}/api/public/xero/callback`;
}

/** Returns the Xero consent URL for the current admin to redirect to. */
export const startXeroAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origin?: string } | undefined) => data ?? {})
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const isAdmin = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin.data) throw new Error("Admin only");

    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) throw new Error("XERO_CLIENT_ID not configured");

    const state = `${userId}.${crypto.randomUUID()}`;
    // Stash state in DB for verification (clean up any stale pending rows first)
    await supabaseAdmin
      .from("integration_connections")
      .delete()
      .like("tenant_id", "pending:%")
      .eq("connected_by", userId);
    await supabaseAdmin.from("integration_connections").insert({
      provider: "xero",
      tenant_id: `pending:${state}`,
      connected_by: userId,
      metadata: { state, started_at: new Date().toISOString() },
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: getRedirectUri(data.origin),
      scope: XERO_SCOPES,
      state,
    });
    return { url: `https://login.xero.com/identity/connect/authorize?${params.toString()}` };
  });

/** Disconnects Xero (removes stored tokens). */
export const disconnectXero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const isAdmin = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin.data) throw new Error("Admin only");
    await supabaseAdmin.from("integration_connections").delete().eq("provider", "xero");
    return { ok: true };
  });