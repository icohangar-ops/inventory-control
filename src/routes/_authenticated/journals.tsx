import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/journals")({
  head: () => ({ meta: [{ title: "Journals · Inventory" }] }),
  component: JournalsPage,
});

function JournalsPage() {
  const { data: jbs = [] } = useQuery({
    queryKey: ["jbs"],
    queryFn: async () => (await supabase.from("journal_batches").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Journals</h1>
      <p className="text-sm text-muted-foreground mt-1">Period-end inventory & COGS journals posted to Xero.</p>
      <div className="mt-6 bg-card border border-border rounded-lg p-6">
        {jbs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No journals yet. Once Xero is connected, you'll be able to build and post period journals here. (Posting workflow ships in the next iteration.)</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr>
              <th className="text-left py-2">Period</th><th className="text-left py-2">Status</th><th className="text-right py-2">Total</th><th className="text-left py-2">Xero ID</th>
            </tr></thead>
            <tbody>{jbs.map((j) => (
              <tr key={j.id} className="border-t border-border">
                <td className="py-2">{j.period_start} → {j.period_end}</td>
                <td className="py-2">{j.status}</td>
                <td className="py-2 text-right">${Number(j.total_debit ?? 0).toFixed(2)}</td>
                <td className="py-2 text-xs">{j.xero_journal_id ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}