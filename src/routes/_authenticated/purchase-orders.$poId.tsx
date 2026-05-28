import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchase-orders/$poId")({
  head: () => ({ meta: [{ title: "Receive PO · Inventory" }] }),
  component: POReceivePage,
});

type LineDraft = {
  id: string;
  item_id: string | null;
  description: string | null;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  receive_now: string;
};

function POReceivePage() {
  const { poId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canWrite = hasAnyRole(["admin", "warehouse", "accountant"]);
  const [locationId, setLocationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<LineDraft[]>([]);

  const { data: po } = useQuery({
    queryKey: ["po", poId],
    queryFn: async () =>
      (await supabase.from("purchase_orders").select("*").eq("id", poId).single()).data,
  });
  const { data: lines = [] } = useQuery({
    queryKey: ["po-lines", poId],
    queryFn: async () =>
      (
        await supabase
          .from("po_lines")
          .select("*, items(sku,name)")
          .eq("po_id", poId)
          .order("line_number")
      ).data ?? [],
  });
  const { data: locs = [] } = useQuery({
    queryKey: ["locs-min"],
    queryFn: async () =>
      (await supabase.from("locations").select("id,code,name").order("code")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["items-min"],
    queryFn: async () =>
      (await supabase.from("items").select("id,sku,name").order("sku")).data ?? [],
  });

  useEffect(() => {
    setDrafts(
      lines.map((l: any) => ({
        id: l.id,
        item_id: l.item_id,
        description: l.description,
        qty_ordered: Number(l.qty_ordered),
        qty_received: Number(l.qty_received),
        unit_cost: Number(l.unit_cost),
        receive_now: String(
          Math.max(0, Number(l.qty_ordered) - Number(l.qty_received)),
        ),
      })),
    );
  }, [lines]);

  const updateDraft = (id: string, patch: Partial<LineDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const submit = async () => {
    if (!locationId) return toast.error("Pick a destination location");
    const toReceive = drafts.filter((d) => Number(d.receive_now) > 0);
    if (toReceive.length === 0) return toast.error("Enter a quantity to receive");
    const missingItem = toReceive.find((d) => !d.item_id);
    if (missingItem)
      return toast.error(
        `Line "${missingItem.description ?? ""}" is not linked to an item. Pick one first.`,
      );
    setBusy(true);
    try {
      for (const d of toReceive) {
        const qty = Number(d.receive_now);
        const { error: mErr } = await supabase.from("stock_movements").insert({
          movement_type: "receipt",
          item_id: d.item_id!,
          to_location_id: locationId,
          qty,
          unit_cost: d.unit_cost,
          reference: `PO ${po?.po_number ?? poId}`,
          po_id: poId,
        });
        if (mErr) throw new Error(mErr.message);
        const { error: lErr } = await supabase
          .from("po_lines")
          .update({ qty_received: d.qty_received + qty })
          .eq("id", d.id);
        if (lErr) throw new Error(lErr.message);
      }
      // Recompute PO status
      const updated = drafts.map((d) =>
        toReceive.find((t) => t.id === d.id)
          ? { ...d, qty_received: d.qty_received + Number(d.receive_now) }
          : d,
      );
      const allDone = updated.every((d) => d.qty_received >= d.qty_ordered);
      const anyDone = updated.some((d) => d.qty_received > 0);
      const newStatus = allDone ? "received" : anyDone ? "partial" : "open";
      await supabase.from("purchase_orders").update({ status: newStatus }).eq("id", poId);
      toast.success("Stock received");
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["po", poId] });
      qc.invalidateQueries({ queryKey: ["po-lines", poId] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
      navigate({ to: "/purchase-orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  if (!po) {
    return <div className="p-8 text-muted-foreground">Loading PO…</div>;
  }

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/purchase-orders" className="text-sm text-muted-foreground hover:underline">
        ← Back to purchase orders
      </Link>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PO {po.po_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {po.vendor_name ?? "—"} · {po.currency} {Number(po.total_amount ?? 0).toFixed(2)} ·
            status <span className="font-medium">{po.status}</span>
          </p>
        </div>
        <div className="w-64">
          <Label>Receive into location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locs.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Item</th>
              <th className="text-right px-4 py-2.5">Ordered</th>
              <th className="text-right px-4 py-2.5">Already received</th>
              <th className="text-right px-4 py-2.5">Unit cost</th>
              <th className="text-right px-4 py-2.5 w-32">Receive now</th>
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No lines on this PO.
                </td>
              </tr>
            )}
            {drafts.map((d) => {
              const matched = lines.find((l: any) => l.id === d.id);
              const linkedItem = matched?.items;
              return (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="px-4 py-2.5">
                    {linkedItem ? (
                      <div>
                        <div className="font-mono text-xs">{linkedItem.sku}</div>
                        <div>{linkedItem.name}</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-muted-foreground">
                          {d.description ?? "Unmatched line"}
                        </div>
                        <Select
                          value={d.item_id ?? ""}
                          onValueChange={(v) => updateDraft(d.id, { item_id: v })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Link to item…" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.sku} — {i.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">{d.qty_ordered}</td>
                  <td className="px-4 py-2.5 text-right">{d.qty_received}</td>
                  <td className="px-4 py-2.5 text-right">${d.unit_cost.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-right"
                      value={d.receive_now}
                      onChange={(e) => updateDraft(d.id, { receive_now: e.target.value })}
                      disabled={!canWrite}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/purchase-orders" })}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canWrite || busy || !locationId}>
          {busy ? "Receiving…" : "Receive stock"}
        </Button>
      </div>
    </div>
  );
}