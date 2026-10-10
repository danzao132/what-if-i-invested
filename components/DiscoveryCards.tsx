import Link from "next/link";
import { isoFromDay } from "@/lib/engine/dates";
import type { ComputedScenario, StockSummary } from "@/lib/discovery";
import { fmtDay, money, multiple, pct, price } from "@/lib/format";
import { TickerLogo } from "./ui/Logo";

export function Sparkline({ values, up, width = 96, height = 32 }: { values: number[]; up: boolean; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4)).toFixed(1)}`)
    .join("");
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={up ? "var(--gain)" : "var(--loss)"} strokeWidth={1.75} strokeLinejoin="round" />
    </svg>
  );
}

export function StockCard({ s }: { s: StockSummary }) {
  const r = s.tenYear;
  const up = r.value >= r.amount;
  const label = r.years >= 9.9 ? "10 years ago" : `on ${fmtDay(r.startDay)}`;
  return (
    <Link
      href={`/stock/${encodeURIComponent(s.symbol)}`}
      className="card group flex flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-center gap-3">
        <TickerLogo symbol={s.symbol} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{s.name.replace(/\s\(.*\)$/, "")}</div>
          <div className="text-xs text-ink-3 tnum">
            {s.symbol} · {price(s.lastClose)}{" "}
            <span className={s.dayChange >= 0 ? "text-gain" : "text-loss"}>{pct(s.dayChange)}</span>
          </div>
        </div>
        <Sparkline values={s.spark} up={s.spark.at(-1)! >= s.spark[0]} width={64} height={26} />
      </div>
      <div className="rounded-xl bg-surface-2 px-3 py-2.5">
        <div className="text-[11px] text-ink-3">$1,000 {label} →</div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl font-bold tnum">{money(r.value)}</span>
          <span className={`text-xs font-semibold tnum ${up ? "text-gain" : "text-loss"}`}>{pct(r.totalReturn)}</span>
        </div>
      </div>
    </Link>
  );
}

export function ScenarioCard({ sc, tone = "auto" }: { sc: ComputedScenario; tone?: "auto" | "muted" }) {
  const r = sc.result;
  const up = r.value >= r.amount;
  const href = `/time-machine?symbol=${encodeURIComponent(sc.symbol)}&amount=${sc.amount}&date=${isoFromDay(r.requestedDay)}`;
  return (
    <Link href={href} className="card group flex flex-col justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:border-line-strong">
      <div>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <TickerLogo symbol={sc.symbol} size={22} />
          <span className="font-semibold text-ink-2">{sc.symbol}</span> · {fmtDay(r.startDay)}
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{sc.title}</h3>
        <p className="mt-1 text-sm text-ink-2">{sc.context}</p>
      </div>
      <div>
        <div className="text-xs text-ink-3">{money(sc.amount)} then is worth</div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-display text-2xl font-bold tnum ${tone === "muted" ? "text-ink" : ""}`}>{money(r.value)}</span>
          <span className={`text-sm font-semibold tnum ${up ? "text-gain" : "text-loss"}`}>
            {up && r.value / r.amount >= 2 ? multiple(r.value / r.amount) : pct(r.totalReturn)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-ink-3">
          Price return, {r.durationLabel} · first-day close used{r.dateAdjusted ? " (next trading day)" : ""}
        </div>
      </div>
    </Link>
  );
}
