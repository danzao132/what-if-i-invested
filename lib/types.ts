// Shared domain types. Kept free of React/Next imports so the engine and
// data layer can be unit-tested and reused anywhere.

/** Calendar day expressed as whole days since 1970-01-01 (UTC). */
export type DayNumber = number;

export type ReturnMode = "price" | "total";

export type AssetType = "EQUITY" | "ETF" | "INDEX" | "MUTUALFUND" | "OTHER";

export interface Split {
  day: DayNumber;
  /** New shares per old share. 4 for a 4:1 split, 0.1 for a 1:10 reverse split. */
  ratio: number;
}

export interface Dividend {
  day: DayNumber;
  /** Cash per share, split-adjusted onto the same basis as `close`. */
  amount: number;
}

/**
 * Daily history in columnar form. `close` is split-adjusted (NOT dividend
 * adjusted), so `close[j] / close[i]` is a pure price return. Total return is
 * derived from `close` + `dividends` by the engine (see engine/series.ts).
 */
export interface PriceHistory {
  symbol: string;
  currency: string;
  days: DayNumber[];
  close: number[];
  volume: number[];
  dividends: Dividend[];
  splits: Split[];
  /** False when the provider's dividend data can't be trusted for total return. */
  dividendsReliable: boolean;
  /** First date the provider reports trading (may predate `days[0]`). */
  firstTradeDay?: DayNumber;
  source: DataSourceInfo;
}

export interface DataSourceInfo {
  provider: string;
  /** "live" = fetched from the provider now; "demo" = bundled snapshot. */
  kind: "live" | "demo";
  fetchedAt: string;
  note?: string;
}

export type QuoteFreshness = "real-time" | "delayed" | "previous-close";
export type MarketState = "open" | "pre" | "post" | "closed";

export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  type: AssetType;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  /** ISO timestamp of the price. */
  asOf: string;
  freshness: QuoteFreshness;
  delayMinutes: number;
  marketState: MarketState;
  extended?: { label: "Pre-market" | "After hours"; price: number; change: number; changePercent: number; asOf: string };
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  source: DataSourceInfo;
}

export interface Fundamentals {
  symbol: string;
  market: {
    marketCap?: number;
    peRatio?: number;
    eps?: number;
    dividendYield?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    volume?: number;
    avgVolume?: number;
    beta?: number;
    sharesOutstanding?: number;
    expenseRatio?: number;
  };
  profile: {
    description?: string;
    sector?: string;
    industry?: string;
    headquarters?: string;
    website?: string;
    employees?: number;
    /** Parsed from the provider's own profile text when it states it. */
    founded?: number;
    category?: string;
    fundFamily?: string;
  };
  financials: {
    fiscalYearEnd?: string;
    revenue?: number;
    revenueGrowth?: number;
    netIncome?: number;
    operatingMargin?: number;
    freeCashFlow?: number;
    totalDebt?: number;
    cash?: number;
  };
  source: DataSourceInfo;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: AssetType;
}

export interface IntradayBar {
  t: number; // unix seconds
  c: number;
  v: number;
}

export interface IntradaySeries {
  symbol: string;
  bars: IntradayBar[];
  previousClose?: number;
  source: DataSourceInfo;
}
