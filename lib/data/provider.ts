import type { Fundamentals, IntradaySeries, PriceHistory, Quote, SearchResult } from "../types";

/**
 * Every market-data source implements this interface, so swapping providers
 * is a config change (MARKET_DATA_PROVIDER) rather than a rewrite.
 * Symbols are passed in the canonical "BRK.B" form; providers translate.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  search(query: string): Promise<SearchResult[]>;
  history(symbol: string): Promise<PriceHistory>;
  quote(symbol: string): Promise<Quote>;
  fundamentals(symbol: string): Promise<Fundamentals | null>;
  intraday(symbol: string, range: "1d" | "5d"): Promise<IntradaySeries | null>;
}

export class NotFoundError extends Error {
  constructor(symbol: string) {
    super(`No data for ${symbol}`);
    this.name = "NotFoundError";
  }
}
