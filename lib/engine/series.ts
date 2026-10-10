import type { DayNumber, PriceHistory, ReturnMode } from "../types";

/**
 * A history prepared for O(1) hypothetical-investment lookups.
 *
 * `price[i]` — split-adjusted close.
 * `tr[i]`    — total-return index with dividends reinvested at the ex-date
 *              close: tr[i] = tr[i-1] * (close[i] + div[i]) / close[i-1].
 *              Because both series share one adjustment basis, the value of
 *              an investment bought at i and valued at j is simply
 *              amount * S[j] / S[i] for S in {price, tr}.
 */
export interface PreparedSeries {
  history: PriceHistory;
  days: DayNumber[];
  price: Float64Array;
  tr: Float64Array | null;
  /** Dividend paid on each bar's ex-date (0 when none). */
  divOnDay: Float64Array;
}

export function prepareSeries(history: PriceHistory): PreparedSeries {
  const n = history.days.length;
  const price = Float64Array.from(history.close);
  const divOnDay = new Float64Array(n);

  // Attach each dividend to its ex-date bar (or the next bar if the ex-date
  // isn't a trading day in our data). Unmatched dividends are dropped rather
  // than double-counted.
  const divs = [...history.dividends].sort((a, b) => a.day - b.day);
  let k = 0;
  for (const d of divs) {
    while (k < n && history.days[k] < d.day) k++;
    if (k >= n) break;
    if (k === 0) continue; // ex-date before our first bar: nothing to reinvest
    divOnDay[k] += d.amount;
  }

  let tr: Float64Array | null = null;
  if (history.dividendsReliable) {
    tr = new Float64Array(n);
    tr[0] = 1;
    for (let i = 1; i < n; i++) {
      tr[i] = tr[i - 1] * ((price[i] + divOnDay[i]) / price[i - 1]);
    }
  }

  return { history, days: history.days, price, tr, divOnDay };
}

export function seriesFor(p: PreparedSeries, mode: ReturnMode): Float64Array {
  if (mode === "total" && p.tr) return p.tr;
  return p.price;
}

/** First index whose day is >= `day`, or -1 if `day` is after the last bar. */
export function indexOnOrAfter(days: ArrayLike<number>, day: DayNumber): number {
  let lo = 0;
  let hi = days.length - 1;
  if (hi < 0 || day > days[hi]) return -1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (days[mid] < day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Last index whose day is <= `day`, or -1 if `day` precedes the first bar. */
export function indexOnOrBefore(days: ArrayLike<number>, day: DayNumber): number {
  let lo = 0;
  let hi = days.length - 1;
  if (hi < 0 || day < days[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (days[mid] > day) hi = mid - 1;
    else lo = mid;
  }
  return lo;
}

/**
 * Evenly downsample index range [from, to] to at most `max` points, always
 * keeping both endpoints. Returns bar indices.
 */
export function sampleIndices(from: number, to: number, max: number): number[] {
  const count = to - from + 1;
  if (count <= max) return Array.from({ length: count }, (_, i) => from + i);
  const out: number[] = [];
  const step = (count - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(from + Math.round(i * step));
  return out;
}
