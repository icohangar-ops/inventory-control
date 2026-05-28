import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock on hand · Inventory" }] }),
  component: StockPage,
});

function StockPage() {
  const { data = [] } = useQuery({
    queryKey: ["stock-on-hand"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_levels")
        .select("qty_on_hand, avg_cost, items(sku,name,uom), locations(code,name)");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Stock on hand</h1>
      <p className="text-sm text-muted-foreground mt-1">Live qty and weighted-average cost per location.</p>
      <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">SKU</th>
              <th className="text-left px-4 py-2.5">Item</th>
              <th className="text-left px-4 py-2.5">Location</th>
              <th className="text-right px-4 py-2.5">Qty</th>
              <th className="text-right px-4 py-2.5">Avg cost</th>
              <th className="text-right px-4 py-2.5">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No stock yet.</td></tr>}
            {data.map((r: any, i: number) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2.5 font-mono text-xs">{r.items?.sku}</td>
                <td className="px-4 py-2.5">{r.items?.name}</td>
                <td className="px-4 py-2.5 text-xs">{r.locations?.code} · {r.locations?.name}</td>
                <td className="px-4 py-2.5 text-right">{Number(r.qty_on_hand).toFixed(2)} {r.items?.uom}</td>
                <td className="px-4 py-2.5 text-right">${Number(r.avg_cost).toFixed(4)}</td>
                <td className="px-4 py-2.5 text-right font-medium">${(Number(r.qty_on_hand) * Number(r.avg_cost)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}