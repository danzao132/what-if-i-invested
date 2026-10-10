import type { DayNumber, ReturnMode } from "../types";
import { addMonths, addYears, DAYS_PER_YEAR, describeDuration, startOfYear } from "./dates";
import { indexOnOrAfter, sampleIndices, seriesFor, type PreparedSeries } from "./series";

export type InvestmentStatus =
  | "ok"
  | "before-listing" // requested date precedes the first available bar
  | "after-latest" // requested date is after the last bar
  | "no-elapsed-time" // effective start is the valuation bar itself
  | "invalid-amount"
  | "invalid-date"
  | "no-data";

export interface InvestmentResult {
  status: InvestmentStatus;
  mode: ReturnMode;
  /** Mode actually used (total falls back to price when dividends are unreliable). */
  effectiveMode: ReturnMode;
  amount: number;
  requestedDay: DayNumber;
  /** Trading day actually used for the purchase (next session if requested day was closed). */
  startDay: DayNumber;
  endDay: DayNumber;
  startIndex: number;
  endIndex: number;
  /** Split-adjusted closing price paid. */
  purchasePrice: number;
  /** Split-adjusted closing price at valuation. */
  valuationPrice: number;
  /** Fractional shares bought, on today's split-adjusted share basis. */
  shares: number;
  /** Shares held at the end including reinvested dividends (total mode). */
  sharesAtEnd: number;
  value: number;
  gain: number;
  /** Total return as a fraction (0.25 = +25%). */
  totalReturn: number;
  /** Annualised return as a fraction; null when held < 1 year would be misleading. */
  cagr: number | null;
  years: number;
  durationLabel: string;
  dateAdjusted: boolean;
  firstAvailableDay: DayNumber;
}

const empty = (partial: Partial<InvestmentResult>): InvestmentResult => ({
  status: "no-data",
  mode: "price",
  effectiveMode: "price",
  amount: 0,
  requestedDay: 0,
  startDay: 0,
  endDay: 0,
  startIndex: -1,
  endIndex: -1,
  purchasePrice: 0,
  valuationPrice: 0,
  shares: 0,
  sharesAtEnd: 0,
  value: 0,
  gain: 0,
  totalReturn: 0,
  cagr: null,
  years: 0,
  durationLabel: "",
  dateAdjusted: false,
  firstAvailableDay: 0,
  ...partial,
});

/**
 * Hypothetical lump-sum investment, fractional shares, no fees/taxes/inflation.
 *   value = amount × S[end] / S[start]
 *   CAGR  = (value / amount)^(1 / years) − 1, years = elapsed days / 365.2425
 */
export function computeInvestment(
  s: PreparedSeries,
  amount: number,
  requestedDay: DayNumber,
  mode: ReturnMode = "price",
  endIndex: number = s.days.length - 1,
): InvestmentResult {
  const n = s.days.length;
  const firstAvailableDay = n ? s.days[0] : 0;
  const base = { mode, amount, requestedDay, firstAvailableDay };
  if (!n) return empty({ ...base, status: "no-data" });
  if (!Number.isFinite(amount) || amount <= 0) return empty({ ...base, status: "invalid-amount" });
  if (!Number.isFinite(requestedDay)) return empty({ ...base, status: "invalid-date" });

  const effectiveMode: ReturnMode = mode === "total" && s.tr ? "total" : "price";
  const S = seriesFor(s, effectiveMode);

  if (requestedDay < s.days[0]) {
    return empty({ ...base, effectiveMode, status: "before-listing", endIndex, endDay: s.days[endIndex] });
  }
  const startIndex = indexOnOrAfter(s.days, requestedDay);
  if (startIndex === -1 || startIndex > endIndex) {
    return empty({ ...base, effectiveMode, status: "after-latest", endIndex, endDay: s.days[endIndex] });
  }

  const startDay = s.days[startIndex];
  const endDay = s.days[endIndex];
  const purchasePrice = s.price[startIndex];
  const valuationPrice = s.price[endIndex];
  const growth = S[endIndex] / S[startIndex];
  const value = amount * growth;
  const shares = amount / purchasePrice;
  const sharesAtEnd = value / valuationPrice;
  const totalReturn = growth - 1;
  const elapsedDays = endDay - startDay;
  const years = elapsedDays / DAYS_PER_YEAR;
  // Annualising sub-year holding periods produces absurd numbers (a 5% month
  // becomes "80%/yr"), so CAGR is only reported for >= 1 year.
  const cagr = years >= 1 ? Math.pow(growth, 1 / years) - 1 : null;

  return {
    status: startIndex === endIndex ? "no-elapsed-time" : "ok",
    mode,
    effectiveMode,
    amount,
    requestedDay,
    startDay,
    endDay,
    startIndex,
    endIndex,
    purchasePrice,
    valuationPrice,
    shares,
    sharesAtEnd,
    value,
    gain: value - amount,
    totalReturn,
    cagr,
    years,
    durationLabel: describeDuration(startDay, endDay),
    dateAdjusted: startDay !== requestedDay,
    firstAvailableDay,
  };
}

