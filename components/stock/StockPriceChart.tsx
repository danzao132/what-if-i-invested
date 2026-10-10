"use client";

import { useMemo, useState } from "react";
import { addMonths, addYears, startOfYear } from "@/lib/engine/dates";
import { indexOnOrAfter, sampleIndices, type PreparedSeries } from "@/lib/engine/series";
import { useIntraday } from "@/lib/client/data";
import { fmtDay, pct, price } from "@/lib/format";
import { LineChart } from "../charts/LineChart";

const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "10Y", "MAX"] as const;
type Range = (typeof RANGES)[number];

export function StockPriceChart({ series, name }: { series: PreparedSeries; name: string }) {
  const [range, setRange] = useState<Range>("1Y");
  const intra = useIntraday(series.history.symbol, range === "1D" ? "1d" : range === "5D" ? "5d" : null);
  const n = series.days.length;
  const last = series.days[n - 1];

  const daily = useMemo(() => {
    if (range === "1D" || range === "5D") return null;
    const target =
      range === "1M" ? addMonths(last, -1)
      : range === "6M" ? addMonths(last, -6)
      : range === "YTD" ? startOfYear(last)
      : range === "1Y" ? addYears(last, -1)
      : range === "5Y" ? addYears(last, -5)
      : range === "10Y" ? addYears(last, -10)
      : series.days[0];
    const from = Math.max(0, indexOnOrAfter(series.days, Math.max(target, series.days[0])));
    // Change is measured from the prior close for YTD, the market convention.
    const base = range === "YTD" && from > 0 ? from - 1 : from;
    const idx = sampleIndices(from, n - 1, 420);
    return {
      points: idx.map((i) => ({ x: series.days[i], y: series.price[i] })),
      volume: n - from <= 420 ? idx.map((i) => ({ x: series.days[i], v: series.history.volume[i] })) : undefined,
      change: series.price[n - 1] / series.price[base] - 1,
      baseline: series.price[base],
      truncated: target < series.days[0],
    };
  }, [range, series, n, last]);

  const intraday = useMemo(() => {
    if (!intra.data || !intra.data.bars.length) return null;
    const bars = intra.data.bars;
    const prev = range === "1D" ? (intra.data.previousClose ?? bars[0].c) : bars[0].c;
    return {
      points: bars.map((b) => ({ x: b.t, y: b.c })),
      volume: bars.map((b) => ({ x: b.t, v: b.v })),
      change: bars.at(-1)!.c / prev - 1,
      baseline: prev,
    };
  }, [intra.data, range]);

  const data = daily ?? intraday;
  const up = (data?.change ?? 0) >= 0;
  const intradayUnavailable = (range === "1D" || range === "5D") && !intra.loading && !intraday;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="price-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="price-title" className="font-display text-xl font-semibold">Price history</h2>
          {data && (
            <p className="text-sm tnum">
              <span className={up ? "text-gain" : "text-loss"}>{pct(data.change)}</span>{" "}
              <span className="text-ink-3">{range === "MAX" || (daily?.truncated ?? false) ? "since " + fmtDay(series.days[0]) : range === "1D" ? "today" : `over ${range}`}</span>
            </p>
          )}
        </div>
        <div className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className="chip shrink-0 px-3 py-1.5 text-[13px]">
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {intradayUnavailable ? (
          <div className="grid h-[300px] place-items-center rounded-2xl bg-surface-2 text-sm text-ink-3">Intraday data isn&apos;t available from the current data source.</div>
        ) : data ? (
          <LineChart
            key={range}
            series={[{ id: "p", label: name, color: up ? "var(--gain)" : "var(--loss)", points: data.points, area: true }]}
            volume={data.volume}
            baseline={range === "1D" ? { y: data.baseline, label: "Prev. close" } : undefined}
            xKind={daily ? "day" : "unix"}
            height={320}
            formatY={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : v < 1 ? `$${v.toPrecision(2)}` : `$${v.toFixed(v < 10 ? 2 : 0)}`)}
            ariaLabel={`${name} price chart, ${range}`}
            renderTooltip={(x, v) => (
              <div>
                <div className="text-ink-3">
                  {daily ? fmtDay(x) : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(x * 1000))}
                </div>
                <div className="font-semibold text-ink tnum">{price(v[0].point.y)}</div>
                <div className={`tnum ${v[0].point.y >= data.baseline ? "text-gain" : "text-loss"}`}>{pct(v[0].point.y / data.baseline - 1)} from start</div>
              </div>
            )}
          />
        ) : (
          <div className="skeleton h-[320px]" />
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Daily closes adjusted for splits. Intraday prices may be delayed.</p>
    </section>
  );
}
