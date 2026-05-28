import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const PRECORO_BASES = ["https://api.precoro.com", "https://api.precoro.us"];

interface PrecoroPO {
  id: number | string;
  idNumber?: string;
  number?: string;
  status?: string;
  supplier?: { name?: string } | null;
  currency?: string;
  total?: number;
  date?: string;
  deliveryDate?: string;
  items?: Array<{
    id?: number | string;
    productId?: number | string;
    name?: string;
    sku?: string;
    quantity?: number;
    price?: number;
  }>;
}

interface PrecoroProduct {
  id: number | string;
  name?: string;
  code?: string;
  sku?: string;
  description?: string;
  unit?: string;
  uom?: string;
  price?: number;
  cost?: number;
}

async function precoroFetch(
  path: string,
  email: string,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const token = process.env.PRECORO_API_TOKEN?.trim();
  if (!token) return { ok: false, error: "Precoro API token is not configured." };
  if (!email) return { ok: false, error: "Precoro requires the API user's email." };
  const bases = Array.from(
    new Set([process.env.PRECORO_BASE_URL?.replace(/\/$/, ""), ...PRECORO_BASES].filter(Boolean)),
  ) as string[];
  let res: Response | null = null;
  let lastError = "";
  for (const base of bases) {
    res = await fetch(`${base}${path}`, {
      headers: { "X-AUTH-TOKEN": token, email, Accept: "application/json" },
    });
    if (res.ok) break;
    lastError = (await res.text()).slice(0, 200);
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) break;
  }
  if (!res?.ok) return { ok: false, error: `Precoro API ${res?.status ?? "error"}: ${lastError || "Request failed"}` };
  return { ok: true, json: await res.json() };
}

async function assertRole(userId: string) {
  const r = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "warehouse", "accountant"])
    .maybeSingle();
  if (!r.data) throw new Error("Not authorized");
}

/** Pulls products from Precoro and upserts them into items by sku/precoro_item_id. */
export const syncPrecoroItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.userId);
    const claimEmail = (context.claims as Record<string, unknown>).email;
    const email =
      process.env.PRECORO_EMAIL?.trim() || (typeof claimEmail === "string" ? claimEmail : "");
    const result = await precoroFetch("/products?limit=500", email);
    if (!result.ok) return { ok: false as const, error: result.error };
    const payload = result.json as { data?: PrecoroProduct[] } | PrecoroProduct[];
    const list: PrecoroProduct[] = Array.isArray(payload) ? payload : (payload.data ?? []);

    let created = 0;
    let updated = 0;
    for (const p of list) {
      const precoroId = String(p.id);
      const sku = (p.sku ?? p.code ?? `PRC-${precoroId}`).trim();
      const row = {
        sku,
        name: p.name ?? sku,
        description: p.description ?? null,
        uom: (p.uom ?? p.unit ?? "EA").slice(0, 16),
        default_cost: Number(p.cost ?? p.price ?? 0),
        precoro_item_id: precoroId,
        is_tracked: true,
        is_active: true,
      };
      // Match by precoro_item_id first, then sku
      const byPrecoro = await supabaseAdmin
        .from("items")
        .select("id")
        .eq("precoro_item_id", precoroId)
        .maybeSingle();
      const existingId =
        byPrecoro.data?.id ??
        (await supabaseAdmin.from("items").select("id").eq("sku", sku).maybeSingle()).data?.id;
      if (existingId) {
        await supabaseAdmin.from("items").update(row).eq("id", existingId);
        updated++;
      } else {
        const ins = await supabaseAdmin.from("items").insert(row);
        if (!ins.error) created++;
      }
    }
    return { ok: true as const, created, updated, total: list.length };
  });

