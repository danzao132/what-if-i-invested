import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isoFromDay } from "../engine/dates";
import type { DataSourceInfo, PriceHistory, Quote } from "../types";
import { NotFoundError, type MarketDataProvider } from "./provider";
import { searchUniverse, universeEntry } from "./universe";
import { parseYahooChart, type YahooChart } from "./yahoo-parse";

/**
 * Offline provider that serves bundled snapshots of REAL historical data
 * (captured by scripts/snapshot-fixtures.mjs). Every response is labelled
 * kind:"demo" with its capture date so the UI can say so plainly.
 */
interface Fixture {
  capturedAt: string;
  source: string;
  chart: YahooChart;
  adjclose: (number | null)[] | null;
}

const dir = join(process.cwd(), "data", "fixtures");
const cache = new Map<string, Promise<Fixture>>();

export function loadFixture(symbol: string): Promise<Fixture> {
  let p = cache.get(symbol);
  if (!p) {
    p = readFile(join(dir, `${symbol}.json`), "utf8")
      .then((t) => JSON.parse(t) as Fixture)
      .catch(() => {
        cache.delete(symbol);
        throw new NotFoundError(symbol);
      });
    cache.set(symbol, p);
  }
  return p;
}

function src(f: Fixture): DataSourceInfo {
  return {
    provider: "Bundled demo snapshot",
    kind: "demo",
    fetchedAt: f.capturedAt,
    note: `Real historical data captured ${f.capturedAt.slice(0, 10)} from ${f.source}. Not live.`,
  };
}

export async function fixtureHistory(symbol: string): Promise<PriceHistory> {
  const f = await loadFixture(symbol);
  return parseYahooChart(symbol, f.chart, src(f));
}

export const fixtureProvider: MarketDataProvider = {
  id: "fixtures",
  label: "Bundled demo snapshot",
  async search(q) {
    return searchUniverse(q, 10);
  },
  history: fixtureHistory,
  async quote(symbol): Promise<Quote> {
    const f = await loadFixture(symbol);
    const h = parseYahooChart(symbol, f.chart, src(f));
    const n = h.close.length;
    const price = h.close[n - 1];
    const prev = h.close[n - 2];
    const u = universeEntry(symbol);
    return {
      symbol,
      name: u?.name ?? f.chart.meta.longName?.toString() ?? symbol,
      exchange: u?.exchange ?? "",
      currency: h.currency,
      type: u?.type ?? "EQUITY",
      price,
      change: price - prev,
      changePercent: (price / prev - 1) * 100,
      previousClose: prev,
      asOf: `${isoFromDay(h.days[n - 1])}T20:00:00.000Z`,
      freshness: "previous-close",
      delayMinutes: 0,
      marketState: "closed",
      volume: h.volume[n - 1],
      source: src(f),
    };
  },
  async fundamentals() {
    return null;
  },
  async intraday() {
    return null;
  },
};
