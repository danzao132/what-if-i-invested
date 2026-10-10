"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeInvestment, periodStartDay, type PeriodKey } from "@/lib/engine/calc";
import { dayFromISO, isoFromDay } from "@/lib/engine/dates";
import { indexOnOrAfter } from "@/lib/engine/series";
import { useQuote, useSeries } from "@/lib/client/data";
import { universeEntry } from "@/lib/data/universe";
import { fmtDay, fmtDayLong, money, multiple, pct, price } from "@/lib/format";
import { scenarioQuery } from "@/lib/scenario";
import type { DayNumber, ReturnMode, SearchResult } from "@/lib/types";
import { ShareResult } from "../ShareResult";
import { StockSearch } from "../StockSearch";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { TickerLogo } from "../ui/Logo";
import { InvestmentValueChart } from "./InvestmentValueChart";
import { TimelineStage } from "./TimelineStage";

const AMOUNTS = [100, 1000, 5000, 10000, 100000];
const PERIODS: PeriodKey[] = ["1M", "6M", "1Y", "5Y", "10Y", "20Y", "MAX"];

export interface TimeMachineProps {
  initialSymbol: string;
  initialAmount?: number;
  initialDay?: DayNumber | null;
  initialMode?: ReturnMode;
  /** "in-place": the stock picker swaps the stock. "navigate": goes to /stock/X. */
  symbolBehavior?: "in-place" | "navigate";
  /** Keep the URL query in sync so the address bar is always shareable. */
  syncUrl?: boolean;
  /** Omit `symbol` from the synced query (stock pages carry it in the path). */
  symbolInPath?: boolean;
  showGrowthChart?: boolean;
  headline?: boolean;
}