/** Pulls open / approved POs from Precoro and upserts them locally. */
export const syncPrecoroPOs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const role = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "warehouse", "accountant"])
      .maybeSingle();
    if (!role.data) throw new Error("Not authorized");

    const token = process.env.PRECORO_API_TOKEN?.trim();
    if (!token) return { ok: false, error: "Precoro API token is not configured." };

    const claimEmail = (claims as Record<string, unknown>).email;
    const precoroEmail =
      process.env.PRECORO_EMAIL?.trim() || (typeof claimEmail === "string" ? claimEmail : "");
    if (!precoroEmail) {
      return {
        ok: false,
        error: "Precoro requires the API user's email as well as the API token.",
      };
    }

    // Precoro authenticates with X-AUTH-TOKEN + email headers, not Bearer auth.
    const bases = Array.from(
      new Set([process.env.PRECORO_BASE_URL?.replace(/\/$/, ""), ...PRECORO_BASES].filter(Boolean)),
    ) as string[];
    let res: Response | null = null;
    let lastError = "";
    for (const base of bases) {
      res = await fetch(`${base}/purchaseorders?limit=100`, {
        headers: { "X-AUTH-TOKEN": token, email: precoroEmail, Accept: "application/json" },
      });
      if (res.ok) break;
      lastError = (await res.text()).slice(0, 200);
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) break;
    }
    if (!res?.ok) {
      return {
        ok: false,
        error: `Precoro API ${res?.status ?? "error"}: ${lastError || "Request failed"}`,
      };
    }
    const payload = (await res.json()) as { data?: PrecoroPO[] } | PrecoroPO[];
    const list: PrecoroPO[] = Array.isArray(payload) ? payload : (payload.data ?? []);

    let upserted = 0;
    let linesUpserted = 0;

    for (const po of list) {
      const precoroId = String(po.id);
      const poNumber = po.idNumber ?? po.number ?? precoroId;

      // Upsert PO by precoro_id
      const existing = await supabaseAdmin
        .from("purchase_orders")
        .select("id")
        .eq("precoro_id", precoroId)
        .maybeSingle();

      let poId = existing.data?.id;
      const poRow = {
        precoro_id: precoroId,
        po_number: poNumber,
        vendor_name: po.supplier?.name ?? null,
        currency: po.currency ?? "USD",
        total_amount: po.total ?? 0,
        status: "open" as const,
        ordered_at: po.date ? new Date(po.date).toISOString() : null,
        expected_at: po.deliveryDate ? new Date(po.deliveryDate).toISOString() : null,
        synced_at: new Date().toISOString(),
        raw_payload: po as unknown as Json,
      };

      if (poId) {
        await supabaseAdmin.from("purchase_orders").update(poRow).eq("id", poId);
      } else {
        const ins = await supabaseAdmin.from("purchase_orders").insert(poRow).select("id").single();
        poId = ins.data?.id;
      }
      if (!poId) continue;
      upserted++;

      // Match lines by sku → item, then upsert
      const lines = po.items ?? [];
      // Wipe existing lines for clean re-sync
      await supabaseAdmin.from("po_lines").delete().eq("po_id", poId);
      let lineNum = 1;
      for (const ln of lines) {
        let itemId: string | null = null;
        if (ln.sku) {
          const m = await supabaseAdmin.from("items").select("id").eq("sku", ln.sku).maybeSingle();
          itemId = m.data?.id ?? null;
        }
        if (!itemId && ln.productId != null) {
          const m = await supabaseAdmin
            .from("items")
            .select("id")
            .eq("precoro_item_id", String(ln.productId))
            .maybeSingle();
          itemId = m.data?.id ?? null;
        }
        await supabaseAdmin.from("po_lines").insert({
          po_id: poId,
          line_number: lineNum++,
          item_id: itemId,
          precoro_item_id: ln.productId != null ? String(ln.productId) : null,
          description: ln.name ?? null,
          qty_ordered: ln.quantity ?? 0,
          qty_received: 0,
          unit_cost: ln.price ?? 0,
        });
        linesUpserted++;
      }
    }

    // Record the sync (replace existing precoro row)
    await supabaseAdmin.from("integration_connections").delete().eq("provider", "precoro");
    await supabaseAdmin.from("integration_connections").insert({
      provider: "precoro",
      tenant_id: "precoro:default",
      tenant_name: "Precoro",
      connected_by: userId,
      metadata: { last_sync: new Date().toISOString(), pos_synced: upserted },
    });

    return { ok: true, posSynced: upserted, linesSynced: linesUpserted };
  });
