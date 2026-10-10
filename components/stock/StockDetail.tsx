"use client";

import { useSeries } from "@/lib/client/data";
import type { Quote, ReturnMode } from "@/lib/types";
import { TimeMachine } from "../time-machine/TimeMachine";
import { HistoricalPerformance } from "./HistoricalPerformance";
import { StockFundamentals } from "./StockFundamentals";
import { StockPriceChart } from "./StockPriceChart";

export function StockDetail(props: { symbol: string; name: string; quote: Quote | null; amount: number; day: number | null; mode: ReturnMode }) {
  const { data: series, error } = useSeries(props.symbol);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-accent-ink">What if you had invested?</h2>
        <TimeMachine
          initialSymbol={props.symbol}
          initialAmount={props.amount}
          initialDay={props.day}
          initialMode={props.mode}
          symbolBehavior="navigate"
          syncUrl
          symbolInPath
          headline={false}
        />
      </div>
      {error && <div className="card p-6 text-sm text-ink-2">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {series ? <StockPriceChart series={series} name={props.name} /> : <div className="skeleton h-[420px]" />}
        {series ? <HistoricalPerformance series={series} /> : <div className="skeleton h-[420px]" />}
      </div>
      <StockFundamentals symbol={props.symbol} quote={props.quote} />
    </div>
  );
}
