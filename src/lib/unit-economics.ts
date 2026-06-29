/**
 * Unit-economics calculations for the manufacturing plant.
 *
 * These are pure functions over the reference data in `plant-chemicals.ts`.
 * They answer the questions the financial model and the "Chemical Cost
 * Breakdown" memo answer, but as testable code the inventory app
 * can reuse:
 *
 *   - What does it cost in reagents to process one MT of feedstock?      (chemicalCostPerMt)
 *   - How does that change at 1 unit vs 4 units?                         (scaleFactor, scaleSavingsPerMt)
 *   - How much reagent does a MT consume, and how long does stock last?  (impliedConsumptionKgPerMt, reagentRunwayDays)
 *   - Where does the money go (feedstock vs chemical vs other)?          (processingCostBreakdown)
 *   - What is a reagent worth chasing (rail logistics, efficiency)?      (railSavingsPerMt, efficiencySavingsPerMt)
 *
 * Every headline number reconciles to the memo:
 *   chemicalCostPerMt(1) = $919,  chemicalCostPerMt(4) = $643,
 *   annualScaleSavings() = $1.80M at 6,539 MT/yr.
 *
 * Money semantics match the rest of the app: plain JS numbers, round at the
 * boundary with `round4`/`round2` when displaying.
 *
 * @see ./plant-chemicals.ts
 * @see ./inventory-math.ts
 */

import {
  PLANT_REAGENTS,
  PLANT_ALL_IN_PROCESSING_COST_PER_MT,
  PLANT_FEEDSTOCK_COST_PER_MT,
  PLANT_THROUGHPUT_MT_PER_YEAR,
  BULK_SCALE_FACTOR_4_UNITS,
  type Reagent,
} from "./plant-chemicals.ts";
import {
  FLOORHANDS_PER_CREW,
  OPERATORS_PER_CREW,
  OPERATOR_MONTHLY,
  RAISE_FLOORHAND_MONTHLY,
  MAINTENANCE_MONTHLY,
  type CrewModel,
} from "./plant-labor.ts";

/** Round to 2 decimals (USD display scale). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e2) / 1e2;
}

/**
 * Bulk-procurement price multiplier on reagent $/MT for a given number of
 * processing units. Anchored on the two points the memo gives us:
 *   1 unit  -> 1.00 (full benchmark price)
 *   4 units -> 0.70 (30% bulk discount)
 * Between/beyond those, we interpolate linearly on units and clamp to [0.70, 1].
 * Fewer than 1 unit is treated as 1 unit; 4+ units gets the full discount.
 */
export function scaleFactor(units: number): number {
  if (units <= 1) return 1;
  if (units >= 4) return BULK_SCALE_FACTOR_4_UNITS;
  // linear between (1, 1.0) and (4, 0.70)
  const slope = (BULK_SCALE_FACTOR_4_UNITS - 1) / (4 - 1);
  return 1 + slope * (units - 1);
}

/** Reagent cost to process one MT of feedstock at `units` units, USD/MT. */
export function reagentCostPerMt(reagent: Reagent, units: number): number {
  return reagent.baseCostPerMtUsd * scaleFactor(units);
}

/** Total chemical cost to process one MT of feedstock at `units`, USD/MT. */
export function chemicalCostPerMt(units: number): number {
  return PLANT_REAGENTS.reduce((sum, r) => sum + reagentCostPerMt(r, units), 0);
}

/**
 * Implied reagent consumption, kg per MT of feedstock.
 * Back-calculated exactly as the memo does: cost/MT ÷ delivered $/kg.
 */
export function impliedConsumptionKgPerMt(
  reagent: Reagent,
  units: number,
): number {
  return reagentCostPerMt(reagent, units) / reagent.deliveredPricePerKg;
}

/** Total reagent load across all reagents, kg per MT of feedstock. */
export function totalReagentLoadKgPerMt(units: number): number {
  return PLANT_REAGENTS.reduce(
    (sum, r) => sum + impliedConsumptionKgPerMt(r, units),
    0,
  );
}

/** Each reagent's share of total chemical cost at `units` (0..1). */
export function reagentCostShare(reagent: Reagent, units: number): number {
  const total = chemicalCostPerMt(units);
  if (total === 0) return 0;
  return reagentCostPerMt(reagent, units) / total;
}

