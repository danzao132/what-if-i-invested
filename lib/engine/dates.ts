import type { DayNumber } from "../types";

const MS_PER_DAY = 86_400_000;
/** Mean Gregorian year — used for CAGR so leap years are handled honestly. */
export const DAYS_PER_YEAR = 365.2425;

export function dayFromISO(iso: string): DayNumber {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  // Reject impossible dates like 2023-02-30 instead of silently rolling over.
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return NaN;
  return Math.round(t / MS_PER_DAY);
}

export function isoFromDay(day: DayNumber): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function dateFromDay(day: DayNumber): Date {
  return new Date(day * MS_PER_DAY);
}

export function yearOfDay(day: DayNumber): number {
  return new Date(day * MS_PER_DAY).getUTCFullYear();
}

/** Today's calendar day in New York (US market time zone). */
export function todayInNewYork(now: Date = new Date()): DayNumber {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return dayFromISO(parts);
}

/** Shift a day by calendar months, clamping to month end (Mar 31 − 1M = Feb 28/29). */
export function addMonths(day: DayNumber, months: number): DayNumber {
  const d = dateFromDay(day);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return Math.round(target.getTime() / MS_PER_DAY);
}

export function addYears(day: DayNumber, years: number): DayNumber {
  return addMonths(day, years * 12);
}

export function startOfYear(day: DayNumber): DayNumber {
  return Math.round(Date.UTC(yearOfDay(day), 0, 1) / MS_PER_DAY);
}

/** Converts a Unix timestamp to the exchange-local calendar day. */
export function dayFromUnix(seconds: number, gmtOffsetSeconds = 0): DayNumber {
  return Math.floor((seconds + gmtOffsetSeconds) / 86_400);
}

export function yearsBetween(a: DayNumber, b: DayNumber): number {
  return (b - a) / DAYS_PER_YEAR;
}

export function describeDuration(fromDay: DayNumber, toDay: DayNumber): string {
  const days = toDay - fromDay;
  if (days < 1) return "less than a day";
  if (days < 45) return `${days} day${days === 1 ? "" : "s"}`;
  // Within a few days of a whole number of years (e.g. a 10Y lookback that
  // starts on the Monday after a weekend), say "10 years", not "9 yrs, 11 mo".
  const exactYears = days / DAYS_PER_YEAR;
  if (exactYears >= 1 && Math.abs(exactYears - Math.round(exactYears)) * DAYS_PER_YEAR <= 4) {
    const y = Math.round(exactYears);
    return `${y} year${y === 1 ? "" : "s"}`;
  }
  const from = dateFromDay(fromDay);
  const to = dateFromDay(toDay);
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"}, ${rem} mo`;
}
