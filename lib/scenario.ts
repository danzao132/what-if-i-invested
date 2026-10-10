import { dayFromISO, isoFromDay } from "./engine/dates";
import type { DayNumber, ReturnMode } from "./types";
import { normalizeSymbol } from "./data/universe";

/** URL ↔ scenario. Shared links store inputs only; results are recomputed on open. */
export interface Scenario {
  symbol: string;
  amount: number;
  day: DayNumber | null;
  mode: ReturnMode;
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const get = (p: Params, k: string) => {
  if (p instanceof URLSearchParams) return p.get(k) ?? undefined;
  const v = p[k];
  return Array.isArray(v) ? v[0] : v;
};

export function parseAmount(raw: string | undefined | null, fallback = 1000): number {
  const n = Number(String(raw ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 1e12 ? n : fallback;
}

export function parseScenario(p: Params, defaults: Partial<Scenario> = {}): Scenario {
  const d = get(p, "date");
  const day = d ? dayFromISO(d) : NaN;
  return {
    symbol: normalizeSymbol(get(p, "symbol") ?? get(p, "s")) ?? defaults.symbol ?? "AAPL",
    amount: parseAmount(get(p, "amount"), defaults.amount ?? 1000),
    day: Number.isFinite(day) ? day : (defaults.day ?? null),
    mode: get(p, "mode") === "total" ? "total" : (defaults.mode ?? "price"),
  };
}

export function scenarioQuery(s: Partial<Scenario>, includeSymbol = true): string {
  const q = new URLSearchParams();
  if (includeSymbol && s.symbol) q.set("symbol", s.symbol);
  if (s.amount != null) q.set("amount", String(Math.round(s.amount * 100) / 100));
  if (s.day != null) q.set("date", isoFromDay(s.day));
  if (s.mode === "total") q.set("mode", "total");
  return q.toString();
}