// ---------------------------------------------------------------------------
// Scale economics (1 unit vs 4 units)
// ---------------------------------------------------------------------------

/** Per-MT chemical saving from scaling 1 unit -> 4 units, USD/MT. */
export function scaleSavingsPerMt(): number {
  return chemicalCostPerMt(1) - chemicalCostPerMt(4);
}

/** Annualized chemical cost at `units`, USD/yr at steady-state throughput. */
export function annualChemicalCost(
  units: number,
  throughputMtPerYear: number = PLANT_THROUGHPUT_MT_PER_YEAR,
): number {
  return chemicalCostPerMt(units) * throughputMtPerYear;
}

/** Annualized saving from scaling 1 -> 4 units, USD/yr. */
export function annualScaleSavings(
  throughputMtPerYear: number = PLANT_THROUGHPUT_MT_PER_YEAR,
): number {
  return scaleSavingsPerMt() * throughputMtPerYear;
}

/** Per-reagent scale-savings table (1 unit vs 4 units), with annualized value. */
export function reagentScaleSavingsTable(
  throughputMtPerYear: number = PLANT_THROUGHPUT_MT_PER_YEAR,
): Array<{
  key: Reagent["key"];
  oneUnitPerMt: number;
  fourUnitsPerMt: number;
  savingsPerMt: number;
  annualSavings: number;
}> {
  return PLANT_REAGENTS.map((r) => {
    const one = reagentCostPerMt(r, 1);
    const four = reagentCostPerMt(r, 4);
    const savingsPerMt = one - four;
    return {
      key: r.key,
      oneUnitPerMt: one,
      fourUnitsPerMt: four,
      savingsPerMt,
      annualSavings: savingsPerMt * throughputMtPerYear,
    };
  });
}

// ---------------------------------------------------------------------------
// Processing-cost context (chemical as a share of the all-in cost)
// ---------------------------------------------------------------------------

/**
 * All-in per-MT processing cost split into feedstock / chemical / other.
 * Defaults to 4-unit steady state (chemical ≈ 13%, feedstock ≈ 70%).
 */
export function processingCostBreakdown(
  units = 4,
  allInPerMt: number = PLANT_ALL_IN_PROCESSING_COST_PER_MT,
  feedstockPerMt: number = PLANT_FEEDSTOCK_COST_PER_MT,
): {
  feedstock: number;
  chemical: number;
  other: number;
  feedstockShare: number;
  chemicalShare: number;
  otherShare: number;
} {
  const chemical = chemicalCostPerMt(units);
  const other = allInPerMt - feedstockPerMt - chemical;
  return {
    feedstock: feedstockPerMt,
    chemical,
    other,
    feedstockShare: feedstockPerMt / allInPerMt,
    chemicalShare: chemical / allInPerMt,
    otherShare: other / allInPerMt,
  };
}

// ---------------------------------------------------------------------------
// Improvement levers (efficiency, rail logistics)
// ---------------------------------------------------------------------------

/**
 * Saving from improving reagent efficiency by `pct` (e.g. 0.10 = 10%), USD/MT.
 * Memo: a 10% efficiency gain at 4 units saves ~$64/MT.
 */
export function efficiencySavingsPerMt(pct: number, units = 4): number {
  return chemicalCostPerMt(units) * pct;
}

/** Annualized efficiency saving, USD/yr. */
export function annualEfficiencySavings(
  pct: number,
  units = 4,
  throughputMtPerYear: number = PLANT_THROUGHPUT_MT_PER_YEAR,
): number {
  return efficiencySavingsPerMt(pct, units) * throughputMtPerYear;
}

/** Logistics saving per kg from switching a reagent truck -> rail, USD/kg. */
export function railSavingsPerKg(reagent: Reagent): number {
  return reagent.truckLogisticsPerKg - reagent.railLogisticsPerKg;
}

/** Delivered price if a reagent shipped by rail instead of truck, USD/kg. */
export function railDeliveredPricePerKg(reagent: Reagent): number {
  return reagent.deliveredPricePerKg - railSavingsPerKg(reagent);
}

/**
 * Per-MT saving if a reagent switched to rail logistics, USD/MT.
 * = rail $/kg saving × that reagent's implied kg/MT consumption.
 */
export function railSavingsPerMt(reagent: Reagent, units = 4): number {
  return railSavingsPerKg(reagent) * impliedConsumptionKgPerMt(reagent, units);
}

