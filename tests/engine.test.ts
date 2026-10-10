import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeInvestment, periodReturns, valuePath } from "../lib/engine/calc";
import { dayFromISO, describeDuration, isoFromDay } from "../lib/engine/dates";
import { indexOnOrAfter, prepareSeries } from "../lib/engine/series";
import { adjustTiingoRows } from "../lib/data/tiingo-adjust";
import { parseYahooChart, type YahooChart } from "../lib/data/yahoo-parse";
import type { PriceHistory } from "../lib/types";

// ---------------------------------------------------------------------------
// helpers
const SRC = { provider: "test", kind: "demo" as const, fetchedAt: "" };

function fixture(symbol: string) {
  const f = JSON.parse(readFileSync(join(__dirname, "..", "data", "fixtures", `${symbol}.json`), "utf8")) as {
    chart: YahooChart;
    adjclose: (number | null)[];
  };
  const history = parseYahooChart(symbol, f.chart, SRC);
  // Map day → Yahoo adjclose for the independent total-return cross-check.
  const adj = new Map<number, number>();
  const gmt = f.chart.meta.gmtoffset ?? -14400;
  f.chart.timestamp!.forEach((t, i) => {
    const v = f.adjclose[i];
    if (v != null) adj.set(Math.floor((t + gmt) / 86400), v);
  });
  return { s: prepareSeries(history), adj };
}

function toy(closes: number[], dividends: { i: number; amount: number }[] = [], startISO = "2020-01-01"): PriceHistory {
  const d0 = dayFromISO(startISO);
  return {
    symbol: "TOY",
    currency: "USD",
    days: closes.map((_, i) => d0 + i),
    close: closes,
    volume: closes.map(() => 0),
    dividends: dividends.map((d) => ({ day: d0 + d.i, amount: d.amount })),
    splits: [],
    dividendsReliable: true,
    source: SRC,
  };
}

const D = dayFromISO;

// ---------------------------------------------------------------------------
describe("core formula (synthetic series)", () => {
  it("value = amount × end / start, fractional shares", () => {
    const s = prepareSeries(toy([10, 12, 15, 20]));
    const r = computeInvestment(s, 1000, D("2020-01-01"));
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(2000, 10);
    expect(r.shares).toBeCloseTo(100, 10);
    expect(r.gain).toBeCloseTo(1000, 10);
    expect(r.totalReturn).toBeCloseTo(1, 10);
  });

  it("reinvests dividends at the ex-date close exactly once", () => {
    // Buy 100 sh @10. Day 2: $1 dividend, ex-date close 10 → +10 shares → 110 sh.
    const s = prepareSeries(toy([10, 10, 10, 11], [{ i: 2, amount: 1 }]));
    const price = computeInvestment(s, 1000, D("2020-01-01"), "price");
    const total = computeInvestment(s, 1000, D("2020-01-01"), "total");
    expect(price.value).toBeCloseTo(1100, 10);
    expect(total.value).toBeCloseTo(110 * 11, 10);
    expect(total.sharesAtEnd).toBeCloseTo(110, 10);
  });

  it("does not credit a dividend whose ex-date is the purchase day", () => {
    // Buying on the ex-date means you are NOT entitled to that dividend.
    const s = prepareSeries(toy([10, 9, 9], [{ i: 1, amount: 1 }]));
    const r = computeInvestment(s, 900, D("2020-01-02"), "total");
    expect(r.value).toBeCloseTo(900, 10);
  });

  it("falls back to price return when dividends are unreliable", () => {
    const h = toy([10, 10, 11], [{ i: 1, amount: 1 }]);
    h.dividendsReliable = false;
    const r = computeInvestment(prepareSeries(h), 1000, D("2020-01-01"), "total");
    expect(r.effectiveMode).toBe("price");
    expect(r.value).toBeCloseTo(1100, 10);
  });

  it("CAGR uses actual elapsed time and is withheld under one year", () => {
    const h = toy([100, 200]);
    h.days = [D("2010-01-04"), D("2020-01-03")];
    const r = computeInvestment(prepareSeries(h), 1000, D("2010-01-04"));
    const years = (D("2020-01-03") - D("2010-01-04")) / 365.2425;
    expect(r.cagr!).toBeCloseTo(Math.pow(2, 1 / years) - 1, 12);
    const short = computeInvestment(prepareSeries(toy([10, 11, 12])), 1000, D("2020-01-01"));
    expect(short.cagr).toBeNull();
  });

  it("validates amount and date", () => {
    const s = prepareSeries(toy([10, 11]));
    expect(computeInvestment(s, 0, D("2020-01-01")).status).toBe("invalid-amount");
    expect(computeInvestment(s, -5, D("2020-01-01")).status).toBe("invalid-amount");
    expect(computeInvestment(s, NaN, D("2020-01-01")).status).toBe("invalid-amount");
    expect(computeInvestment(s, 100, NaN).status).toBe("invalid-date");
    expect(dayFromISO("2023-02-30")).toBeNaN();
    expect(computeInvestment(s, 100, D("2030-01-01")).status).toBe("after-latest");
  });

  it("value path starts at the amount and ends at the result", () => {
    const s = prepareSeries(toy([10, 12, 9, 15, 20, 18]));
    const r = computeInvestment(s, 500, D("2020-01-02"));
    const path = valuePath(s, 500, r.startIndex, r.endIndex, "price", 3);
    expect(path[0].value).toBeCloseTo(500, 10);
    expect(path.at(-1)!.value).toBeCloseTo(r.value, 10);
    expect(path).toHaveLength(3);
  });

  it("binary search returns next trading day", () => {
    expect(indexOnOrAfter([1, 3, 5], 0)).toBe(0);
    expect(indexOnOrAfter([1, 3, 5], 4)).toBe(2);
    expect(indexOnOrAfter([1, 3, 5], 6)).toBe(-1);
  });

  it("describes durations", () => {
    expect(describeDuration(D("2015-10-12"), D("2025-10-12"))).toBe("10 years");
    expect(describeDuration(D("2015-10-12"), D("2016-01-12"))).toBe("3 months");
  });
});