export function TimeMachine({
  initialSymbol,
  initialAmount = 1000,
  initialDay = null,
  initialMode = "price",
  symbolBehavior = "in-place",
  syncUrl = false,
  symbolInPath = false,
  showGrowthChart = true,
  headline = true,
}: TimeMachineProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [amount, setAmount] = useState(initialAmount);
  const [amountText, setAmountText] = useState(fmtAmount(initialAmount));
  const [requestedDay, setRequestedDay] = useState<DayNumber | null>(initialDay);
  const [mode, setMode] = useState<ReturnMode>(initialMode);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [logPref, setLogPref] = useState<boolean | null>(null);

  const { data: series, error, loading } = useSeries(symbol);
  const quote = useQuote(symbol);
  const name = quote.data?.name ?? universeEntry(symbol)?.name ?? symbol;
  const shortName = name.replace(/,? (Inc\.?|Corporation|Corp\.?|Company|Co\.|plc|Holdings|Platforms|Group)( \(.*\))?$/i, "").replace(/^The /, "");

  // Default date = 10 years before the latest bar (or the listing date).
  const day: DayNumber | null = useMemo(() => {
    if (requestedDay != null) return requestedDay;
    if (!series) return null;
    return Math.max(series.days[0], periodStartDay(series, "10Y"));
  }, [requestedDay, series]);

  const result = useMemo(() => (series && day != null ? computeInvestment(series, amount, day, mode) : null), [series, amount, day, mode]);
  const sliderIndex = useMemo(() => {
    if (!series || day == null) return 0;
    if (result && (result.status === "ok" || result.status === "no-elapsed-time")) return Math.min(result.startIndex, series.days.length - 2);
    const i = indexOnOrAfter(series.days, day);
    return i < 0 ? series.days.length - 2 : Math.max(0, Math.min(i, series.days.length - 2));
  }, [series, day, result]);

  const autoLog = useMemo(() => {
    if (!series) return false;
    let lo = Infinity, hi = 0;
    for (let i = 0; i < series.price.length; i += 5) {
      const v = series.price[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi / lo > 40;
  }, [series]);
  const logScale = logPref ?? autoLog;

  // ---- URL sync (debounced, never during drag) -----------------------------
  useEffect(() => {
    if (!syncUrl || dragging || day == null) return;
    const t = setTimeout(() => {
      const q = scenarioQuery({ symbol, amount, day, mode }, !symbolInPath);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}`);
    }, 350);
    return () => clearTimeout(t);
  }, [syncUrl, symbolInPath, symbol, amount, day, mode, dragging]);

  const onChangeIndex = useCallback(
    (i: number) => {
      if (series) setRequestedDay(series.days[i]);
    },
    [series],
  );

  const commitAmount = (text: string) => {
    setAmountText(text);
    const n = Number(text.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n) && n > 0 && n <= 1e12) setAmount(n);
  };

  const pickSymbol = (r: SearchResult) => {
    setPickerOpen(false);
    if (symbolBehavior === "navigate") {
      window.location.href = `/stock/${encodeURIComponent(r.symbol)}?${scenarioQuery({ amount, day: day ?? undefined, mode }, false)}`;
      return;
    }
    setSymbol(r.symbol);
    setLogPref(null);
  };

  const activePeriod = useMemo(() => {
    if (!series || !result || result.status !== "ok") return null;
    return (
      PERIODS.find((p) => {
        const target = Math.max(series.days[0], periodStartDay(series, p));
        const i = indexOnOrAfter(series.days, target);
        return i === result.startIndex;
      }) ?? null
    );
  }, [series, result]);

  const ok = result && (result.status === "ok" || result.status === "no-elapsed-time");
  const up = ok ? result.value >= result.amount : true;
  const shareQuery = day != null ? scenarioQuery({ symbol, amount, day, mode }) : `symbol=${symbol}`;
  const amountInvalid = !(Number(amountText.replace(/[$,\s]/g, "")) > 0);

  return (
    <div className="space-y-5">
      <section className="card relative overflow-visible p-5 sm:p-8" aria-labelledby="tm-title">
        {/* Decorative time grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5rem] opacity-60"
          style={{
            background:
              "radial-gradient(120% 70% at 100% 0%, var(--accent-soft), transparent 55%), radial-gradient(80% 60% at 0% 100%, var(--past-soft), transparent 60%)",
          }}
        />
        <div className="relative">
          {headline && (
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-ink">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" /> The Time Machine
            </div>
          )}
          <h2 id="tm-title" className="font-display text-[1.6rem] font-semibold leading-[1.25] sm:text-[2.1rem]">
            If you had invested{" "}
            <span className="relative inline-flex items-baseline">
              <span className="sr-only">amount</span>
              <span className="text-accent-ink">$</span>
              <input
                aria-label="Investment amount in dollars"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => commitAmount(e.target.value)}
                onBlur={() => !amountInvalid && setAmountText(fmtAmount(amount))}
                className={`w-[5.5ch] min-w-0 border-b-2 bg-transparent font-display text-accent-ink outline-none tnum ${amountInvalid ? "border-loss" : "border-accent/60 focus:border-accent"}`}
                style={{ width: `${Math.max(3, amountText.length + 0.5)}ch` }}
              />
            </span>{" "}
            in{" "}
            <span className="relative inline-block">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                aria-expanded={pickerOpen}
                className="inline-flex items-center gap-2 border-b-2 border-past/60 text-past hover:border-past"
              >
                {shortName}
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {pickerOpen && (
                <div className="absolute left-0 top-full z-50 mt-3 w-[min(88vw,420px)] font-sans text-base font-normal">
                  <StockSearch autoFocus onSelect={pickSymbol} placeholder="Pick a stock or ETF…" />
                </div>
              )}
            </span>{" "}
            {result?.status === "before-listing" ? "back then" : "on"}{" "}
            <label className="relative inline-flex cursor-pointer items-baseline border-b-2 border-ink/20 hover:border-ink/50">
              <span className="tnum">{day != null ? fmtDay(ok ? result.startDay : day) : <span className="text-ink-3">a date</span>}</span>
              <input
                type="date"
                aria-label="Investment date"
                className="absolute inset-0 cursor-pointer opacity-0"
                min={series ? isoFromDay(series.days[0]) : undefined}
                max={series ? isoFromDay(series.days[series.days.length - 2]) : undefined}
                value={day != null ? isoFromDay(day) : ""}
                onChange={(e) => {
                  const d = dayFromISO(e.target.value);
                  if (Number.isFinite(d)) setRequestedDay(d);
                }}
              />
            </label>
            …
          </h2>

          {/* Quick amounts */}
          <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Quick amounts">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" className="chip shrink-0" aria-pressed={amount === a} onClick={() => commitAmount(fmtAmount(a))}>
                {a >= 1000 ? `$${a / 1000}K` : `$${a}`}
              </button>
            ))}
          </div>

          {/* ---- RESULT ---- */}
          <div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-end" aria-live={dragging ? "off" : "polite"}>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-2">Today you&apos;d have</div>
              {loading && !series ? (
                <div className="skeleton mt-2 h-16 w-64" />
              ) : ok ? (
                <div className={`font-display text-[3.2rem] font-bold leading-none sm:text-[4.75rem] tnum ${up ? "text-ink" : "text-ink"}`}>
                  <AnimatedNumber value={result.value} format={(v) => money(v, { cents: v < 100 })} />
                </div>
              ) : (
                <div className="font-display text-[3.2rem] font-bold leading-none text-ink-3 sm:text-[4.75rem]">—</div>
              )}
              {ok && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
                  <span className={`rounded-full px-3 py-1 font-semibold tnum ${up ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}>
                    <AnimatedNumber value={result.gain} format={(v) => money(v, { sign: true })} /> ·{" "}
                    <AnimatedNumber value={result.totalReturn} format={(v) => pct(v)} />
                  </span>
                  {result.value / result.amount >= 2 && (
                    <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-ink tnum">{multiple(result.value / result.amount)} your money</span>
                  )}
                  {!up && <span className="text-sm text-ink-2">Not every trip through time ends well.</span>}
                </div>
              )}
            </div>
            {ok && (
              <dl className="grid grid-cols-3 gap-2 text-sm sm:gap-3">
                <Stat label="Per year (CAGR)" value={result.cagr != null ? pct(result.cagr) : "n/a"} hint={result.cagr == null ? "Shown for 1+ years" : undefined} />
                <Stat label="Time invested" value={result.durationLabel} />
                <Stat label="Shares bought" value={result.shares >= 100 ? result.shares.toFixed(1) : result.shares.toFixed(result.shares < 1 ? 4 : 2)} />
              </dl>
            )}
          </div>

          {/* ---- STATUS MESSAGES ---- */}
          {error && (
            <div className="mt-6 rounded-2xl bg-loss-soft p-4 text-sm text-ink">
              {error} <button className="ml-1 font-semibold underline" onClick={() => pickSymbol({ symbol: "AAPL", name: "Apple", exchange: "", type: "EQUITY" })}>Try Apple instead</button>
            </div>
          )}
          {result?.status === "before-listing" && series && (
            <div className="mt-6 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-ink">
              <b>{shortName}</b> wasn&apos;t trading yet on {fmtDayLong(result.requestedDay)} — so there was nothing to buy. Our earliest price for{" "}
              {symbol} is from {fmtDayLong(series.days[0])}.{" "}
              <button className="font-semibold text-accent-ink underline" onClick={() => setRequestedDay(series.days[0])}>
                Travel to the first trading day
              </button>
            </div>
          )}

          {/* ---- STAGE: chart + slider ---- */}
          <div className="-mx-2 mt-6 sm:mx-0">
            {series ? (
              <TimelineStage
                series={series}
                startIndex={sliderIndex}
                amount={amount}
                value={ok ? result.value : amount}
                onChangeIndex={onChangeIndex}
                onDragState={setDragging}
                logScale={logScale}
                companyLabel={name}
                mode={result?.effectiveMode ?? "price"}
              />
            ) : (
              <div className="skeleton h-[300px] w-full" />
            )}
          </div>

          {/* ---- PERIODS & OPTIONS ---- */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Investment period">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip shrink-0 px-3"
                  aria-pressed={activePeriod === p}
                  disabled={!series}
                  onClick={() => series && setRequestedDay(Math.max(series.days[0], periodStartDay(series, p)))}
                >
                  {p}
                </button>
              ))}
              <label className="chip relative shrink-0 cursor-pointer px-3" aria-pressed={activePeriod == null && !!ok}>
                Custom
                <input
                  type="date"
                  aria-label="Custom investment date"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  min={series ? isoFromDay(series.days[0]) : undefined}
                  max={series ? isoFromDay(series.days[series.days.length - 2]) : undefined}
                  value={day != null ? isoFromDay(day) : ""}
                  onChange={(e) => {
                    const d = dayFromISO(e.target.value);
                    if (Number.isFinite(d)) setRequestedDay(d);
                  }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-line bg-surface p-1 text-sm" role="radiogroup" aria-label="Return method">
                {(["price", "total"] as const).map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={mode === m}
                    disabled={m === "total" && !!series && !series.tr}
                    onClick={() => setMode(m)}
                    className={`rounded-full px-3 py-1.5 font-medium transition ${mode === m ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
                    title={m === "total" ? "Dividends reinvested on the ex-dividend date" : "Share price change only"}
                  >
                    {m === "price" ? "Price" : "+ Dividends"}
                  </button>
                ))}
              </div>
              <button type="button" className="chip px-3" aria-pressed={logScale} onClick={() => setLogPref(!logScale)} title="Logarithmic scale shows % moves evenly across decades">
                Log
              </button>
            </div>
          </div>

          {/* ---- RECEIPT ---- */}
          {ok && series && (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 text-sm lg:grid-cols-4">
              <Receipt label="Original investment" value={money(result.amount, { cents: result.amount % 1 !== 0 })} />
              <Receipt label="Bought on" value={fmtDay(result.startDay)} note={result.dateAdjusted ? `${fmtDay(result.requestedDay)} was a weekend/holiday — next trading day's close used` : "at that day's close"} />
              <Receipt label="Purchase price" value={price(result.purchasePrice)} note="split-adjusted close" />
              <Receipt label="Latest price" value={price(result.valuationPrice)} note={`close of ${fmtDay(result.endDay)}`} />
              <Receipt label="Current value" value={money(result.value, { cents: true })} />
              <Receipt label="Profit / loss" value={money(result.gain, { sign: true, cents: true })} tone={up ? "gain" : "loss"} />
              <Receipt label="Total return" value={pct(result.totalReturn)} tone={up ? "gain" : "loss"} note={result.effectiveMode === "total" ? "dividends reinvested" : "price only"} />
              <Receipt label="Annualized (CAGR)" value={result.cagr != null ? pct(result.cagr) : "n/a"} note={result.cagr == null ? "needs 1+ year" : `over ${result.years.toFixed(1)} years`} />
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-relaxed text-ink-3">
              Hypothetical lump-sum purchase of fractional shares at the closing price. Excludes taxes, fees and inflation.
              {mode === "total" ? " Dividends reinvested on ex-dividend dates." : " Dividends not included."} Past performance doesn&apos;t predict future
              results. {series?.history.source.kind === "demo" && <b className="text-accent-ink">Demo data snapshot ({series.history.source.fetchedAt.slice(0, 10)}).</b>}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {symbolBehavior === "in-place" && (
                <Link href={`/stock/${encodeURIComponent(symbol)}`} className="btn btn-ghost">
                  <TickerLogo symbol={symbol} size={20} /> {symbol} details
                </Link>
              )}
              {ok && (
                <ShareResult
                  path={`/time-machine?${shareQuery}`}
                  imagePath={`/api/og?${shareQuery}`}
                  filename={`what-if-${symbol}-${isoFromDay(result.startDay)}.png`}
                  text={`If I'd invested ${money(amount)} in ${shortName} on ${fmtDay(result.startDay)}, I'd have ${money(result.value)} today (${pct(result.totalReturn)}).`}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {showGrowthChart && series && ok && result.status === "ok" && (
        <InvestmentValueChart series={series} symbol={symbol} name={shortName} amount={amount} startIndex={result.startIndex} mode={result.effectiveMode} />
      )}
    </div>
  );
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-2.5 backdrop-blur sm:p-3">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-3 sm:text-[11px]">{label}</dt>
      <dd className="mt-1 font-display text-base font-semibold leading-tight tnum sm:text-xl">{value}</dd>
      {hint && <dd className="text-[11px] text-ink-3">{hint}</dd>}
    </div>
  );
}

function Receipt({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className={`font-semibold tnum ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink"}`}>{value}</div>
      {note && <div className="text-[11px] leading-snug text-ink-3">{note}</div>}
    </div>
  );
}
