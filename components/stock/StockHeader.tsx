import type { Quote } from "@/lib/types";
import { fmtTimestamp, pct, price } from "@/lib/format";
import { TickerLogo } from "../ui/Logo";

const FRESHNESS: Record<Quote["freshness"], { label: string; dot: string }> = {
  "real-time": { label: "Real-time", dot: "bg-gain" },
  delayed: { label: "Delayed", dot: "bg-accent" },
  "previous-close": { label: "At close", dot: "bg-ink-3" },
};

const STATE: Record<Quote["marketState"], string> = {
  open: "Market open",
  pre: "Pre-market",
  post: "After hours",
  closed: "Market closed",
};

export function StockHeader({ quote, symbol, fallbackName }: { quote: Quote | null; symbol: string; fallbackName: string }) {
  if (!quote) {
    return (
      <div className="flex items-center gap-4">
        <TickerLogo symbol={symbol} size={56} />
        <div>
          <h1 className="font-display text-3xl font-bold">{fallbackName}</h1>
          <p className="text-sm text-ink-3">{symbol} · live quote unavailable right now</p>
        </div>
      </div>
    );
  }
  const up = quote.change >= 0;
  const f = FRESHNESS[quote.freshness];
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-4">
        <TickerLogo symbol={symbol} size={56} />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-4xl">{quote.name}</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            <span className="font-semibold text-ink-2">{symbol}</span> · {quote.exchange || "US"} · {quote.type === "ETF" ? "ETF" : quote.type === "INDEX" ? "Index" : "Stock"} · {quote.currency}
          </p>
        </div>
      </div>
      <div className="sm:text-right">
        <div className="flex items-baseline gap-3 sm:justify-end">
          <span className="font-display text-4xl font-bold tnum">{price(quote.price)}</span>
          <span className={`text-lg font-semibold tnum ${up ? "text-gain" : "text-loss"}`}>
            {up ? "+" : "−"}
            {Math.abs(quote.change).toFixed(2)} ({pct(quote.changePercent / 100)})
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3 sm:justify-end">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
            {f.label}
            {quote.freshness === "delayed" && quote.delayMinutes ? ` ${quote.delayMinutes} min` : ""}
          </span>
          <span>{STATE[quote.marketState]}</span>
          <span>{fmtTimestamp(quote.asOf)}</span>
          {quote.source.kind === "demo" && <span className="font-semibold text-accent-ink">Demo snapshot</span>}
        </div>
        {quote.extended && (
          <div className="mt-1 text-xs text-ink-2 tnum">
            {quote.extended.label}: {price(quote.extended.price)}{" "}
            <span className={quote.extended.change >= 0 ? "text-gain" : "text-loss"}>{pct(quote.extended.changePercent / 100)}</span> ·{" "}
            {fmtTimestamp(quote.extended.asOf)}
          </div>
        )}
      </div>
    </div>
  );
}