/**
 * Fast path used by the Time Machine while dragging: the slider already
 * speaks in bar indices, so no search is needed.
 */
export function computeAtIndex(s: PreparedSeries, amount: number, startIndex: number, mode: ReturnMode): InvestmentResult {
  return computeInvestment(s, amount, s.days[Math.max(0, Math.min(startIndex, s.days.length - 1))], mode);
}

export interface ValuePoint {
  day: DayNumber;
  value: number;
  index: number;
}

/** Investment value path from the purchase bar to the valuation bar, downsampled. */
export function valuePath(
  s: PreparedSeries,
  amount: number,
  startIndex: number,
  endIndex: number,
  mode: ReturnMode,
  maxPoints = 400,
): ValuePoint[] {
  if (startIndex < 0 || endIndex < startIndex) return [];
  const S = seriesFor(s, mode === "total" && s.tr ? "total" : "price");
  const base = S[startIndex];
  return sampleIndices(startIndex, endIndex, maxPoints).map((i) => ({
    day: s.days[i],
    value: (amount * S[i]) / base,
    index: i,
  }));
}

export type PeriodKey = "1M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "20Y" | "MAX";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "1M": "1 month",
  "6M": "6 months",
  YTD: "Year to date",
  "1Y": "1 year",
  "5Y": "5 years",
  "10Y": "10 years",
  "20Y": "20 years",
  MAX: "All available history",
};

/** Requested start day for a lookback period ending at the latest bar. */
export function periodStartDay(s: PreparedSeries, period: PeriodKey): DayNumber {
  const last = s.days[s.days.length - 1];
  switch (period) {
    case "1M":
      return addMonths(last, -1);
    case "6M":
      return addMonths(last, -6);
    case "YTD":
      // Measured from the last close of the prior year, the market convention.
      return startOfYear(last) - 1;
    case "1Y":
      return addYears(last, -1);
    case "5Y":
      return addYears(last, -5);
    case "10Y":
      return addYears(last, -10);
    case "20Y":
      return addYears(last, -20);
    case "MAX":
      return s.days[0];
  }
}

export interface PeriodReturn {
  period: PeriodKey;
  priceReturn: number | null;
  totalReturn: number | null;
  cagrPrice: number | null;
  startDay: DayNumber | null;
}

/**
 * Lookback returns. For YTD we anchor on the last bar ON OR BEFORE Dec 31 of
 * the prior year; for other periods, the first bar on/after the target date.
 * Periods longer than the available history return nulls (never a partial
 * return labelled as a longer one).
 */
export function periodReturns(s: PreparedSeries, periods: PeriodKey[]): PeriodReturn[] {
  const endIndex = s.days.length - 1;
  return periods.map((period) => {
    const target = periodStartDay(s, period);
    let startIndex: number;
    if (period === "YTD") {
      startIndex = -1;
      for (let i = endIndex; i >= 0; i--) if (s.days[i] <= target) { startIndex = i; break; }
    } else if (target < s.days[0]) {
      startIndex = -1;
    } else {
      startIndex = indexOnOrAfter(s.days, target);
    }
    if (startIndex < 0 || startIndex >= endIndex) {
      return { period, priceReturn: null, totalReturn: null, cagrPrice: null, startDay: null };
    }
    const pr = s.price[endIndex] / s.price[startIndex] - 1;
    const tr = s.tr ? s.tr[endIndex] / s.tr[startIndex] - 1 : null;
    const years = (s.days[endIndex] - s.days[startIndex]) / DAYS_PER_YEAR;
    return {
      period,
      priceReturn: pr,
      totalReturn: tr,
      cagrPrice: years >= 1 ? Math.pow(1 + pr, 1 / years) - 1 : null,
      startDay: s.days[startIndex],
    };
  });
}
