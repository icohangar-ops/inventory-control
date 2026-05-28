import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { startXeroAuth, disconnectXero } from "@/lib/xero.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Inventory" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const startXero = useServerFn(startXeroAuth);
  const dcXero = useServerFn(disconnectXero);
  const [busy, setBusy] = useState(false);
  const { data: conns = [] } = useQuery({
    queryKey: ["integration_connections"],
    queryFn: async () => (await supabase.from("integration_connections").select("provider, tenant_name, expires_at, updated_at")).data ?? [],
    enabled: hasRole("admin"),
  });

  if (!hasRole("admin")) {
    return <div className="p-8 text-sm text-muted-foreground">Admin only.</div>;
  }

  const xero = conns.find((c) => c.provider === "xero");
  const precoro = conns.find((c) => c.provider === "precoro");

  const connectXero = async () => {
    setBusy(true);
    try {
      const { url } = await startXero({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Xero auth");
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await dcXero();
      toast.success("Xero disconnected");
      qc.invalidateQueries({ queryKey: ["integration_connections"] });
    } finally { setBusy(false); }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">Integrations and users.</p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Integrations</h2>
      <div className="mt-3 space-y-3">
        <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">Xero</div>
            <div className="text-xs text-muted-foreground mt-1">OAuth2 — pulls chart of accounts & items, posts journals.</div>
            {xero?.tenant_name && <div className="text-xs mt-2">Tenant: <span className="font-mono">{xero.tenant_name}</span></div>}
          </div>
          <div className="text-right space-y-2">
            <div className="text-xs px-2 py-0.5 rounded bg-secondary inline-block">{xero ? "Connected" : "Not connected"}</div>
            <div>
              {xero ? (
                <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>Disconnect</Button>
              ) : (
                <Button size="sm" onClick={connectXero} disabled={busy}>{busy ? "…" : "Connect Xero"}</Button>
              )}
            </div>
          </div>
        </div>
        <IntegrationCard
          name="Precoro"
          status={precoro ? "Connected (API token)" : "API token configured"}
          tenant={precoro?.tenant_name}
          note="API token — pulls approved POs for receiving. Sync from the Purchase Orders page."
          action=""
        />
        <IntegrationCard
          name="Syft"
          status="CSV export"
          tenant={null}
          note="Use the Exports page to download valuation & movement CSVs."
          action=""
        />
      </div>
    </div>
  );
}

function IntegrationCard({ name, status, tenant, note, action }: { name: string; status: string; tenant?: string | null; note: string; action: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground mt-1">{note}</div>
        {tenant && <div className="text-xs mt-2">Tenant: <span className="font-mono">{tenant}</span></div>}
      </div>
      <div className="text-right">
        <div className="text-xs px-2 py-0.5 rounded bg-secondary inline-block">{status}</div>
        {action && <div className="text-xs text-muted-foreground mt-2">{action}</div>}
      </div>
    </div>
  );
}