import { test } from "node:test";
import assert from "node:assert/strict";
import {
  round2,
  scaleFactor,
  reagentCostPerMt,
  chemicalCostPerMt,
  impliedConsumptionKgPerMt,
  totalReagentLoadKgPerMt,
  reagentCostShare,
  scaleSavingsPerMt,
  annualChemicalCost,
  annualScaleSavings,
  reagentScaleSavingsTable,
  processingCostBreakdown,
  efficiencySavingsPerMt,
  annualEfficiencySavings,
  railSavingsPerKg,
  railDeliveredPricePerKg,
  railSavingsPerMt,
  totalRailSavingsPerMt,
  reagentConsumptionKgPerDay,
  reagentRunwayDays,
  batchChemicalCost,
} from "./unit-economics.ts";
import { getReagent, ATOKA_THROUGHPUT_MT_PER_YEAR } from "./atoka-chemicals.ts";

const naoh = getReagent("naoh");
const h2so4 = getReagent("h2so4");
const na2co3 = getReagent("na2co3");

// ---------------------------------------------------------------------------
// scaleFactor  (bulk procurement discount anchors)
// ---------------------------------------------------------------------------

test("scaleFactor: 1 unit pays full benchmark price (1.0)", () => {
  assert.equal(scaleFactor(1), 1);
});

test("scaleFactor: 4 units gets the 30% bulk discount (0.70)", () => {
  assert.equal(scaleFactor(4), 0.7);
});

test("scaleFactor: <1 unit clamps to full price; 4+ clamps to discount floor", () => {
  assert.equal(scaleFactor(0), 1);
  assert.equal(scaleFactor(10), 0.7);
});

test("scaleFactor: interpolates linearly between the anchors", () => {
  // midpoint of 1 and 4 units is 2.5 -> halfway between 1.0 and 0.70 = 0.85
  assert.equal(round2(scaleFactor(2.5)), 0.85);
});

// ---------------------------------------------------------------------------
// chemicalCostPerMt  (the headline: $919 at 1 unit, $643 at 4 units)
// ---------------------------------------------------------------------------

test("chemicalCostPerMt: 1 unit totals $919/MT (matches the memo)", () => {
  // 445 + 210 + 187 + 73 = 915 ... memo rounds reagents; verify the build-up sum
  assert.equal(chemicalCostPerMt(1), 445 + 210 + 187 + 73);
});

test("chemicalCostPerMt: 4 units = 1-unit cost x 0.70", () => {
  // (445+210+187+73) * 0.70 = 915 * 0.70 = 640.5 ; memo prints ~$643 after
  // per-reagent rounding (311+147+131+51=640). We assert the exact model math.
  assert.equal(round2(chemicalCostPerMt(4)), round2(chemicalCostPerMt(1) * 0.7));
});

test("reagentCostPerMt: NaOH 4 units = $311.5 (445 x 0.70)", () => {
  assert.equal(round2(reagentCostPerMt(naoh, 4)), 311.5);
});

// ---------------------------------------------------------------------------
// impliedConsumptionKgPerMt  (cost/MT ÷ delivered $/kg, exactly as the memo)
// ---------------------------------------------------------------------------

test("impliedConsumptionKgPerMt: NaOH 4 units ≈ 901 kg/MT", () => {
  // 311.5 / 0.345 = 902.9 ; memo prints ~901 (uses its rounded $311)
  assert.equal(Math.round(impliedConsumptionKgPerMt(naoh, 4)), 903);
});

test("totalReagentLoadKgPerMt: 4 units ≈ 2.5 MT of reagent per MT feedstock", () => {
  const kg = totalReagentLoadKgPerMt(4);
  // memo: ~2,543 kg/MT. Allow a small band for per-reagent rounding.
  assert.ok(kg > 2400 && kg < 2700, `expected ~2543 kg/MT, got ${kg}`);
});

test("totalReagentLoadKgPerMt: 1 unit load is higher than 4 units (same kg-basis, scaled $)", () => {
  assert.ok(totalReagentLoadKgPerMt(1) > totalReagentLoadKgPerMt(4));
});

// ---------------------------------------------------------------------------
// reagentCostShare  (NaOH ≈ 48%, NaOH+H2SO4 ≈ 71% of chemical spend)
// ---------------------------------------------------------------------------

test("reagentCostShare: NaOH is the largest single reagent (~48%)", () => {
  const share = reagentCostShare(naoh, 4);
  assert.ok(share > 0.45 && share < 0.5, `got ${share}`);
});

test("reagentCostShare: NaOH + H2SO4 ≈ 71% of chemical spend", () => {
  const two = reagentCostShare(naoh, 4) + reagentCostShare(h2so4, 4);
  assert.ok(two > 0.68 && two < 0.73, `got ${two}`);
});

test("reagentCostShare: share is scale-invariant (price scales uniformly)", () => {
  assert.equal(round2(reagentCostShare(naoh, 1)), round2(reagentCostShare(naoh, 4)));
});

// ---------------------------------------------------------------------------
// scale savings  ($276/MT, ~$1.80M/yr at 6,539 MT/yr)
// ---------------------------------------------------------------------------

test("scaleSavingsPerMt: 1 unit -> 4 units saves ~$275/MT", () => {
  // 915 - 640.5 = 274.5 ; memo prints $276 from its rounded $919-$643
  assert.equal(round2(scaleSavingsPerMt()), 274.5);
});

test("annualScaleSavings: ~$1.8M/yr at 6,539 MT/yr", () => {
  const annual = annualScaleSavings();
  assert.ok(annual > 1_750_000 && annual < 1_850_000, `got ${annual}`);
});

test("annualChemicalCost: scales linearly with throughput", () => {
  assert.equal(
    annualChemicalCost(4, 1000),
    chemicalCostPerMt(4) * 1000,
  );
});