/** Total per-MT saving if ALL reagents switched to rail, USD/MT. */
export function totalRailSavingsPerMt(units = 4): number {
  return PLANT_REAGENTS.reduce((sum, r) => sum + railSavingsPerMt(r, units), 0);
}

// ---------------------------------------------------------------------------
// Inventory bridge — connect reagent stock-on-hand to throughput economics
// ---------------------------------------------------------------------------

/** Reagent consumption rate per processing day, kg/day, at a given MT/day. */
export function reagentConsumptionKgPerDay(
  reagent: Reagent,
  mtPerDay: number,
  units = 4,
): number {
  return impliedConsumptionKgPerMt(reagent, units) * mtPerDay;
}

/**
 * How many processing days of cover the current on-hand reagent stock buys.
 * Returns Infinity when nothing is being consumed (mtPerDay <= 0), so a stalled
 * line never reads as "out of stock".
 */
export function reagentRunwayDays(
  onHandKg: number,
  reagent: Reagent,
  mtPerDay: number,
  units = 4,
): number {
  const perDay = reagentConsumptionKgPerDay(reagent, mtPerDay, units);
  if (perDay <= 0) return Infinity;
  return onHandKg / perDay;
}

/** Total reagent (chemical) cost to process a batch of `massMt`, USD. */
export function batchChemicalCost(massMt: number, units = 4): number {
  return chemicalCostPerMt(units) * massMt;
}

// ---------------------------------------------------------------------------
// Labor economics (from the Shift Cost Breakdown)
// ---------------------------------------------------------------------------

/** Options shared by the labor helpers. */
export interface LaborOpts {
  /** Use the post-raise floorhand pay (~$55k/yr) instead of current pay. */
  raise?: boolean;
  /** Include the maintenance crew in the total (default true). */
  includeMaintenance?: boolean;
}

/** Per-floorhand monthly pay for a model under current or post-raise pay. */
export function floorhandMonthly(model: CrewModel, raise = false): number {
  return raise ? RAISE_FLOORHAND_MONTHLY : model.floorhandMonthly;
}

/** Cost of ONE shift-crew (1 operator + 2 floorhands), USD/month. */
export function perCrewMonthly(model: CrewModel, raise = false): number {
  return (
    FLOORHANDS_PER_CREW * floorhandMonthly(model, raise) +
    OPERATORS_PER_CREW * OPERATOR_MONTHLY
  );
}

/** All shift-crews for a model (excludes maintenance), USD/month. */
export function crewLaborMonthly(model: CrewModel, raise = false): number {
  return model.crews * perCrewMonthly(model, raise);
}

/** Total monthly labor: shift crews + (optional) maintenance, USD/month. */
export function totalLaborMonthly(
  model: CrewModel,
  { raise = false, includeMaintenance = true }: LaborOpts = {},
): number {
  return (
    crewLaborMonthly(model, raise) +
    (includeMaintenance ? MAINTENANCE_MONTHLY : 0)
  );
}

/** Annualized total labor cost, USD/yr. */
export function annualLaborCost(model: CrewModel, opts: LaborOpts = {}): number {
  return totalLaborMonthly(model, opts) * 12;
}

/**
 * Labor cost per MT of feedstock = annual labor ÷ annual throughput.
 * This is the slice of the all-in processing cost attributable to people.
 */
export function laborCostPerMt(
  model: CrewModel,
  throughputMtPerYear: number = PLANT_THROUGHPUT_MT_PER_YEAR,
  opts: LaborOpts = {},
): number {
  if (throughputMtPerYear <= 0) return Infinity;
  return annualLaborCost(model, opts) / throughputMtPerYear;
}

/** Monthly cost delta of moving to post-raise pay for a model, USD/month. */
export function raiseCostMonthly(model: CrewModel): number {
  return crewLaborMonthly(model, true) - crewLaborMonthly(model, false);
}

/**
 * Conversion cost per MT = chemical + labor (the controllable, in-plant cost
 * to convert one MT of feedstock — excludes the market-driven feedstock buy).
 */
export function conversionCostPerMt(
  units: number,
  model: CrewModel,
  throughputMtPerYear: number = PLANT_THROUGHPUT_MT_PER_YEAR,
  opts: LaborOpts = {},
): number {
  return chemicalCostPerMt(units) + laborCostPerMt(model, throughputMtPerYear, opts);
}
