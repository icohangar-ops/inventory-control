import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { syncPrecoroPOs } from "@/lib/precoro.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  head: () => ({ meta: [{ title: "Purchase orders · Inventory" }] }),
  component: POPage,
});

function POPage() {
  const qc = useQueryClient();
  const sync = useServerFn(syncPrecoroPOs);
  const [busy, setBusy] = useState(false);
  const { data: pos = [] } = useQuery({
    queryKey: ["pos"],
    queryFn: async () =>
      (await supabase.from("purchase_orders").select("*").order("ordered_at", { ascending: false }))
        .data ?? [],
  });

  const doSync = async () => {
    setBusy(true);
    try {
      const r = await sync();
      if (!r.ok) {
        toast.error(r.error ?? "Precoro sync failed");
        return;
      }
      toast.success(`Synced ${r.posSynced} POs (${r.linesSynced} lines)`);
      qc.invalidateQueries({ queryKey: ["pos"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Synced from Precoro. Click a PO to receive against it.
          </p>
        </div>
        <Button onClick={doSync} disabled={busy}>
          {busy ? "Syncing…" : "Sync POs from Precoro"}
        </Button>
      </div>
      <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">PO #</th>
              <th className="text-left px-4 py-2.5">Vendor</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="text-left px-4 py-2.5">Expected</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No POs yet. Connect Precoro in Settings and click "Sync POs".
                </td>
              </tr>
            )}
            {pos.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono text-xs">
                  <Link
                    to="/purchase-orders/$poId"
                    params={{ poId: p.id }}
                    className="text-primary hover:underline"
                  >
                    {p.po_number}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{p.vendor_name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-secondary">
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {p.total_amount ? `${p.currency} ${Number(p.total_amount).toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {p.expected_at ? new Date(p.expected_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
