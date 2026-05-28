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

export const Route = createFileRoute("/_authenticated/locations")({
  head: () => ({ meta: [{ title: "Locations · Inventory" }] }),
  component: LocationsPage,
});

function LocationsPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", address: "" });

  const { data: locs = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("code");
      if (error) throw error; return data;
    },
  });

  const create = async () => {
    const { error } = await supabase.from("locations").insert({ code: form.code, name: form.name, address: form.address || null });
    if (error) return toast.error(error.message);
    toast.success("Location created");
    setOpen(false); setForm({ code: "", name: "", address: "" });
    qc.invalidateQueries({ queryKey: ["locations"] });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground mt-1">Warehouses and stock rooms.</p>
        </div>
        {hasRole("admin") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>New location</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New location</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WH1" /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <Button onClick={create} disabled={!form.code || !form.name} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {locs.length === 0 && <div className="text-sm text-muted-foreground col-span-full">No locations yet.</div>}
        {locs.map((l) => (
          <div key={l.id} className="bg-card border border-border rounded-lg p-4">
            <div className="font-mono text-xs text-muted-foreground">{l.code}</div>
            <div className="font-medium mt-1">{l.name}</div>
            {l.address && <div className="text-xs text-muted-foreground mt-2">{l.address}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}