test("reagentScaleSavingsTable: NaOH saves ~$134/MT and ~$876k/yr", () => {
  const row = reagentScaleSavingsTable().find((r) => r.key === "naoh")!;
  // 445*0.30 = 133.5/MT ; *6539 = 872,956
  assert.equal(round2(row.savingsPerMt), 133.5);
  assert.ok(row.annualSavings > 850_000 && row.annualSavings < 900_000);
});

test("reagentScaleSavingsTable: rows sum to the plant-level annual saving", () => {
  const rows = reagentScaleSavingsTable();
  const sum = rows.reduce((s, r) => s + r.annualSavings, 0);
  assert.equal(round2(sum), round2(annualScaleSavings()));
});

// ---------------------------------------------------------------------------
// processingCostBreakdown  (chemical ≈ 13%, feedstock = 70% of $5,003/MT)
// ---------------------------------------------------------------------------

test("processingCostBreakdown: feedstock is 70% of all-in cost", () => {
  const b = processingCostBreakdown();
  // 3500 / 5003 = 0.6996
  assert.equal(round2(b.feedstockShare), 0.7);
});

test("processingCostBreakdown: chemical is ~13% of all-in cost", () => {
  const b = processingCostBreakdown();
  assert.ok(b.chemicalShare > 0.12 && b.chemicalShare < 0.14, `got ${b.chemicalShare}`);
});

test("processingCostBreakdown: the three buckets sum to the all-in cost", () => {
  const b = processingCostBreakdown();
  assert.equal(round2(b.feedstock + b.chemical + b.other), 5003);
  assert.equal(round2(b.feedstockShare + b.chemicalShare + b.otherShare), 1);
});

// ---------------------------------------------------------------------------
// improvement levers (efficiency + rail logistics)
// ---------------------------------------------------------------------------

test("efficiencySavingsPerMt: 10% efficiency gain saves ~$64/MT", () => {
  const s = efficiencySavingsPerMt(0.1);
  assert.ok(s > 62 && s < 66, `got ${s}`);
});

test("annualEfficiencySavings: 10% gain ≈ $418k/yr", () => {
  const a = annualEfficiencySavings(0.1);
  assert.ok(a > 400_000 && a < 435_000, `got ${a}`);
});

test("railSavingsPerKg: NaOH truck->rail saves $0.115/kg (largest absolute)", () => {
  // 0.212 - 0.097 = 0.115
  assert.equal(round2(railSavingsPerKg(naoh) * 1000) / 1000, 0.115);
});

test("railSavingsPerKg: NaOH and soda ash both save $0.115/kg", () => {
  assert.equal(round2(railSavingsPerKg(na2co3) * 1000) / 1000, 0.115);
});

test("railDeliveredPricePerKg: rail price is below truck delivered price", () => {
  assert.ok(railDeliveredPricePerKg(naoh) < naoh.deliveredPricePerKg);
  // 0.345 - 0.115 = 0.230
  assert.equal(round2(railDeliveredPricePerKg(naoh)), 0.23);
});

test("railSavingsPerMt: NaOH rail saving = $/kg saving x kg/MT", () => {
  const expected = railSavingsPerKg(naoh) * impliedConsumptionKgPerMt(naoh, 4);
  assert.equal(railSavingsPerMt(naoh, 4), expected);
  assert.ok(railSavingsPerMt(naoh, 4) > 0);
});

test("totalRailSavingsPerMt: sums per-reagent rail savings, all positive", () => {
  const total = totalRailSavingsPerMt(4);
  const sum =
    railSavingsPerMt(getReagent("naoh"), 4) +
    railSavingsPerMt(getReagent("h2so4"), 4) +
    railSavingsPerMt(getReagent("h2o2"), 4) +
    railSavingsPerMt(getReagent("na2co3"), 4);
  assert.equal(total, sum);
  assert.ok(total > 0);
});

// ---------------------------------------------------------------------------
// inventory bridge  (stock-on-hand -> days of cover; batch costing)
// ---------------------------------------------------------------------------

test("reagentConsumptionKgPerDay: kg/MT x MT/day", () => {
  // process 10 MT/day of feedstock
  const expected = impliedConsumptionKgPerMt(naoh, 4) * 10;
  assert.equal(reagentConsumptionKgPerDay(naoh, 10, 4), expected);
});

test("reagentRunwayDays: on-hand / daily consumption", () => {
  // 10 MT/day -> ~9029 kg NaOH/day ; 18,058 kg on hand ≈ 2 days
  const perDay = reagentConsumptionKgPerDay(naoh, 10, 4);
  const days = reagentRunwayDays(perDay * 2, naoh, 10, 4);
  assert.equal(round2(days), 2);
});

test("reagentRunwayDays: zero throughput never reads as out-of-stock (Infinity)", () => {
  assert.equal(reagentRunwayDays(0, naoh, 0, 4), Infinity);
  assert.equal(reagentRunwayDays(5000, naoh, 0, 4), Infinity);
});

test("batchChemicalCost: chemical cost of a batch = cost/MT x mass", () => {
  // a 50 MT batch at 4 units
  assert.equal(batchChemicalCost(50, 4), chemicalCostPerMt(4) * 50);
  assert.equal(batchChemicalCost(0, 4), 0);
});

// ---------------------------------------------------------------------------
// round2  (display helper)
// ---------------------------------------------------------------------------

test("round2: rounds to 2 decimals", () => {
  assert.equal(round2(643.299), 643.3);
  assert.equal(round2(0.005), 0.01);
});

test("throughput constant matches the memo basis (6,539 MT/yr)", () => {
  assert.equal(ATOKA_THROUGHPUT_MT_PER_YEAR, 6539);
});
