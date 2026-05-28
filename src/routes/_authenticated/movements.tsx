import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/movements")({
  head: () => ({ meta: [{ title: "Movements · Inventory" }] }),
  component: MovementsPage,
});

type Form = {
  movement_type: "receipt" | "issue" | "transfer" | "adjustment";
  item_id: string;
  from_location_id: string;
  to_location_id: string;
  qty: string;
  unit_cost: string;
  reference: string;
  reason: string;
};

function MovementsPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canWrite = hasAnyRole(["admin", "warehouse", "accountant"]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>({ movement_type: "receipt", item_id: "", from_location_id: "", to_location_id: "", qty: "", unit_cost: "0", reference: "", reason: "" });

  const { data: items = [] } = useQuery({ queryKey: ["items-min"], queryFn: async () => (await supabase.from("items").select("id,sku,name").order("sku")).data ?? [] });
  const { data: locs = [] } = useQuery({ queryKey: ["locs-min"], queryFn: async () => (await supabase.from("locations").select("id,code,name").order("code")).data ?? [] });
  const { data: mv = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => (await supabase
      .from("stock_movements")
      .select("*, items(sku,name), from_loc:from_location_id(code), to_loc:to_location_id(code)")
      .order("created_at", { ascending: false })
      .limit(200)).data ?? [],
  });

  const submit = async () => {
    const payload: any = {
      movement_type: f.movement_type,
      item_id: f.item_id,
      qty: Number(f.qty),
      unit_cost: Number(f.unit_cost) || 0,
      reference: f.reference || null,
      reason: f.reason || null,
      from_location_id: f.from_location_id || null,
      to_location_id: f.to_location_id || null,
    };
    const { error } = await supabase.from("stock_movements").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Movement recorded");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const needsFrom = f.movement_type !== "receipt";
  const needsTo = f.movement_type === "receipt" || f.movement_type === "transfer";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movements</h1>
          <p className="text-sm text-muted-foreground mt-1">Append-only stock ledger.</p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>New movement</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Record movement</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={f.movement_type} onValueChange={(v) => setF({ ...f, movement_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">Receipt (in)</SelectItem>
                      <SelectItem value="issue">Issue (out)</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="adjustment">Adjustment (+/-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Item</Label>
                  <Select value={f.item_id} onValueChange={(v) => setF({ ...f, item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.sku} — {i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {needsFrom && (
                  <div>
                    <Label>{f.movement_type === "adjustment" ? "Location" : "From"}</Label>
                    <Select value={f.from_location_id} onValueChange={(v) => setF({ ...f, from_location_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                      <SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {needsTo && (
                  <div>
                    <Label>To</Label>
                    <Select value={f.to_location_id} onValueChange={(v) => setF({ ...f, to_location_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                      <SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Quantity</Label><Input type="number" step="0.01" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></div>
                  {(f.movement_type === "receipt" || f.movement_type === "adjustment") && (
                    <div><Label>Unit cost</Label><Input type="number" step="0.0001" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></div>
                  )}
                </div>
                <div><Label>Reference</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="PO#, doc, etc." /></div>
                <div><Label>Reason / notes</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
                <Button className="w-full" onClick={submit} disabled={!f.item_id || !f.qty}>Record</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">When</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Item</th>
              <th className="text-left px-4 py-2.5">From → To</th>
              <th className="text-right px-4 py-2.5">Qty</th>
              <th className="text-right px-4 py-2.5">Unit cost</th>
              <th className="text-left px-4 py-2.5">Ref</th>
            </tr>
          </thead>
          <tbody>
            {mv.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No movements yet.</td></tr>}
            {mv.map((m: any) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-2.5 text-xs">{new Date(m.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5"><span className="inline-block px-2 py-0.5 rounded text-xs bg-secondary">{m.movement_type}</span></td>
                <td className="px-4 py-2.5"><span className="font-mono text-xs">{m.items?.sku}</span> {m.items?.name}</td>
                <td className="px-4 py-2.5 text-xs">{m.from_loc?.code ?? "—"} → {m.to_loc?.code ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{Number(m.qty).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right">${Number(m.unit_cost).toFixed(4)}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}