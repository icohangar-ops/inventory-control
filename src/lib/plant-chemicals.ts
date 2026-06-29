/**
 * Manufacturing plant chemical / reagent reference data.
 *
 * Source of truth: "Chemical Cost Breakdown" (GreenCAM America,
 * prepared June 2026), itself derived from the Green Li-ion Financial Model v5
 * (June 2026) "Chemical Cost Build Up" sheet.
 *
 * The manufacturing plant consumes process reagents to refine black-mass feedstock into
 * battery-grade product. Each metric ton (MT) of feedstock processed consumes a
 * fixed bundle of reagents. This module captures the per-reagent pricing and the
 * plant-level cost structure so the unit-economics helpers (see
 * `unit-economics.ts`) can compute cost/MT, scale savings, and inventory runway
 * against the SAME numbers the financial model uses.
 *
 * All prices are USD. Reagent prices are per kilogram (kg). Plant costs are per
 * metric ton (MT) of feedstock processed.
 *
 * Cross-references:
 *   - src/lib/unit-economics.ts          (calculations built on this data)
 *   - src/lib/inventory-math.ts          (generic stock valuation / reorder math)
 */

/** A process reagent consumed per MT of black-mass feedstock. */
export interface Reagent {
  /** Stable key (also usable as an inventory SKU mapping). */
  key: "naoh" | "h2so4" | "h2o2" | "na2co3";
  /** Display name. */
  name: string;
  /** Chemical formula (plain text). */
  formula: string;
  /** Benchmark FOB price at supplier, USD/kg. */
  fobPricePerKg: number;
  /** Truck logistics, supplier -> the plant, USD/kg. */
  truckLogisticsPerKg: number;
  /** All-in delivered price used in the financial model, USD/kg (truck basis). */
  deliveredPricePerKg: number;
  /** Rail logistics alternative, USD/kg (replaces truckLogisticsPerKg if used). */
  railLogisticsPerKg: number;
  /**
   * Single-unit (FY2026) reagent cost per MT of feedstock, USD/MT.
   * This is the model's baseline BEFORE the 4-unit bulk-procurement discount.
   * The 4-unit figure is derived: baseCostPerMtUsd * BULK_SCALE_FACTOR_4_UNITS.
   */
  baseCostPerMtUsd: number;
}

/**
 * Per the breakdown, the kg/MT consumption rate is comparable across scale; the
 * 1-unit -> 4-unit saving (~30%) comes from bulk-procurement pricing, not from
 * consuming less reagent. So we model scale as a price multiplier on $/MT.
 *
 * 919 * 0.70 = 643.3  (matches the model's $643/MT at 4 units)
 */
export const BULK_SCALE_FACTOR_4_UNITS = 0.7;

/** Reference build-out the financial model is sized for. */
export const REFERENCE_UNITS_AT_STEADY_STATE = 4;

/** Steady-state feedstock throughput, MT/year (used for annualized figures). */
export const PLANT_THROUGHPUT_MT_PER_YEAR = 6539;

/** Feedstock (black mass) purchase cost — the dominant, market-driven cost. */
export const PLANT_FEEDSTOCK_COST_PER_MT = 3500;

/** All-in processing cost per MT at 4 units (chemical is 13% of this). */
export const PLANT_ALL_IN_PROCESSING_COST_PER_MT = 5003;

/**
 * The four process reagents, ordered by share of chemical spend (largest first).
 * baseCostPerMtUsd values are the "1 Unit (FY2026)" column from the breakdown.
 */
export const PLANT_REAGENTS: readonly Reagent[] = [
  {
    key: "naoh",
    name: "Caustic soda",
    formula: "NaOH",
    fobPricePerKg: 0.248,
    truckLogisticsPerKg: 0.212,
    deliveredPricePerKg: 0.345,
    railLogisticsPerKg: 0.097,
    baseCostPerMtUsd: 445,
  },
  {
    key: "h2so4",
    name: "Sulfuric acid",
    formula: "H2SO4",
    fobPricePerKg: 0.118,
    truckLogisticsPerKg: 0.066,
    deliveredPricePerKg: 0.155,
    railLogisticsPerKg: 0.037,
    baseCostPerMtUsd: 210,
  },
  {
    key: "h2o2",
    name: "Hydrogen peroxide",
    formula: "H2O2",
    fobPricePerKg: 0.196,
    truckLogisticsPerKg: 0.154,
    deliveredPricePerKg: 0.26,
    railLogisticsPerKg: 0.064,
    baseCostPerMtUsd: 187,
  },
  {
    key: "na2co3",
    name: "Soda ash",
    formula: "Na2CO3",
    fobPricePerKg: 0.169,
    truckLogisticsPerKg: 0.215,
    deliveredPricePerKg: 0.269,
    railLogisticsPerKg: 0.1,
    baseCostPerMtUsd: 73,
  },
] as const;

/** Look up a reagent by key (throws if unknown — keeps callers honest). */
export function getReagent(key: Reagent["key"]): Reagent {
  const r = PLANT_REAGENTS.find((x) => x.key === key);
  if (!r) throw new Error(`Unknown reagent: ${key}`);
  return r;
}