// ---------------------------------------------------------------------------
describe("Tiingo split adjustment", () => {
  it("puts unadjusted closes and dividends on today's share basis", () => {
    const rows = [
      { date: "2020-01-01", close: 400, volume: 10, divCash: 0, splitFactor: 1 },
      { date: "2020-01-02", close: 400, volume: 10, divCash: 4, splitFactor: 1 },
      { date: "2020-01-03", close: 100, volume: 40, divCash: 0, splitFactor: 4 },
      { date: "2020-01-06", close: 110, volume: 40, divCash: 0, splitFactor: 1 },
    ];
    const h = adjustTiingoRows("X", rows, SRC);
    expect(h.close).toEqual([100, 100, 100, 110]);
    expect(h.volume).toEqual([40, 40, 40, 40]);
    expect(h.dividends).toEqual([{ day: D("2020-01-02"), amount: 1 }]);
    expect(h.splits).toEqual([{ day: D("2020-01-03"), ratio: 4 }]);
  });
});

// ---------------------------------------------------------------------------
// Real data. Independent anchors are published, pre-split closing prices:
//   AAPL 2020-08-28 close $499.23 (4:1 split effective 2020-08-31)
//   NVDA 2024-06-07 close $1,208.88 (10:1 split effective 2024-06-10)
//   C    2011-05-06 close $4.52 (1:10 reverse split effective 2011-05-09)
describe("real history: split handling", () => {
  it("AAPL is split-adjusted around the 2020 4:1 split", () => {
    const { s } = fixture("AAPL");
    const i = indexOnOrAfter(s.days, D("2020-08-28"));
    expect(isoFromDay(s.days[i])).toBe("2020-08-28");
    expect(s.price[i] * 4).toBeCloseTo(499.23, 1);
    // No phantom -75% "drop" across the split.
    expect(Math.abs(s.price[i + 1] / s.price[i] - 1)).toBeLessThan(0.1);
  });

  it("NVDA is split-adjusted around the 2024 10:1 split", () => {
    const { s } = fixture("NVDA");
    const i = indexOnOrAfter(s.days, D("2024-06-07"));
    expect(s.price[i] * 10).toBeCloseTo(1208.88, 1);
    expect(Math.abs(s.price[i + 1] / s.price[i] - 1)).toBeLessThan(0.1);
  });

  it("Citigroup reverse split (1:10, 2011) is handled", () => {
    const { s } = fixture("C");
    expect(s.history.splits.some((x) => x.day === D("2011-05-09") && Math.abs(x.ratio - 0.1) < 1e-9)).toBe(true);
    const i = indexOnOrAfter(s.days, D("2011-05-06"));
    // Pre-split $4.52 ×10 on today's basis.
    expect(s.price[i]).toBeCloseTo(45.2, 1);
    expect(Math.abs(s.price[i + 1] / s.price[i] - 1)).toBeLessThan(0.1);
  });
});

