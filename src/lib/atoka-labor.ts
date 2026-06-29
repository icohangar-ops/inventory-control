/**
 * Atoka plant labor / shift-cost reference data.
 *
 * Source of truth: "Shift Cost Breakdown — Atoka Plant" (GreenCAM America,
 * GLMC-1 Operations, corrected June 2026).
 *
 * The plant runs crews of 1 operator + 2 floorhands per shift. Two operating
 * models are documented:
 *   - 2-crew  (5-day coverage)  — CURRENT
 *   - 4-crew  (7-day coverage)  — full continuous operation
 * A "post-raise" scenario lifts floorhand pay to a ~$55k/yr target.
 *
 * This feeds the labor side of unit economics: annualized labor / throughput
 * gives a labor cost per MT of feedstock, which sits inside the "other" bucket
 * of the all-in $5,003/MT processing cost (alongside chemicals and feedstock).
 *
 * All figures are USD/month unless noted.
 *
 * @see ./unit-economics.ts   (laborCostPerMt, conversionCostPerMt, ...)
 * @see ./atoka-chemicals.ts  (chemical side of the same cost stack)
 */

/** Floorhands staffed per shift-crew. */
export const FLOORHANDS_PER_CREW = 2;
/** Operators staffed per shift-crew. */
export const OPERATORS_PER_CREW = 1;
/** Operator pay, USD/month (≈ $75k/yr; unchanged by the raise). */
export const OPERATOR_MONTHLY = 6250;
/** Post-raise floorhand pay target, USD/month (≈ $55k/yr). */
export const RAISE_FLOORHAND_MONTHLY = 4583;
/** Maintenance crew, USD/month (general maintenance; supervisor TBC). */
export const MAINTENANCE_MONTHLY = 3600;

/** A documented crew operating model. */
export interface CrewModel {
  key: "2-crew" | "4-crew";
  label: string;
  /** Days/week of production coverage this model provides. */
  coverageDays: number;
  /** Number of shift-crews staffed. */
  crews: number;
  /** Current floorhand pay in this model, USD/month (per floorhand). */
  floorhandMonthly: number;
  /** Whether this is the plant's current operating model. */
  current: boolean;
}

/**
 * The two crew models. Floorhand monthly pay differs by model because fewer
 * crews on the same coverage means more hours (and pay) per floorhand:
 *   2-crew floorhand $3,600/mo  vs  4-crew floorhand $2,520/mo.
 */
export const ATOKA_CREW_MODELS: readonly CrewModel[] = [
  {
    key: "2-crew",
    label: "2-crew (5-day coverage)",
    coverageDays: 5,
    crews: 2,
    floorhandMonthly: 3600,
    current: true,
  },
  {
    key: "4-crew",
    label: "4-crew (7-day coverage)",
    coverageDays: 7,
    crews: 4,
    floorhandMonthly: 2520,
    current: false,
  },
] as const;

/** Look up a crew model by key (throws if unknown). */
export function getCrewModel(key: CrewModel["key"]): CrewModel {
  const m = ATOKA_CREW_MODELS.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown crew model: ${key}`);
  return m;
}
