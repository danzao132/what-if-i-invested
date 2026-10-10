"use client";

import { useMemo, useState } from "react";
import { valuePath } from "@/lib/engine/calc";
import { indexOnOrAfter, type PreparedSeries } from "@/lib/engine/series";
import { useSeries } from "@/lib/client/data";
import { fmtDay, money, moneyCompact, pct } from "@/lib/format";
import type { ReturnMode } from "@/lib/types";
import { LineChart, type ChartSeries } from "../charts/LineChart";

/**
 * "Your $1,000 in Apple": the investment's value from purchase to today, with
 * the original amount as a baseline and an optional S&P 500 (SPY) benchmark
 * computed with the SAME dates, amount and return methodology.
 */
export function InvestmentValueChart({
  series,
  symbol,
  name,
  amount,
  startIndex,
  mode,
}: {
  series: PreparedSeries;
  symbol: string;
  name: string;
  amount: number;
  startIndex: number;
  mode: ReturnMode;
}) {
  const [benchmark, setBenchmark] = useState(symbol !== "SPY");
  const [log, setLog] = useState(false);
  const spy = useSeries(benchmark && symbol !== "SPY" ? "SPY" : null);
  const endIndex = series.days.length - 1;
  const startDay = series.days[startIndex];

  const chartSeries = useMemo(() => {
    const main = valuePath(series, amount, startIndex, endIndex, mode, 360);
    const out: ChartSeries[] = [
      {
        id: symbol,
        label: name,
        color: main.at(-1)!.value >= amount ? "var(--gain)" : "var(--loss)",
        points: main.map((p) => ({ x: p.day, y: p.value })),
        area: true,
        strokeWidth: 2.25,
      },
    ];
    if (spy.data && benchmark) {
      const s = spy.data;
      const si = indexOnOrAfter(s.days, startDay);
      // Benchmark must cover the same window, or it isn't shown at all.
      if (si >= 0 && s.days[0] <= startDay) {
        const ei = s.days.length - 1;
        const bp = valuePath(s, amount, si, ei, mode, 360);
        out.push({ id: "SPY", label: "S&P 500 (SPY)", color: "var(--past)", points: bp.map((p) => ({ x: p.day, y: p.value })), dashed: true, strokeWidth: 1.75 });
      }
    }
    return out;
  }, [series, amount, startIndex, endIndex, mode, symbol, name, spy.data, benchmark, startDay]);

  const spyUnavailable = benchmark && spy.data && spy.data.days[0] > startDay;

  return (
    <section className="card p-5 sm:p-7" aria-labelledby="ivc-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Day by day</div>
          <h3 id="ivc-title" className="font-display text-xl font-semibold sm:text-2xl">
            Your {money(amount)} in {name}
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            From {fmtDay(startDay)} to {fmtDay(series.days[endIndex])} · {mode === "total" ? "dividends reinvested" : "price return"}
          </p>
        </div>
        <div className="flex items-center gap-3">
        {symbol !== "SPY" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--past)]" checked={benchmark} onChange={(e) => setBenchmark(e.target.checked)} />
            Compare with S&amp;P 500 (SPY)
          </label>
        )}
          <button type="button" className="chip px-3 py-1.5 text-[13px]" aria-pressed={log} onClick={() => setLog(!log)}>
            Log
          </button>
        </div>
      </div>
      <div className="mt-5">
        <LineChart
          series={chartSeries}
          height={300}
          yLog={log}
          baseline={{ y: amount, label: `You put in ${money(amount)}` }}
          formatY={(v) => moneyCompact(v)}
          ariaLabel={`Value of ${money(amount)} invested in ${name} over time`}
          renderTooltip={(x, values) => (
            <div>
              <div className="font-medium text-ink-2">{fmtDay(x)}</div>
              {values.map(({ series: s, point }) => (
                <div key={s.id} className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-ink-3">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    {s.id}
                  </span>
                  <span className="text-right tnum">
                    <b className="text-ink">{money(point.y)}</b>{" "}
                    <span className={point.y >= amount ? "text-gain" : "text-loss"}>{pct(point.y / amount - 1)}</span>
                  </span>
                </div>
              ))}
              <div className="mt-1 text-ink-3 tnum">
                {money(values[0].point.y - amount, { sign: true })} vs. what you put in
              </div>
            </div>
          )}
        />
      </div>
      {spyUnavailable && <p className="mt-3 text-xs text-ink-3">The S&amp;P 500 benchmark (SPY) has no data for this start date, so it isn&apos;t shown.</p>}
    </section>
  );
}
