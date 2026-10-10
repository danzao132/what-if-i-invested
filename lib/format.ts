import { dateFromDay } from "./engine/dates";
import type { DayNumber } from "./types";

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(v: number, opts: { cents?: boolean; compact?: boolean; sign?: boolean } = {}): string {
  if (!Number.isFinite(v)) return "—";
  const sign = opts.sign ? (v > 0 ? "+" : v < 0 ? "−" : "") : v < 0 ? "−" : "";
  const a = Math.abs(v);
  let body: string;
  if (opts.compact && a >= 1e6) body = "$" + compactNumber(a);
  else if (opts.cents || a < 10) body = usd2.format(a);
  else body = usd0.format(a);
  return sign + body;
}

/** Share prices: 2 decimals normally, more for sub-dollar split-adjusted prices. */
export function price(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v < 1) return "$" + v.toPrecision(3);
  return usd2.format(v);
}

export function compactNumber(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [n, u] of units) if (a >= n) return (v / n).toFixed(a / n >= 100 ? 0 : a / n >= 10 ? 1 : 2) + u;
  return v.toFixed(0);
}

export function moneyCompact(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v < 0 ? "−$" : "$") + compactNumber(Math.abs(v));
}

/** Fraction → percent string. 0.1234 → "+12.34%". */
export function pct(v: number | null | undefined, opts: { sign?: boolean; digits?: number } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const p = v * 100;
  const a = Math.abs(p);
  const digits = opts.digits ?? (a >= 1000 ? 0 : a >= 100 ? 1 : 2);
  const s = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(a) + "%";
  const sign = opts.sign !== false ? (p > 0 ? "+" : p < 0 ? "−" : "") : p < 0 ? "−" : "";
  return sign + s;
}

const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export const fmtDayLong = (d: DayNumber) => longDate.format(dateFromDay(d));
export const fmtDay = (d: DayNumber) => shortDate.format(dateFromDay(d));
export const fmtMonthYear = (d: DayNumber) => monthYear.format(dateFromDay(d));

export function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(d);
}

export function multiple(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 100) return Math.round(v).toLocaleString("en-US") + "×";
  if (v >= 10) return v.toFixed(1) + "×";
  return v.toFixed(2) + "×";
}
