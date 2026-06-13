/**
 * Pure inventory money/math helpers.
 *
 * These mirror the critical valuation, weighted-average-cost, and reorder
 * logic that is otherwise embedded in:
 *   - supabase/migrations/...apply_movement()  (SQL trigger, weighted avg cost)
 *   - src/routes/_authenticated/dashboard.tsx   (low-stock alerts, stock value)
 *   - src/routes/_authenticated/stock.tsx       (per-row valuation)
 *   - src/routes/_authenticated/exports.tsx     (valuation / movement value)
 *
 * Keeping the math in one tested place means a regression in any of those
 * call sites can be caught by a unit test against the formula, and the
 * frontend can import these instead of re-deriving the arithmetic inline.
 *
 * NOTE on precision: the database stores NUMERIC(14,4) and the UI renders with
 * fixed decimals. These helpers operate on JS numbers (IEEE-754) which is what
 * the frontend already uses via `Number(...)`. Callers that need exact decimal
 * semantics should round at the boundary (see `roundCost` / `roundQty`).
 */

/** DB column scale: qty and cost are NUMERIC(14,4) -> 4 decimal places. */
export const SCALE = 4;

/** Round to the DB's 4-decimal scale (matches NUMERIC(14,4) storage). */
export function round4(n: number): number {
  // Use a tiny epsilon-free, deterministic rounding to 4dp.
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

/**
 * Value of a single stock line = qty_on_hand * avg_cost.
 * Mirrors stock.tsx / exports.tsx / dashboard.tsx.
 */
export function lineValue(qtyOnHand: number, avgCost: number): number {
  return Number(qtyOnHand) * Number(avgCost);
}

/**
 * Total stock value across many lines.
 * Mirrors dashboard.tsx `levels.reduce((s,l) => s + qty*cost, 0)`.
 */
export function totalStockValue(
  lines: Array<{ qty_on_hand: number | string; avg_cost: number | string }>,
): number {
  return lines.reduce(
    (sum, l) => sum + Number(l.qty_on_hand) * Number(l.avg_cost),
    0,
  );
}

/**
 * Weighted-average cost after adding `inQty` units at `inUnitCost` to an
 * existing position of `curQty` units at `curCost`.
 *
 * Faithfully mirrors the SQL trigger:
 *   new_qty := cur_qty + NEW.qty;
 *   IF new_qty > 0 THEN
 *     new_cost := ((cur_qty*cur_cost) + (NEW.qty*NEW.unit_cost)) / new_qty;
 *   ELSE
 *     new_cost := cur_cost;   -- cost is preserved, never divided by <= 0
 *
 * @returns { newQty, newCost }
 */
export function weightedAvgCost(
  curQty: number,
  curCost: number,
  inQty: number,
  inUnitCost: number,
): { newQty: number; newCost: number } {
  const newQty = curQty + inQty;
  let newCost: number;
  if (newQty > 0) {
    newCost = (curQty * curCost + inQty * inUnitCost) / newQty;
  } else {
    // new_qty <= 0: division would be undefined/negative; keep prior cost.
    newCost = curCost;
  }
  return { newQty, newCost };
}

/**
 * Apply a positive stock adjustment (movement_type='adjustment', qty>0):
 * cost blends only when both qty>0 AND resulting qty>0, else cost preserved.
 * Mirrors the SQL adjustment branch.
 */
export function applyAdjustment(
  curQty: number,
  curCost: number,
  adjQty: number,
  adjUnitCost: number,
): { newQty: number; newCost: number } {
  const newQty = curQty + adjQty;
  let newCost: number;
  if (adjQty > 0 && newQty > 0) {
    newCost = (curQty * curCost + adjQty * adjUnitCost) / newQty;
  } else {
    // negative adjustment, or non-positive resulting qty: cost unchanged.
    newCost = curCost;
  }
  return { newQty, newCost };
}

/**
 * Is an item at/below its reorder point?
 * Mirrors dashboard.tsx: `i.qty <= Number(i.reorder_point)`.
 *
 * A null/undefined reorder_point means "not tracked" -> never low.
 */
export function isLowStock(
  qty: number,
  reorderPoint: number | null | undefined,
): boolean {
  if (reorderPoint == null) return false;
  return Number(qty) <= Number(reorderPoint);
}

/**
 * Sum on-hand qty for one item across all its locations.
 * Mirrors the dashboard `totals` Map aggregation.
 */
export function totalOnHand(
  levels: Array<{ qty_on_hand: number | string }>,
): number {
  return levels.reduce((sum, l) => sum + Number(l.qty_on_hand), 0);
}

/**
 * Build the low-stock alert list: items whose summed on-hand qty across
 * locations is at or below their reorder_point, sorted lowest-first, capped.
 * Mirrors the full dashboard.tsx low-stock query post-processing.
 */
export function lowStockAlerts<
  T extends { id: string; reorder_point: number | null | undefined },
>(
  trackedItems: T[],
  levels: Array<{ item_id: string; qty_on_hand: number | string }>,
  limit = 10,
): Array<T & { qty: number }> {
  const totals = new Map<string, number>();
  for (const l of levels) {
    totals.set(l.item_id, (totals.get(l.item_id) ?? 0) + Number(l.qty_on_hand));
  }
  return trackedItems
    .map((i) => ({ ...i, qty: totals.get(i.id) ?? 0 }))
    .filter((i) => i.reorder_point != null && i.qty <= Number(i.reorder_point))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, limit);
}
