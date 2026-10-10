import { dayFromUnix } from "../engine/dates";
import type { AssetType, DataSourceInfo, Dividend, PriceHistory, Split } from "../types";

export function mapType(t: string | undefined): AssetType {
  switch (t) {
    case "EQUITY":
      return "EQUITY";
    case "ETF":
      return "ETF";
    case "INDEX":
      return "INDEX";
    case "MUTUALFUND":
      return "MUTUALFUND";
    default:
      return "OTHER";
  }
}

export interface YahooChart {
  meta: Record<string, unknown> & { gmtoffset?: number; currency?: string; firstTradeDate?: number };
  timestamp?: number[];
  indicators: { quote: { close: (number | null)[]; volume: (number | null)[] }[] };
  events?: {
    dividends?: Record<string, { date: number; amount: number }>;
    splits?: Record<string, { date: number; numerator: number; denominator: number }>;
  };
}

/** Exported for tests and the fixture snapshot script. */
export function parseYahooChart(symbol: string, chart: YahooChart, src: DataSourceInfo): PriceHistory {
  const gmt = chart.meta.gmtoffset ?? -14_400;
  const ts = chart.timestamp ?? [];
  const q = chart.indicators.quote[0] ?? { close: [], volume: [] };
  const days: number[] = [];
  const close: number[] = [];
  const volume: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close[i];
    if (c == null || !Number.isFinite(c) || c <= 0) continue; // halted / missing session
    const d = dayFromUnix(ts[i], gmt);
    if (days.length && d <= days[days.length - 1]) {
      // Yahoo occasionally repeats the live bar; keep the most recent.
      if (d === days[days.length - 1]) {
        close[close.length - 1] = c;
        volume[volume.length - 1] = q.volume[i] ?? 0;
      }
      continue;
    }
    days.push(d);
    close.push(c);
    volume.push(q.volume[i] ?? 0);
  }
  const dividends: Dividend[] = Object.values(chart.events?.dividends ?? {})
    .map((d) => ({ day: dayFromUnix(d.date, gmt), amount: d.amount }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => a.day - b.day);
  const splits: Split[] = Object.values(chart.events?.splits ?? {})
    .map((s) => ({ day: dayFromUnix(s.date, gmt), ratio: s.numerator / s.denominator }))
    .filter((s) => Number.isFinite(s.ratio) && s.ratio > 0)
    .sort((a, b) => a.day - b.day);
  const type = mapType(chart.meta.instrumentType as string | undefined);
  return {
    symbol,
    currency: chart.meta.currency ?? "USD",
    days,
    close,
    volume,
    dividends,
    splits,
    // Indices pay no dividends; Yahoo's dividend feed is otherwise good for
    // US equities and ETFs.
    dividendsReliable: type !== "INDEX",
    firstTradeDay: chart.meta.firstTradeDate != null ? dayFromUnix(chart.meta.firstTradeDate, gmt) : undefined,
    source: src,
  };
}

