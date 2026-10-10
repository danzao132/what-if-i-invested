import type { DataSourceInfo, PriceHistory } from "./types";

/** Compact JSON encoding of PriceHistory for the browser (~3× smaller). */
export interface WireHistory {
  symbol: string;
  currency: string;
  d: number[];
  c: number[];
  v: number[];
  div: [number, number][];
  spl: [number, number][];
  dr: boolean;
  first?: number;
  source: DataSourceInfo;
}

const sig = (x: number) => Number(x.toPrecision(8));

export function encodeHistory(h: PriceHistory): WireHistory {
  return {
    symbol: h.symbol,
    currency: h.currency,
    d: h.days,
    c: h.close.map(sig),
    v: h.volume,
    div: h.dividends.map((x) => [x.day, sig(x.amount)]),
    spl: h.splits.map((x) => [x.day, sig(x.ratio)]),
    dr: h.dividendsReliable,
    first: h.firstTradeDay,
    source: h.source,
  };
}

export function decodeHistory(w: WireHistory): PriceHistory {
  return {
    symbol: w.symbol,
    currency: w.currency,
    days: w.d,
    close: w.c,
    volume: w.v,
    dividends: w.div.map(([day, amount]) => ({ day, amount })),
    splits: w.spl.map(([day, ratio]) => ({ day, ratio })),
    dividendsReliable: w.dr,
    firstTradeDay: w.first,
    source: w.source,
  };
}
