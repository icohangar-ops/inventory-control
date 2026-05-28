import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/xero/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) return htmlResult(`Xero returned: ${error}`, false);
        if (!code || !state) return htmlResult("Missing code or state", false);

        // Verify state matches a pending row
        const pending = await supabaseAdmin
          .from("integration_connections")
          .select("*")
          .eq("tenant_id", `pending:${state}`)
          .maybeSingle();
        if (!pending.data) return htmlResult("Invalid or expired state", false);

        const clientId = process.env.XERO_CLIENT_ID!;
        const clientSecret = process.env.XERO_CLIENT_SECRET!;
        const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
        const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
        const redirectUri = `${publicOrigin}/api/public/xero/callback`;
        const basic = btoa(`${clientId}:${clientSecret}`);

        // Exchange code for tokens
        const tokenRes = await fetch("https://identity.xero.com/connect/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });
        if (!tokenRes.ok) {
          const t = await tokenRes.text();
          return htmlResult(`Token exchange failed: ${t}`, false);
        }
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };

        // Fetch tenant connections
        const connRes = await fetch("https://api.xero.com/connections", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const connections = (await connRes.json()) as Array<{ tenantId: string; tenantName: string }>;
        const tenant = connections[0];
        if (!tenant) return htmlResult("No Xero tenant authorized", false);

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Remove pending row, then upsert real connection
        await supabaseAdmin.from("integration_connections").delete().eq("tenant_id", `pending:${state}`);
        await supabaseAdmin.from("integration_connections").delete().eq("provider", "xero");
        await supabaseAdmin.from("integration_connections").insert({
          provider: "xero",
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          connected_by: pending.data.connected_by,
          metadata: { connections },
        });

        return htmlResult(`Connected to ${tenant.tenantName}`, true);
      },
    },
  },
});

function htmlResult(message: string, ok: boolean) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Xero</title>
<style>body{font-family:system-ui;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{max-width:420px;padding:32px;border:1px solid #333;border-radius:12px;text-align:center}
.ok{color:#4ade80}.err{color:#f87171}a{color:#60a5fa}</style></head>
<body><div class="box">
<h1 class="${ok ? "ok" : "err"}">${ok ? "✓ Xero connected" : "✗ Connection failed"}</h1>
<p>${message}</p>
<p><a href="/settings">Back to Settings</a></p>
<script>if(window.opener){window.opener.postMessage({xero:${ok}},'*');setTimeout(()=>window.close(),1500);}</script>
</div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}