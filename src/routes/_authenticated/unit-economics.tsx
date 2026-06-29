import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ATOKA_REAGENTS,
  ATOKA_THROUGHPUT_MT_PER_YEAR,
  type Reagent,
} from "@/lib/atoka-chemicals";
import { ATOKA_CREW_MODELS, getCrewModel, type CrewModel } from "@/lib/atoka-labor";
import {
  round2,
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
  railSavingsPerMt,
  totalRailSavingsPerMt,
  crewLaborMonthly,
  totalLaborMonthly,
  annualLaborCost,
  laborCostPerMt,
  raiseCostMonthly,
  conversionCostPerMt,
} from "@/lib/unit-economics";

export const Route = createFileRoute("/_authenticated/unit-economics")({
  head: () => ({ meta: [{ title: "Unit economics · Inventory" }] }),
  component: UnitEconomicsPage,
});

const usd = (n: number, dp = 0) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const usdK = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n / 1000).toLocaleString()}k`;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function UnitEconomicsPage() {
  // Operators can flex the model inputs the memos leave open.
  const [units, setUnits] = useState(4);
  const [throughput, setThroughput] = useState(ATOKA_THROUGHPUT_MT_PER_YEAR);
  const [crewKey, setCrewKey] = useState<CrewModel["key"]>("2-crew");
  const [raise, setRaise] = useState(false);
  const crew = getCrewModel(crewKey);
  const laborOpts = { raise };

  const m = useMemo(() => {
    const breakdown = processingCostBreakdown(units, undefined, undefined);
    return {
      chemPerMt: chemicalCostPerMt(units),
      loadKgPerMt: totalReagentLoadKgPerMt(units),
      annualChem: annualChemicalCost(units, throughput),
      scalePerMt: scaleSavingsPerMt(),
      annualScale: annualScaleSavings(throughput),
      eff10PerMt: efficiencySavingsPerMt(0.1, units),
      eff10Annual: annualEfficiencySavings(0.1, units, throughput),
      railPerMt: totalRailSavingsPerMt(units),
      railAnnual: totalRailSavingsPerMt(units) * throughput,
      breakdown,
      laborMonthly: totalLaborMonthly(crew, laborOpts),
      crewMonthly: crewLaborMonthly(crew, raise),
      annualLabor: annualLaborCost(crew, laborOpts),
      laborPerMt: laborCostPerMt(crew, throughput, laborOpts),
      raiseDelta: raiseCostMonthly(crew),
      conversionPerMt: conversionCostPerMt(units, crew, throughput, laborOpts),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, throughput, crewKey, raise]);

  const scaleRows = useMemo(
    () => reagentScaleSavingsTable(throughput),
    [throughput],
  );

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Unit economics</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Reagent cost to process one MT of black-mass feedstock — Atoka, OK.
        Source: Chemical Cost Breakdown / Financial Model v5.
      </p>

      {/* Inputs */}
      <div className="mt-6 flex flex-wrap gap-6">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Processing units
          </span>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            className="w-44 align-middle"
          />
          <span className="ml-3 font-semibold tabular-nums">{units} unit{units > 1 ? "s" : ""}</span>
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Throughput (MT/yr)
          </span>
          <input
            type="number"
            min={0}
            step={100}
            value={throughput}
            onChange={(e) => setThroughput(Math.max(0, Number(e.target.value)))}
            className="w-36 bg-card border border-border rounded-md px-3 py-1.5 tabular-nums"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Crew model
          </span>
          <select
            value={crewKey}
            onChange={(e) => setCrewKey(e.target.value as CrewModel["key"])}
            className="bg-card border border-border rounded-md px-3 py-1.5"
          >
            {ATOKA_CREW_MODELS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
                {c.current ? " · current" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm flex items-end gap-2 pb-1.5">
          <input
            type="checkbox"
            checked={raise}
            onChange={(e) => setRaise(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Post-raise pay (~$55k/yr floorhands)</span>
        </label>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Chemical cost / MT" value={usd(m.chemPerMt, 0)} sub={`${pct(m.breakdown.chemicalShare)} of all-in`} />
        <Kpi label="Reagent load / MT" value={`${Math.round(m.loadKgPerMt).toLocaleString()} kg`} sub="≈ 2.5 MT per MT feed" />
        <Kpi label="Annual chemical cost" value={usdK(m.annualChem)} sub={`at ${throughput.toLocaleString()} MT/yr`} />
        <Kpi label="Scale saving 1→4" value={usdK(m.annualScale)} sub={`${usd(m.scalePerMt, 0)}/MT`} />
      </div>

      {/* Reagent detail */}
      <h2 className="mt-8 font-semibold">Reagent-level cost</h2>
      <div className="mt-3 bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Chemical</th>
              <th className="text-right px-4 py-2.5">Delivered $/kg</th>
              <th className="text-right px-4 py-2.5">kg / MT</th>
              <th className="text-right px-4 py-2.5">$ / MT</th>
              <th className="text-right px-4 py-2.5">% of chem</th>
              <th className="text-right px-4 py-2.5">Rail save $/kg</th>
            </tr>
          </thead>
          <tbody>
            {ATOKA_REAGENTS.map((r: Reagent) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-4 py-2.5">
                  {r.name} <span className="text-xs text-muted-foreground">({r.formula})</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">${r.deliveredPricePerKg.toFixed(3)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(impliedConsumptionKgPerMt(r, units)).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{usd(round2(reagentCostPerMt(r, units)), 0)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{pct(reagentCostShare(r, units))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">${railSavingsPerKg(r).toFixed(3)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right">—</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(m.loadKgPerMt).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{usd(round2(m.chemPerMt), 0)}</td>
              <td className="px-4 py-2.5 text-right">100%</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{usd(round2(m.railPerMt), 0)}/MT</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Labor / shift cost -> cost per MT */}
      <h2 className="mt-8 font-semibold">Labor &amp; conversion cost</h2>
      <p className="text-xs text-muted-foreground mt-1">
        From the Shift Cost Breakdown: {crew.label}, {crew.crews} crew
        {crew.crews > 1 ? "s" : ""} of 1 operator + 2 floorhands, plus
        maintenance. Conversion cost = chemical + labor (excludes market-driven
        feedstock).
      </p>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Labor cost / MT" value={usd(round2(m.laborPerMt), 0)} sub={`${pct(m.laborPerMt / (m.breakdown.feedstock + m.breakdown.chemical + m.breakdown.other))} of all-in`} />
        <Kpi label="Total labor / mo" value={usd(m.laborMonthly, 0)} sub={`${usdK(m.annualLabor)}/yr`} />
        <Kpi label="Conversion cost / MT" value={usd(round2(m.conversionPerMt), 0)} sub="chemical + labor" />
        <Kpi label="Cost of pay raise" value={`${usd(m.raiseDelta, 0)}/mo`} sub={raise ? "applied" : `+${usdK(m.raiseDelta * 12)}/yr if applied`} />
      </div>

      {/* Scale economics + levers */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold">Scale economics: 1 unit vs 4 units</h2>
          <p className="text-xs text-muted-foreground mt-1">
            30% bulk-procurement discount on reagent pricing at full build-out.
          </p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {scaleRows.map((row) => (
              <li key={row.key} className="py-2 flex items-center justify-between">
                <span className="uppercase">{row.key}</span>
                <span className="text-right tabular-nums">
                  {usd(round2(row.oneUnitPerMt), 0)} → {usd(round2(row.fourUnitsPerMt), 0)}
                  <span className="ml-2 text-green-600 dark:text-green-400">{usdK(row.annualSavings)}/yr</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold">Improvement levers</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <Lever
              title="10% reagent efficiency"
              perMt={`${usd(round2(m.eff10PerMt), 0)}/MT`}
              annual={`${usdK(m.eff10Annual)}/yr`}
              note="Worth pursuing, not transformational."
            />
            <Lever
              title="Truck → rail logistics"
              perMt={`${usd(round2(m.railPerMt), 0)}/MT`}
              annual={`${usdK(m.railAnnual)}/yr`}
              note={`Largest on NaOH (${usd(round2(railSavingsPerMt(ATOKA_REAGENTS[0], units)), 0)}/MT).`}
            />
            <Lever
              title="Feedstock (market-driven)"
              perMt={`${usd(m.breakdown.feedstock, 0)}/MT`}
              annual={`${pct(m.breakdown.feedstockShare)} of all-in`}
              note="Dominant cost — not a reagent lever."
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Lever({ title, perMt, annual, note }: { title: string; perMt: string; annual: string; note: string }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </div>
      <div className="text-right tabular-nums whitespace-nowrap">
        <div className="font-semibold">{perMt}</div>
        <div className="text-xs text-green-600 dark:text-green-400">{annual}</div>
      </div>
    </li>
  );
}
