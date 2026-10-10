import "server-only";
import { computeInvestment, periodStartDay, type InvestmentResult } from "./engine/calc";
import { dayFromISO } from "./engine/dates";
import { prepareSeries, sampleIndices, type PreparedSeries } from "./engine/series";
import { getHistory, getQuote } from "./data";
import type { AssetType } from "./types";
import { universeEntry } from "./data/universe";

/**
 * Server-side discovery content. Every number shown on the homepage is
 * computed here from the same engine and data feed as the calculators —
 * nothing is hard-coded.
 */
const prepared = new Map<string, { at: number; p: Promise<PreparedSeries> }>();
export function getPrepared(symbol: string): Promise<PreparedSeries> {
  const hit = prepared.get(symbol);
  if (hit && Date.now() - hit.at < 3 * 3600_000) return hit.p;
  const p = getHistory(symbol).then(prepareSeries);
  p.catch(() => prepared.delete(symbol));
  prepared.set(symbol, { at: Date.now(), p });
  return p;
}

export interface StockSummary {
  symbol: string;
  name: string;
  lastClose: number;
  dayChange: number;
  tenYear: InvestmentResult;
  spark: number[];
  demo: boolean;
  marketCap?: number;
  type?: AssetType;
}

export async function summarize(symbol: string): Promise<StockSummary | null> {
  try {
    const [s, quote] = await Promise.all([getPrepared(symbol), getQuote(symbol).catch(() => null)]);
    const n = s.days.length;
    const tenYear = computeInvestment(s, 1000, Math.max(s.days[0], periodStartDay(s, "10Y")), "price");
    const from = Math.max(0, n - 252);
    return {
      symbol,
      name: universeEntry(symbol)?.name ?? symbol,
      lastClose: s.price[n - 1],
      dayChange: s.price[n - 1] / s.price[n - 2] - 1,
      tenYear,
      spark: sampleIndices(from, n - 1, 48).map((i) => s.price[i]),
      demo: s.history.source.kind === "demo",
      marketCap: quote?.marketCap,
      type: quote?.type ?? universeEntry(symbol)?.type,
    };
  } catch {
    return null;
  }
}

export interface Scenario {
  symbol: string;
  date: string;
  title: string;
  /** Context limited to facts that are widely documented. */
  context: string;
  amount: number;
}

/** Notable dates. Copy is deliberately conservative: no invented events. */
export const FASCINATING: Scenario[] = [
  { symbol: "AAPL", date: "2007-06-29", title: "The day the iPhone went on sale", context: "The first iPhone launched in US stores on June 29, 2007.", amount: 1000 },
  { symbol: "AMZN", date: "1997-05-15", title: "Amazon's first day of trading", context: "Amazon listed on NASDAQ in May 1997.", amount: 1000 },
  { symbol: "NFLX", date: "2002-05-23", title: "Netflix's IPO day", context: "Netflix went public in May 2002, while still a DVD-by-mail service.", amount: 1000 },
  { symbol: "NVDA", date: "2016-10-07", title: "Nvidia, ten years ago", context: "Long before the AI boom made it a household name.", amount: 1000 },
  { symbol: "MSFT", date: "1986-03-13", title: "Microsoft's IPO", context: "Microsoft went public on March 13, 1986.", amount: 1000 },
  { symbol: "TSLA", date: "2010-06-29", title: "Tesla's first trading day", context: "Tesla listed on NASDAQ in June 2010.", amount: 1000 },
];

/** Shown only if the computed return is actually negative. */
export const NOT_WINNERS: Scenario[] = [
  { symbol: "CSCO", date: "2000-03-27", title: "Cisco at the dot-com peak", context: "Bought in March 2000, at the height of the dot-com bubble.", amount: 1000 },
  { symbol: "INTC", date: "2000-08-31", title: "Intel, summer 2000", context: "Bought near the top of the 2000 tech rally.", amount: 1000 },
  { symbol: "C", date: "2007-01-03", title: "Citigroup before the financial crisis", context: "Bought at the start of 2007, before the 2008 banking crisis.", amount: 1000 },
  { symbol: "PTON", date: "2021-01-14", title: "Peloton during lockdown", context: "Bought in January 2021, when at-home fitness demand was surging.", amount: 1000 },
];

export interface ComputedScenario extends Scenario {
  result: InvestmentResult;
}

export async function computeScenarios(list: Scenario[]): Promise<ComputedScenario[]> {
  const out = await Promise.all(
    list.map(async (sc) => {
      try {
        const s = await getPrepared(sc.symbol);
        const result = computeInvestment(s, sc.amount, dayFromISO(sc.date), "price");
        return result.status === "ok" ? { ...sc, result } : null;
      } catch {
        return null;
      }
    }),
  );
  return out.filter((x): x is ComputedScenario => x !== null);
}

/** Universe used for "Biggest winners": stated on the page. */
export const WINNER_UNIVERSE = ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "TSLA", "META", "NFLX", "BRK.B", "KO", "AMD", "INTC", "F", "GM", "CSCO", "SBUX", "SONY", "C", "SPY", "QQQ"];
