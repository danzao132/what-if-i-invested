"use client";

import { useEffect, useMemo, useState } from "react";
import { computeInvestment } from "@/lib/engine/calc";
import { dayFromISO, isoFromDay } from "@/lib/engine/dates";
import { useQuote, useSeries } from "@/lib/client/data";
import { universeEntry } from "@/lib/data/universe";
import { fmtDay, fmtDayLong, money, multiple, pct, price } from "@/lib/format";
import { REGRET_PRESETS, type RegretPreset } from "@/lib/regret-presets";
import type { ReturnMode } from "@/lib/types";
import { ShareResult } from "../ShareResult";
import { StockSearch } from "../StockSearch";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { TickerLogo } from "../ui/Logo";

export interface RegretState {
  presetId: string;
  item: string;
  amount: number;
  date: string;
  symbol: string;
}

function quip(mult: number, item: string) {
  if (mult >= 20) return `That's ${multiple(mult)} the price. Your past self deserves a very long hug.`;
  if (mult >= 5) return `Enough to buy ${Math.floor(mult)} of them at the original price. Not that you'd want to.`;
  if (mult >= 2) return `Your money would have more than doubled. Still — hopefully ${item.toLowerCase()} was worth it.`;
  if (mult >= 1.1) return "A modest gain. Honestly? Enjoying it was probably the better deal.";
  if (mult >= 0.95) return "Roughly break-even. Zero regrets required.";
  return "Plot twist: buying it was the better financial move. Enjoy it guilt-free.";
}

