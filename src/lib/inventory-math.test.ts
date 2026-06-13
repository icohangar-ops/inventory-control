import { test } from "node:test";
import assert from "node:assert/strict";
import {
  round4,
  lineValue,
  totalStockValue,
  weightedAvgCost,
  applyAdjustment,
  isLowStock,
  totalOnHand,
  lowStockAlerts,
} from "./inventory-math.ts";

// ---------------------------------------------------------------------------
// lineValue / totalStockValue  (qty * avg_cost)
// ---------------------------------------------------------------------------

test("lineValue: qty * avg_cost, hand-computed", () => {
  // 12.5 units @ $3.20 = $40.00
  assert.equal(lineValue(12.5, 3.2), 40);
});

test("lineValue: zero qty -> zero value", () => {
  assert.equal(lineValue(0, 9.99), 0);
});

test("lineValue: negative qty (oversold position) yields negative value", () => {
  // -4 @ $2.50 = -$10.00 ; must NOT be clamped to 0
  assert.equal(lineValue(-4, 2.5), -10);
});

test("totalStockValue: sums lines and coerces string columns (supabase NUMERIC)", () => {
  // 10*1.5=15 ; 2.5*4=10 ; 0*100=0  => 25
  const v = totalStockValue([
    { qty_on_hand: "10", avg_cost: "1.5" },
    { qty_on_hand: 2.5, avg_cost: 4 },
    { qty_on_hand: "0", avg_cost: "100" },
  ]);
  assert.equal(v, 25);
});

test("totalStockValue: empty list is 0 (not NaN)", () => {
  assert.equal(totalStockValue([]), 0);
});

// ---------------------------------------------------------------------------
// weightedAvgCost  (the receipt / transfer-in money formula)
// ---------------------------------------------------------------------------

test("weightedAvgCost: classic blend, hand-computed", () => {
  // start 100 @ $2.00, receive 100 @ $4.00
  // newQty = 200 ; newCost = (100*2 + 100*4)/200 = 600/200 = 3.00
  const r = weightedAvgCost(100, 2, 100, 4);
  assert.equal(r.newQty, 200);
  assert.equal(r.newCost, 3);
});

test("weightedAvgCost: receiving into empty stock takes the incoming cost", () => {
  // start 0 @ $0, receive 50 @ $7.50 => 50 @ 7.50
  const r = weightedAvgCost(0, 0, 50, 7.5);
  assert.equal(r.newQty, 50);
  assert.equal(r.newCost, 7.5);
});

test("weightedAvgCost: uneven blend, hand-computed to exact value", () => {
  // start 3 @ $10, receive 1 @ $2 => (30+2)/4 = 32/4 = 8.00
  const r = weightedAvgCost(3, 10, 1, 2);
  assert.equal(r.newQty, 4);
  assert.equal(r.newCost, 8);
});

test("weightedAvgCost: ZERO-DIVISION guard — newQty<=0 preserves prior cost", () => {
  // start 10 @ $5, a -10 inbound would make newQty 0 -> must NOT divide by zero.
  // SQL trigger keeps cur_cost when new_qty <= 0.
  const r = weightedAvgCost(10, 5, -10, 0);
  assert.equal(r.newQty, 0);
  assert.equal(r.newCost, 5); // preserved, not NaN / not 0
  assert.ok(!Number.isNaN(r.newCost));
});

test("weightedAvgCost: net-negative qty preserves prior cost (no negative cost)", () => {
  // start 2 @ $5, inbound -5 => newQty=-3<=0 -> cost stays 5
  const r = weightedAvgCost(2, 5, -5, 99);
  assert.equal(r.newQty, -3);
  assert.equal(r.newCost, 5);
});

test("weightedAvgCost: cost is weighted by qty, not a naive average", () => {
  // 1 @ $1 + 99 @ $101 => (1 + 9999)/100 = 10000/100 = 100, NOT (1+101)/2=51
  const r = weightedAvgCost(1, 1, 99, 101);
  assert.equal(r.newCost, 100);
  assert.notEqual(r.newCost, 51);
});

// ---------------------------------------------------------------------------
// applyAdjustment  (positive blends cost; negative preserves cost)
// ---------------------------------------------------------------------------

test("applyAdjustment: positive adj blends cost like a receipt", () => {
  // 10 @ $2 + adj 10 @ $4 => (20+40)/20 = 3.00
  const r = applyAdjustment(10, 2, 10, 4);
  assert.equal(r.newQty, 20);
  assert.equal(r.newCost, 3);
});

test("applyAdjustment: NEGATIVE adj reduces qty but PRESERVES cost", () => {
  // 10 @ $2, adjust -3 => qty 7, cost stays $2 (write-off keeps unit cost)
  const r = applyAdjustment(10, 2, -3, 999);
  assert.equal(r.newQty, 7);
  assert.equal(r.newCost, 2); // incoming unit cost must be ignored for shrink
});

test("applyAdjustment: positive adj that nets to zero preserves cost (no div-by-0)", () => {
  // contrived: cur -5 @ $4, adj +5 => newQty 0, adjQty>0 but newQty not >0 -> preserve
  const r = applyAdjustment(-5, 4, 5, 7);
  assert.equal(r.newQty, 0);
  assert.equal(r.newCost, 4);
});

