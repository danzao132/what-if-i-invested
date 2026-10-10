import "server-only";
import type { DataSourceInfo, Quote } from "../types";
import { adjustTiingoRows, type EodRow } from "./tiingo-adjust";
import { NotFoundError, type MarketDataProvider } from "./provider";
import { universeEntry } from "./universe";

/**
 * Tiingo adapter (recommended licensed provider; see README for plan tiers
 * and redistribution terms). Requires TIINGO_API_KEY.
 *
 * Tiingo EOD rows carry UNADJUSTED `close`, plus `splitFactor` and `divCash`
 * on the ex-date. We split-adjust ourselves so the engine receives the same
 * basis as every other provider: close_adj[i] = close[i] / Π(splitFactor after i).
 */
const BASE = "https://api.tiingo.com";
const key = () => process.env.TIINGO_API_KEY ?? "";
const toTiingo = (s: string) => s.replace(".", "-").toLowerCase();

const source = (): DataSourceInfo => ({ provider: "Tiingo", kind: "live", fetchedAt: new Date().toISOString() });

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}token=${key()}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`Tiingo ${res.status}`);
  return (await res.json()) as T;
}

export const tiingoProvider: MarketDataProvider = {
  id: "tiingo",
  label: "Tiingo",
  async search(query) {
    const rows = await get<{ ticker: string; name: string; assetType: string; countryCode: string; isActive: boolean }[]>(
      `/tiingo/utilities/search?query=${encodeURIComponent(query)}&limit=10`,
    );
    return rows
      .filter((r) => r.countryCode === "US" && r.isActive)
      .map((r) => ({
        symbol: r.ticker.toUpperCase().replace("-", "."),
        name: r.name,
        exchange: "US",
        type: r.assetType === "ETF" ? ("ETF" as const) : ("EQUITY" as const),
      }));
  },
  async history(symbol) {
    const rows = await get<EodRow[]>(`/tiingo/daily/${toTiingo(symbol)}/prices?startDate=1900-01-01&resampleFreq=daily`);
    if (rows.length < 2) throw new NotFoundError(symbol);
    return adjustTiingoRows(symbol, rows, source());
  },
  async quote(symbol): Promise<Quote> {
    const [iex] = await get<{ last?: number; tngoLast: number; prevClose: number; timestamp: string; open?: number; high?: number; low?: number; volume?: number }[]>(
      `/iex/${toTiingo(symbol)}`,
    );
    if (!iex) throw new NotFoundError(symbol);
    const price = iex.last ?? iex.tngoLast;
    const u = universeEntry(symbol);
    return {
      symbol,
      name: u?.name ?? symbol,
      exchange: u?.exchange ?? "",
      currency: "USD",
      type: u?.type ?? "EQUITY",
      price,
      change: price - iex.prevClose,
      changePercent: (price / iex.prevClose - 1) * 100,
      previousClose: iex.prevClose,
      asOf: iex.timestamp,
      // IEX top-of-book is real-time for IEX trades only; label conservatively.
      freshness: iex.last != null ? "real-time" : "delayed",
      delayMinutes: iex.last != null ? 0 : 15,
      marketState: iex.last != null ? "open" : "closed",
      open: iex.open,
      dayHigh: iex.high,
      dayLow: iex.low,
      volume: iex.volume,
      source: source(),
    };
  },
  async fundamentals() {
    // Tiingo fundamentals is a separate add-on; wire it here when licensed.
    return null;
  },
  async intraday() {
    return null;
  },
};
