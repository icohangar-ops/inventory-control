import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Inventory" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [items, locs, mvs, pos] = await Promise.all([
        supabase.from("items").select("id", { count: "exact", head: true }),
        supabase.from("locations").select("id", { count: "exact", head: true }),
        supabase.from("stock_movements").select("id", { count: "exact", head: true }),
        supabase.from("purchase_orders").select("id", { count: "exact", head: true }).in("status", ["open", "partial"]),
      ]);
      const { data: levels } = await supabase.from("stock_levels").select("qty_on_hand, avg_cost");
      const value = (levels ?? []).reduce((s, l) => s + Number(l.qty_on_hand) * Number(l.avg_cost), 0);
      return {
        items: items.count ?? 0,
        locations: locs.count ?? 0,
        movements: mvs.count ?? 0,
        openPOs: pos.count ?? 0,
        stockValue: value,
      };
    },
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ["dashboard-lowstock"],
    queryFn: async () => {
      const { data: tracked } = await supabase
        .from("items")
        .select("id, sku, name, reorder_point")
        .not("reorder_point", "is", null)
        .eq("is_active", true);
      if (!tracked || tracked.length === 0) return [];
      const ids = tracked.map((i) => i.id);
      const { data: levels } = await supabase
        .from("stock_levels")
        .select("item_id, qty_on_hand")
        .in("item_id", ids);
      const totals = new Map<string, number>();
      (levels ?? []).forEach((l) => {
        totals.set(l.item_id, (totals.get(l.item_id) ?? 0) + Number(l.qty_on_hand));
      });
      return tracked
        .map((i) => ({ ...i, qty: totals.get(i.id) ?? 0 }))
        .filter((i) => i.qty <= Number(i.reorder_point))
        .sort((a, b) => a.qty - b.qty)
        .slice(0, 10);
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () =>
      (
        await supabase
          .from("stock_movements")
          .select("id, movement_type, qty, created_at, reference, items(sku,name)")
          .order("created_at", { ascending: false })
          .limit(8)
      ).data ?? [],
  });

  const stats = [
    { label: "Total stock value", value: data ? `$${data.stockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—" },
    { label: "Items", value: data?.items ?? "—" },
    { label: "Locations", value: data?.locations ?? "—" },
    { label: "Open POs", value: data?.openPOs ?? "—" },
    { label: "Movements logged", value: data?.movements ?? "—" },
  ];

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground mt-1">Inventory snapshot across all locations.</p>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-semibold mt-2">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Low-stock alerts</h2>
            <Link to="/items" className="text-xs text-muted-foreground hover:underline">
              Manage items
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing below reorder point. Set <code>reorder_point</code> on items to track them here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {lowStock.map((i) => (
                <li key={i.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{i.sku}</div>
                    <div>{i.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{i.qty}</div>
                    <div className="text-xs text-muted-foreground">
                      reorder at {i.reorder_point}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent movements</h2>
            <Link to="/movements" className="text-xs text-muted-foreground hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {recent.map((m: any) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.items?.sku ?? "—"}
                      </span>{" "}
                      {m.items?.name ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.movement_type} · {new Date(m.created_at).toLocaleString()}
                      {m.reference ? ` · ${m.reference}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">
                    {Number(m.qty) >= 0 ? "+" : ""}
                    {Number(m.qty).toFixed(2)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}