// ---------------------------------------------------------------------------
// isLowStock  (the reorder TRIGGER — boundary is <=, inclusive)
// ---------------------------------------------------------------------------

test("isLowStock: qty strictly below reorder point is low", () => {
  assert.equal(isLowStock(4, 5), true);
});

test("isLowStock: qty EXACTLY AT reorder point is low (inclusive boundary)", () => {
  // dashboard uses `<=`, so equality must trigger. Off-by-one (`<`) regression caught here.
  assert.equal(isLowStock(5, 5), true);
});

test("isLowStock: qty above reorder point is NOT low", () => {
  assert.equal(isLowStock(6, 5), false);
});

test("isLowStock: zero qty with positive reorder point is low", () => {
  assert.equal(isLowStock(0, 1), true);
});

test("isLowStock: negative (oversold) qty is low", () => {
  assert.equal(isLowStock(-2, 0), true);
});

test("isLowStock: null/undefined reorder point means untracked -> never low", () => {
  assert.equal(isLowStock(0, null), false);
  assert.equal(isLowStock(0, undefined), false);
});

test("isLowStock: reorder point of 0 still tracked; qty 0 is at boundary -> low", () => {
  // distinguishes 'reorder_point = 0' (tracked) from null (untracked)
  assert.equal(isLowStock(0, 0), true);
  assert.equal(isLowStock(1, 0), false);
});

// ---------------------------------------------------------------------------
// totalOnHand  (sum across locations before the reorder comparison)
// ---------------------------------------------------------------------------

test("totalOnHand: sums multiple locations including negatives", () => {
  // 10 + (-3) + 0.5 = 7.5
  const t = totalOnHand([
    { qty_on_hand: 10 },
    { qty_on_hand: "-3" },
    { qty_on_hand: 0.5 },
  ]);
  assert.equal(t, 7.5);
});

test("totalOnHand: no locations -> 0", () => {
  assert.equal(totalOnHand([]), 0);
});

// ---------------------------------------------------------------------------
// lowStockAlerts  (full dashboard pipeline: aggregate -> filter -> sort -> cap)
// ---------------------------------------------------------------------------

test("lowStockAlerts: aggregates across locations then applies <= reorder point", () => {
  const items = [
    { id: "a", sku: "A", reorder_point: 10 }, // total 6 -> low
    { id: "b", sku: "B", reorder_point: 5 }, // total 5 -> low (boundary)
    { id: "c", sku: "C", reorder_point: 5 }, // total 8 -> not low
  ];
  const levels = [
    { item_id: "a", qty_on_hand: 4 },
    { item_id: "a", qty_on_hand: 2 }, // a total = 6
    { item_id: "b", qty_on_hand: 5 }, // b total = 5
    { item_id: "c", qty_on_hand: 3 },
    { item_id: "c", qty_on_hand: 5 }, // c total = 8
  ];
  const out = lowStockAlerts(items, levels);
  assert.deepEqual(
    out.map((o) => ({ id: o.id, qty: o.qty })),
    [
      { id: "b", qty: 5 },
      { id: "a", qty: 6 },
    ],
  );
});

test("lowStockAlerts: item with NO stock rows counts as qty 0 and is low", () => {
  const items = [{ id: "z", reorder_point: 1 }];
  const out = lowStockAlerts(items, []);
  assert.equal(out.length, 1);
  assert.equal(out[0].qty, 0);
});

test("lowStockAlerts: sorted lowest-qty first", () => {
  const items = [
    { id: "hi", reorder_point: 100 },
    { id: "lo", reorder_point: 100 },
  ];
  const levels = [
    { item_id: "hi", qty_on_hand: 90 },
    { item_id: "lo", qty_on_hand: 1 },
  ];
  const out = lowStockAlerts(items, levels);
  assert.deepEqual(out.map((o) => o.id), ["lo", "hi"]);
});

test("lowStockAlerts: respects the cap (limit)", () => {
  const items = Array.from({ length: 15 }, (_, i) => ({
    id: String(i),
    reorder_point: 100,
  }));
  const levels = items.map((it, i) => ({ item_id: it.id, qty_on_hand: i }));
  const out = lowStockAlerts(items, levels, 10);
  assert.equal(out.length, 10);
  // lowest qty (0) first
  assert.equal(out[0].id, "0");
});

test("lowStockAlerts: untracked items (null reorder point) excluded even if qty 0", () => {
  const items = [
    { id: "tracked", reorder_point: 5 },
    { id: "untracked", reorder_point: null },
  ];
  const levels: Array<{ item_id: string; qty_on_hand: number }> = [];
  const out = lowStockAlerts(items, levels);
  assert.deepEqual(out.map((o) => o.id), ["tracked"]);
});

// ---------------------------------------------------------------------------
// round4  (NUMERIC(14,4) scale)
// ---------------------------------------------------------------------------

test("round4: rounds to 4 decimal places", () => {
  assert.equal(round4(3.123449), 3.1234);
  assert.equal(round4(3.12345), 3.1235);
});

test("round4: stabilizes a blended cost that has float dust", () => {
  // (1*0.1 + 2*0.2)/3 = 0.5/3 = 0.16666... -> 0.1667
  const { newCost } = weightedAvgCost(1, 0.1, 2, 0.2);
  assert.equal(round4(newCost), 0.1667);
});
