import "server-only";
import type { Fundamentals, IntradaySeries, PriceHistory, Quote, SearchResult } from "../types";
import { fixtureProvider } from "./fixtures";
import { NotFoundError, type MarketDataProvider } from "./provider";
import { tiingoProvider } from "./tiingo";
import { searchUniverse } from "./universe";
import { yahooProvider } from "./yahoo";

/**
 * Data access facade: picks the provider from MARKET_DATA_PROVIDER, caches
 * results in-process (on top of CDN caching at the route layer), dedupes
 * concurrent requests, and falls back to the clearly-labelled demo snapshot
 * when the live provider is unavailable.
 */
function pickProvider(): MarketDataProvider {
  switch ((process.env.MARKET_DATA_PROVIDER ?? "yahoo").toLowerCase()) {
    case "tiingo":
      if (process.env.TIINGO_API_KEY) return tiingoProvider;
      console.warn("[data] MARKET_DATA_PROVIDER=tiingo but TIINGO_API_KEY is missing — using demo snapshot");
      return fixtureProvider;
    case "fixtures":
    case "demo":
      return fixtureProvider;
    default:
      return yahooProvider;
  }
}

export const provider = pickProvider();
const fallbackEnabled = process.env.DEMO_FALLBACK !== "off";

interface Entry<T> {
  at: number;
  value: Promise<T>;
}

class TTLCache<T> {
  private map = new Map<string, Entry<T>>();
  constructor(private ttlMs: number, private max = 200) {}
  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.map.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      this.map.delete(key);
      this.map.set(key, hit); // LRU bump
      return hit.value;
    }
    const value = load();
    this.map.set(key, { at: Date.now(), value });
    value.catch(() => this.map.delete(key));
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
    return value;
  }
}

const HOUR = 3600_000;
const historyCache = new TTLCache<PriceHistory>(3 * HOUR, 120);
const quoteCache = new TTLCache<Quote>(60_000, 300);
const fundamentalsCache = new TTLCache<Fundamentals | null>(12 * HOUR, 200);
const searchCache = new TTLCache<SearchResult[]>(24 * HOUR, 500);
const intradayCache = new TTLCache<IntradaySeries | null>(2 * 60_000, 100);

async function withFallback<T>(live: () => Promise<T>, demo: () => Promise<T>): Promise<T> {
  if (provider === fixtureProvider) return demo();
  try {
    return await live();
  } catch (err) {
    if (!fallbackEnabled) throw err;
    try {
      return await demo();
    } catch {
      throw err instanceof NotFoundError ? err : new NotFoundError(String(err));
    }
  }
}

export function getHistory(symbol: string): Promise<PriceHistory> {
  return historyCache.get(symbol, () =>
    withFallback(
      () => provider.history(symbol),
      () => fixtureProvider.history(symbol),
    ),
  );
}

export function getQuote(symbol: string): Promise<Quote> {
  return quoteCache.get(symbol, () =>
    withFallback(
      () => provider.quote(symbol),
      () => fixtureProvider.quote(symbol),
    ),
  );
}

export function getFundamentals(symbol: string): Promise<Fundamentals | null> {
  return fundamentalsCache.get(symbol, () => provider.fundamentals(symbol).catch(() => null));
}

export function getIntraday(symbol: string, range: "1d" | "5d"): Promise<IntradaySeries | null> {
  return intradayCache.get(`${symbol}:${range}`, () => provider.intraday(symbol, range).catch(() => null));
}

export function search(q: string): Promise<SearchResult[]> {
  const key = q.trim().toLowerCase();
  return searchCache.get(key, async () => {
    const local = searchUniverse(key, 6);
    let remote: SearchResult[] = [];
    try {
      remote = await provider.search(key);
    } catch {
      remote = [];
    }
    const seen = new Set<string>();
    return [...local, ...remote].filter((r) => (seen.has(r.symbol) ? false : (seen.add(r.symbol), true))).slice(0, 10);
  });
}

export { NotFoundError };