describe("real history: scenarios", () => {
  it("Apple, $1,000, 2015-10-09 (10Y): consistent with the price ratio", () => {
    const { s } = fixture("AAPL");
    const r = computeInvestment(s, 1000, D("2015-10-09"));
    expect(r.status).toBe("ok");
    expect(isoFromDay(r.startDay)).toBe("2015-10-09");
    expect(r.value).toBeCloseTo((1000 * r.valuationPrice) / r.purchasePrice, 8);
    // Apple compounded strongly over this decade; sanity band, not a magic number.
    expect(r.value).toBeGreaterThan(5000);
    expect(r.cagr!).toBeGreaterThan(0.15);
  });

  it("Nvidia 10Y price return is enormous but finite", () => {
    const { s } = fixture("NVDA");
    const r = computeInvestment(s, 1000, D("2016-10-07"));
    expect(r.value).toBeGreaterThan(50_000);
    expect(Number.isFinite(r.value)).toBe(true);
  });

  it("SPY 20Y total return matches Yahoo's independent dividend adjustment", () => {
    const { s, adj } = fixture("SPY");
    const r = computeInvestment(s, 10_000, D("2006-10-09"), "total");
    const yahoo = (10_000 * adj.get(r.endDay)!) / adj.get(r.startDay)!;
    // Methodologies differ slightly (reinvest at ex-close vs prior-close factor).
    expect(Math.abs(r.value / yahoo - 1)).toBeLessThan(0.015);
    const price = computeInvestment(s, 10_000, D("2006-10-09"), "price");
    expect(r.value).toBeGreaterThan(price.value); // dividends add, never subtract
    expect(r.cagr!).toBeGreaterThan(0.06);
    expect(r.cagr!).toBeLessThan(0.15);
  });

  it("Coca-Cola (dividend payer) total return vs Yahoo adjclose over 30Y", () => {
    const { s, adj } = fixture("KO");
    const r = computeInvestment(s, 1000, D("1995-01-03"), "total");
    const yahoo = (1000 * adj.get(r.endDay)!) / adj.get(r.startDay)!;
    expect(Math.abs(r.value / yahoo - 1)).toBeLessThan(0.03);
    const price = computeInvestment(s, 1000, D("1995-01-03"), "price");
    expect(r.value / price.value).toBeGreaterThan(1.5); // dividends matter a lot for KO
  });

  it("weekend date rolls forward to Monday and is disclosed", () => {
    const { s } = fixture("AAPL");
    const r = computeInvestment(s, 1000, D("2015-10-10")); // Saturday
    expect(isoFromDay(r.startDay)).toBe("2015-10-12");
    expect(r.dateAdjusted).toBe(true);
  });

  it("market holiday rolls forward (Christmas 2020 → Dec 28)", () => {
    const { s } = fixture("SPY");
    const r = computeInvestment(s, 1000, D("2020-12-25"));
    expect(isoFromDay(r.startDay)).toBe("2020-12-28");
  });

  it("recent IPO: dates before listing are rejected, not shifted", () => {
    const { s } = fixture("ARM");
    expect(isoFromDay(s.days[0])).toBe("2023-09-14");
    const before = computeInvestment(s, 1000, D("2020-01-01"));
    expect(before.status).toBe("before-listing");
    expect(before.value).toBe(0);
    const first = computeInvestment(s, 1000, D("2023-09-14"));
    expect(first.status).toBe("ok");
    expect(first.purchasePrice).toBeCloseTo(63.59, 2);
  });

  it("negative-return scenario (Peloton, Jan 2021)", () => {
    const { s } = fixture("PTON");
    const r = computeInvestment(s, 1000, D("2021-01-14"));
    expect(r.gain).toBeLessThan(0);
    expect(r.totalReturn).toBeLessThan(-0.5);
    expect(r.cagr!).toBeLessThan(0);
  });

  it("multi-stock comparison uses identical dates and marks pre-IPO as unavailable", () => {
    const start = D("2015-10-09");
    const results = ["AAPL", "MSFT", "SPY", "ARM"].map((sym) => ({ sym, r: computeInvestment(fixture(sym).s, 10_000, start) }));
    const ok = results.filter((x) => x.r.status === "ok");
    expect(new Set(ok.map((x) => x.r.startDay)).size).toBe(1);
    expect(results.find((x) => x.sym === "ARM")!.r.status).toBe("before-listing");
  });

  it("period returns: never report a partial history as a longer period", () => {
    const { s } = fixture("ARM");
    const pr = periodReturns(s, ["1Y", "5Y", "MAX"]);
    expect(pr[0].priceReturn).not.toBeNull();
    expect(pr[1].priceReturn).toBeNull();
    expect(pr[2].priceReturn).not.toBeNull();
  });
});
