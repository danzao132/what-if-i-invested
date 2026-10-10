"use client";

import { useMemo } from "react";
import { PERIOD_LABELS, periodReturns, type PeriodKey } from "@/lib/engine/calc";
import type { PreparedSeries } from "@/lib/engine/series";
import { fmtDay, pct } from "@/lib/format";

const PERIODS: PeriodKey[] = ["1M", "6M", "YTD", "1Y", "5Y", "10Y", "MAX"];

export function HistoricalPerformance({ series }: { series: PreparedSeries }) {
  const rows = useMemo(() => periodReturns(series, PERIODS), [series]);
  const hasTR = !!series.tr;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="perf-title">
      <h2 id="perf-title" className="font-display text-xl font-semibold">Historical performance</h2>
      <p className="mt-1 text-xs text-ink-3">
        Price return = share price change. Total return = price change plus dividends reinvested on the ex-date.
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 font-medium">Period</th>
            <th className="pb-2 text-right font-medium">Price return</th>
            {hasTR && <th className="pb-2 text-right font-medium">Total return</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.period}>
              <td className="py-2.5">
                <div className="font-medium">{PERIOD_LABELS[r.period]}</div>
                {r.startDay != null && <div className="text-[11px] text-ink-3">from {fmtDay(r.startDay)}</div>}
              </td>
              <td className={`py-2.5 text-right font-semibold tnum ${r.priceReturn == null ? "text-ink-3" : r.priceReturn >= 0 ? "text-gain" : "text-loss"}`}>
                {r.priceReturn == null ? "Not enough history" : pct(r.priceReturn)}
                {r.cagrPrice != null && r.period !== "1Y" && <div className="text-[11px] font-normal text-ink-3">{pct(r.cagrPrice)}/yr</div>}
              </td>
              {hasTR && (
                <td className={`py-2.5 text-right font-semibold tnum ${r.totalReturn == null ? "text-ink-3" : r.totalReturn >= 0 ? "text-gain" : "text-loss"}`}>
                  {r.totalReturn == null ? "—" : pct(r.totalReturn)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