export function RegretCalculator({ initial }: { initial: RegretState }) {
  const [state, setState] = useState(initial);
  const [amountText, setAmountText] = useState(initial.amount.toLocaleString("en-US"));
  const [mode, setMode] = useState<ReturnMode>("price");
  const [picking, setPicking] = useState(false);
  const preset = REGRET_PRESETS.find((p) => p.id === state.presetId) ?? REGRET_PRESETS.at(-1)!;
  const { data: series, error, loading } = useSeries(state.symbol);
  const quote = useQuote(state.symbol);
  const name = (quote.data?.name ?? universeEntry(state.symbol)?.name ?? state.symbol).replace(/\s\(.*\)$/, "");

  const day = dayFromISO(state.date);
  const r = useMemo(() => (series ? computeInvestment(series, state.amount, day, mode) : null), [series, state.amount, day, mode]);
  const ok = r?.status === "ok";

  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams({ p: state.presetId, item: state.item, amount: String(state.amount), date: state.date, symbol: state.symbol });
      window.history.replaceState(window.history.state, "", `/regret?${q}`);
    }, 300);
    return () => clearTimeout(t);
  }, [state]);

  const applyPreset = (p: RegretPreset) => {
    setState({ presetId: p.id, item: p.item, amount: p.amount, date: p.date, symbol: p.symbol });
    setAmountText(p.amount.toLocaleString("en-US"));
  };

  const shareQuery = new URLSearchParams({ p: state.presetId, item: state.item, amount: String(state.amount), date: state.date, symbol: state.symbol }).toString();
  const mult = ok ? r!.value / r!.amount : 1;

  return (
    <div className="space-y-6">
      {/* Category picker */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Purchase category">
        {REGRET_PRESETS.map((p) => (
          <button key={p.id} type="button" className="chip shrink-0" aria-pressed={state.presetId === p.id} onClick={() => applyPreset(p)}>
            <span aria-hidden>{p.emoji}</span> {p.category}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="What did you buy?">
          <input
            value={state.item}
            maxLength={60}
            onChange={(e) => setState({ ...state, item: e.target.value || "Something I bought" })}
            className="w-full bg-transparent text-base font-medium outline-none"
          />
        </Field>
        <Field label="How much did it cost?" hint={preset.priceBasis === "launch" && state.amount === preset.amount ? "US launch price" : "Estimate — edit to your real price"}>
          <div className="flex items-center gap-1">
            <span className="text-ink-3">$</span>
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                const n = Number(e.target.value.replace(/[$,\s]/g, ""));
                if (n > 0 && n <= 1e10) setState({ ...state, amount: n });
              }}
              className="w-full bg-transparent text-base font-medium outline-none tnum"
            />
          </div>
        </Field>
        <Field label="When?">
          <input
            type="date"
            value={state.date}
            max={series ? isoFromDay(series.days[series.days.length - 2]) : undefined}
            onChange={(e) => Number.isFinite(dayFromISO(e.target.value)) && setState({ ...state, date: e.target.value })}
            className="w-full bg-transparent text-base font-medium outline-none"
          />
        </Field>
        <Field label="Instead, invest in…">
          <div className="relative">
            <button type="button" className="flex w-full items-center gap-2 text-left text-base font-medium" onClick={() => setPicking((x) => !x)} aria-expanded={picking}>
              <TickerLogo symbol={state.symbol} size={22} />
              <span className="truncate">{name}</span>
              <span className="text-ink-3">({state.symbol})</span>
            </button>
            {picking && (
              <div className="absolute left-0 top-full z-50 mt-3 w-[min(86vw,380px)]">
                <StockSearch autoFocus onSelect={(s) => { setState({ ...state, symbol: s.symbol }); setPicking(false); }} placeholder="Pick a stock or ETF…" />
              </div>
            )}
          </div>
        </Field>
      </div>
      {preset.note && <p className="-mt-3 text-xs text-ink-3">{preset.note}</p>}

      {/* Panels */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card relative overflow-hidden p-6 sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-ink-3">What you bought</div>
          <div className="mt-4 text-6xl" aria-hidden>{preset.emoji}</div>
          <div className="mt-3 font-display text-2xl font-semibold">{state.item}</div>
          <div className="mt-2 font-display text-5xl font-bold tnum">{money(state.amount, { cents: state.amount % 1 !== 0 })}</div>
          <div className="mt-2 text-sm text-ink-2">{Number.isFinite(day) ? fmtDayLong(day) : "—"}</div>
          <div className="mt-4 inline-flex rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-2">
            {preset.priceBasis === "launch" && state.amount === preset.amount ? "Price: US launch price (MSRP)" : "Price: estimate"}
          </div>
        </div>
        <div className="card relative overflow-hidden border-accent/50 p-6 sm:p-8" style={{ background: "linear-gradient(160deg, var(--accent-soft), var(--surface) 60%)" }}>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">What your money could have become</div>
          <div className="mt-4 flex items-center gap-3">
            <TickerLogo symbol={state.symbol} size={52} />
            <div>
              <div className="font-display text-xl font-semibold">{name}</div>
              <div className="text-sm text-ink-3">{state.symbol}</div>
            </div>
          </div>
          {loading && !series ? (
            <div className="skeleton mt-5 h-14 w-56" />
          ) : ok ? (
            <>
              <div className="mt-4 font-display text-5xl font-bold tnum sm:text-6xl">
                <AnimatedNumber value={r!.value} format={(v) => money(v)} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className={`rounded-full px-3 py-1 font-semibold tnum ${r!.gain >= 0 ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}>
                  {money(r!.gain, { sign: true })} · {pct(r!.totalReturn)}
                </span>
                {r!.cagr != null && <span className="rounded-full bg-surface-2 px-3 py-1 tnum text-ink-2">{pct(r!.cagr)}/yr</span>}
              </div>
              <p className="mt-4 text-[15px] text-ink">{quip(mult, state.item)}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-ink-3">Invested</dt><dd className="font-semibold tnum">{money(r!.amount)} on {fmtDay(r!.startDay)}</dd></div>
                <div><dt className="text-xs text-ink-3">Share price then → now</dt><dd className="font-semibold tnum">{price(r!.purchasePrice)} → {price(r!.valuationPrice)}</dd></div>
              </dl>
              {r!.dateAdjusted && <p className="mt-2 text-xs text-ink-3">{fmtDay(r!.requestedDay)} wasn&apos;t a trading day, so we used the next session&apos;s close.</p>}
            </>
          ) : r?.status === "before-listing" ? (
            <p className="mt-5 text-ink-2">{name} wasn&apos;t publicly traded yet on that date (earliest data: {fmtDay(r.firstAvailableDay)}). Pick a later date or another stock.</p>
          ) : error ? (
            <p className="mt-5 text-ink-2">{error}</p>
          ) : (
            <p className="mt-5 text-ink-2">Pick a date before today.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs text-ink-3">
          A light-hearted thought experiment, not financial guilt. Hypothetical lump-sum investment at the closing price, {mode === "total" ? "dividends reinvested" : "price return only"}; excludes taxes, fees and inflation. Preset prices are labelled as launch prices or estimates.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-surface p-1 text-sm" role="radiogroup" aria-label="Return method">
            {(["price", "total"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 font-medium ${mode === m ? "bg-ink text-bg" : "text-ink-2"}`}>
                {m === "price" ? "Price" : "+ Dividends"}
              </button>
            ))}
          </div>
          {ok && (
            <ShareResult
              path={`/regret?${shareQuery}`}
              imagePath={`/api/og?type=regret&${shareQuery}`}
              filename={`regret-${state.symbol}-${state.date}.png`}
              text={`${state.item} cost ${money(state.amount)} in ${new Date(state.date).getUTCFullYear()}. In ${state.symbol} stock it'd be ${money(r!.value)} today.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl border border-line bg-surface-2/60 px-4 py-3 focus-within:border-accent">
      <span className="block text-xs font-medium text-ink-3">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}
