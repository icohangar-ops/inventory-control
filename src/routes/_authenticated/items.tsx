import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncPrecoroItems } from "@/lib/precoro.functions";

export const Route = createFileRoute("/_authenticated/items")({
  head: () => ({ meta: [{ title: "Items · Inventory" }] }),
  component: ItemsPage,
});

function ItemsPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["admin", "accountant"]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", uom: "EA", default_cost: "0" });
  const [syncing, setSyncing] = useState(false);
  const syncItems = useServerFn(syncPrecoroItems);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("sku");
      if (error) throw error;
      return data;
    },
  });

  const create = async () => {
    const { error } = await supabase.from("items").insert({
      sku: form.sku, name: form.name, uom: form.uom, default_cost: Number(form.default_cost) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Item created");
    setOpen(false);
    setForm({ sku: "", name: "", uom: "EA", default_cost: "0" });
    qc.invalidateQueries({ queryKey: ["items"] });
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncItems();
      if (!r.ok) {
        toast.error(r.error ?? "Precoro item sync failed");
        return;
      }
      toast.success(`Synced ${r.total} items (${r.created} new, ${r.updated} updated)`);
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Items</h1>
          <p className="text-sm text-muted-foreground mt-1">SKU master with Xero & Precoro mappings.</p>
        </div>
        <div className="flex gap-2">
        {canEdit && (
          <Button variant="outline" onClick={doSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync from Precoro"}
          </Button>
        )}
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>New item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>UoM</Label><Input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} /></div>
                  <div><Label>Default cost</Label><Input type="number" step="0.01" value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: e.target.value })} /></div>
                </div>
                <Button className="w-full" onClick={create} disabled={!form.sku || !form.name}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">SKU</th>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">UoM</th>
              <th className="text-right px-4 py-2.5">Default cost</th>
              <th className="text-left px-4 py-2.5">Xero ID</th>
              <th className="text-left px-4 py-2.5">Precoro ID</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No items yet. Click "New item" to add one, or sync from Xero in Settings.</td></tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-mono text-xs">{it.sku}</td>
                <td className="px-4 py-2.5">{it.name}</td>
                <td className="px-4 py-2.5">{it.uom}</td>
                <td className="px-4 py-2.5 text-right">${Number(it.default_cost).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{it.xero_item_id ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{it.precoro_item_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}