import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exports")({
  head: () => ({ meta: [{ title: "Exports · Inventory" }] }),
  component: ExportsPage,
});

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, any>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function ExportsPage() {
  const valuation = async () => {
    const { data, error } = await supabase
      .from("stock_levels")
      .select("qty_on_hand, avg_cost, items(sku,name,uom), locations(code,name)");
    if (error) return toast.error(error.message);
    const rows = (data ?? []).map((r: any) => ({
      sku: r.items?.sku, name: r.items?.name, uom: r.items?.uom,
      location_code: r.locations?.code, location_name: r.locations?.name,
      qty_on_hand: r.qty_on_hand, avg_cost: r.avg_cost,
      value: (Number(r.qty_on_hand) * Number(r.avg_cost)).toFixed(2),
    }));
    download(`valuation_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows));
  };

  const movements = async () => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("created_at, movement_type, qty, unit_cost, reference, reason, items(sku,name), from_loc:from_location_id(code), to_loc:to_location_id(code)")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const rows = (data ?? []).map((m: any) => ({
      date: m.created_at, type: m.movement_type, sku: m.items?.sku, name: m.items?.name,
      from: m.from_loc?.code ?? "", to: m.to_loc?.code ?? "",
      qty: m.qty, unit_cost: m.unit_cost, value: (Number(m.qty) * Number(m.unit_cost)).toFixed(2),
      reference: m.reference ?? "", reason: m.reason ?? "",
    }));
    download(`movements_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows));
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Exports for Syft</h1>
      <p className="text-sm text-muted-foreground mt-1">CSV exports that supplement Xero data in Syft consolidation.</p>
      <div className="mt-6 space-y-3">
        <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between">
          <div>
            <div className="font-medium">Stock valuation snapshot</div>
            <div className="text-xs text-muted-foreground mt-1">Item × location qty × avg cost = value, as of right now.</div>
          </div>
          <Button onClick={valuation}>Download CSV</Button>
        </div>
        <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between">
          <div>
            <div className="font-medium">Movement ledger</div>
            <div className="text-xs text-muted-foreground mt-1">All receipts, issues, transfers, and adjustments.</div>
          </div>
          <Button onClick={movements}>Download CSV</Button>
        </div>
      </div>
    </div>
  );
}