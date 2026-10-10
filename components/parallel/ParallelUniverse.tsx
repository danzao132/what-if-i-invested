"use client";

import { useEffect, useMemo, useState } from "react";
import { computeInvestment, valuePath, type InvestmentResult } from "@/lib/engine/calc";
import { addYears, dayFromISO, isoFromDay, todayInNewYork } from "@/lib/engine/dates";
import { indexOnOrBefore, type PreparedSeries } from "@/lib/engine/series";
import { useManyQuotes, useManySeries } from "@/lib/client/data";
import { universeEntry } from "@/lib/data/universe";
import { fmtDay, money, moneyCompact, pct } from "@/lib/format";
import type { ReturnMode } from "@/lib/types";
import { LineChart, type ChartSeries } from "../charts/LineChart";
import { ShareResult } from "../ShareResult";
import { StockSearch } from "../StockSearch";
import { TickerLogo } from "../ui/Logo";
import { MARKET_CAP_HINT } from "../ui/MarketCap";
import { PRESETS } from "@/lib/parallel-presets";


const COLORS = Array.from({ length: 10 }, (_, i) => `var(--chart-${i + 1})`);
const MAX = 10;

type SortKey = "value" | "symbol" | "gain" | "totalReturn" | "cagr";

interface Row {
  symbol: string;
  name: string;
  color: string;
  series?: PreparedSeries;
  error?: string;
  result?: InvestmentResult;
}

export interface ParallelInit {
  symbols: string[];
  amount: number;
  date: string | null;
  mode: ReturnMode;
}

export function ParallelUniverse({ initial }: { initial: ParallelInit }) {
  const [symbols, setSymbols] = useState<string[]>(initial.symbols);
  const [amount, setAmount] = useState(initial.amount);
  const [amountText, setAmountText] = useState(initial.amount.toLocaleString("en-US"));
  const [date, setDate] = useState<string>(initial.date ?? isoFromDay(addYears(todayInNewYork(), -10)));
  const [mode, setMode] = useState<ReturnMode>(initial.mode);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const loaded = useManySeries(symbols);
  const quotes = useManyQuotes(symbols);
  const capText = (sym: string) => {
    const q = quotes[sym];
    if (!q) return "…";
    if (q.marketCap != null) return moneyCompact(q.marketCap);
    return q.type === "EQUITY" ? "—" : "Fund — n/a";
  };

  const day = dayFromISO(date);

  // Common valuation date: the latest bar EVERY loaded series has, so all
  // outcomes are measured over the identical window.
  const commonEnd = useMemo(() => {
    let end = Infinity;
    for (const s of symbols) {
      const v = loaded[s];
      if (v && !(v instanceof Error)) end = Math.min(end, v.days[v.days.length - 1]);
    }
    return Number.isFinite(end) ? end : null;
  }, [loaded, symbols]);

  const rows: Row[] = useMemo(
    () =>
      symbols.map((sym, i) => {
        const v = loaded[sym];
        const name = universeEntry(sym)?.name.replace(/\s\(.*\)$/, "") ?? sym;
        const base = { symbol: sym, name, color: COLORS[i % COLORS.length] };
        if (!v) return base;
        if (v instanceof Error) return { ...base, error: v.message };
        const endIndex = commonEnd != null ? indexOnOrBefore(v.days, commonEnd) : v.days.length - 1;
        return { ...base, series: v, result: computeInvestment(v, amount, day, mode, endIndex) };
      }),
    [symbols, loaded, amount, day, mode, commonEnd],
  );

  const okRows = rows.filter((r) => r.result?.status === "ok");
  const startDays = new Set(okRows.map((r) => r.result!.startDay));
  const sorted = [...rows].sort((a, b) => {
    const av = a.result?.status === "ok" ? a.result : null;
    const bv = b.result?.status === "ok" ? b.result : null;
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    const k = sort.key;
    const x = k === "symbol" ? a.symbol : k === "cagr" ? (av.cagr ?? -Infinity) : av[k];
    const y = k === "symbol" ? b.symbol : k === "cagr" ? (bv.cagr ?? -Infinity) : bv[k];
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
  const maxValue = Math.max(amount, ...okRows.map((r) => r.result!.value));

  const lines: ChartSeries[] = okRows
    .filter((r) => !hidden.has(r.symbol))
    .map((r) => ({
      id: r.symbol,
      label: r.name,
      color: r.color,
      points: valuePath(r.series!, amount, r.result!.startIndex, r.result!.endIndex, mode, 260).map((p) => ({ x: p.day, y: p.value })),
    }));
  const [log, setLog] = useState(false);

  const query = useMemo(() => {
    // Commas left unescaped so shared links stay readable.
    return `symbols=${symbols.map(encodeURIComponent).join(",")}&amount=${amount}&date=${date}${mode === "total" ? "&mode=total" : ""}`;
  }, [symbols, amount, date, mode]);
  useEffect(() => {
    const t = setTimeout(() => window.history.replaceState(window.history.state, "", `/parallel?${query}`), 300);
    return () => clearTimeout(t);
  }, [query]);

  const setPeriod = (years: number) => setDate(isoFromDay(addYears(todayInNewYork(), -years)));
  const remove = (s: string) => setSymbols(symbols.filter((x) => x !== s));
  const headerBtn = (k: SortKey, label: string, align = "text-right") => (
    <th className={`pb-2 font-medium ${align}`} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="hover:text-ink" onClick={() => setSort({ key: k, dir: sort.key === k ? ((sort.dir * -1) as 1 | -1) : -1 })}>
        {label} {sort.key === k ? (sort.dir === -1 ? "↓" : "↑") : ""}
      </button>
    </th>
  );

  const allLoaded = symbols.every((s) => loaded[s]);
  const winner = allLoaded ? sorted.find((r) => r.result?.status === "ok") : undefined;

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Preset comparisons">
        {PRESETS.map((p) => (
          <button key={p.id} className="chip shrink-0" aria-pressed={p.symbols.join() === symbols.join()} onClick={() => { setSymbols(p.symbols); setHidden(new Set()); }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="card space-y-4 p-5 sm:p-6">
        <p className="font-display text-2xl font-semibold leading-snug sm:text-3xl">
          What if you invested{" "}
          <span className="inline-flex items-baseline text-accent-ink">
            $
            <input
              aria-label="Amount per company"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                const n = Number(e.target.value.replace(/[$,\s]/g, ""));
                if (n > 0 && n <= 1e12) setAmount(n);
              }}
              className="border-b-2 border-accent/60 bg-transparent outline-none tnum"
              style={{ width: `${Math.max(3, amountText.length + 0.5)}ch` }}
            />
          </span>{" "}
          in each, on{" "}
          <label className="relative inline-block cursor-pointer border-b-2 border-ink/20">
            {Number.isFinite(day) ? fmtDay(day) : "a date"}
            <input type="date" aria-label="Start date" value={date} onChange={(e) => Number.isFinite(dayFromISO(e.target.value)) && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          ?
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 5, 10, 20].map((y) => (
            <button key={y} className="chip px-3" aria-pressed={date === isoFromDay(addYears(todayInNewYork(), -y))} onClick={() => setPeriod(y)}>
              {y}Y ago
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-line" />
          <div className="flex rounded-full border border-line bg-surface p-1 text-sm" role="radiogroup" aria-label="Return method">
            {(["price", "total"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 font-medium ${mode === m ? "bg-ink text-bg" : "text-ink-2"}`}>
                {m === "price" ? "Price" : "+ Dividends"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {symbols.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1.5 pr-1 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % 10] }} />
              {s}
              <button aria-label={`Remove ${s}`} onClick={() => remove(s)} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
                ×
              </button>
            </span>
          ))}
          {symbols.length < MAX && (
            <div className="relative">
              <button className="chip" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
                + Add ({symbols.length}/{MAX})
              </button>
              {adding && (
                <div className="absolute left-0 top-full z-50 mt-2 w-[min(86vw,380px)]">
                  <StockSearch
                    autoFocus
                    placeholder="Add a stock or ETF…"
                    onSelect={(r) => {
                      if (!symbols.includes(r.symbol)) setSymbols([...symbols, r.symbol].slice(0, MAX));
                      setAdding(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {winner && winner.result && (
        <div className="rise text-center">
          <p className="text-sm text-ink-2">In this universe, the winner is</p>
          <p className="font-display text-4xl font-bold sm:text-5xl">
            {winner.name} <span className="text-gain tnum">{money(winner.result.value)}</span>
          </p>
          <p className="mt-1 text-sm text-ink-3">
            {money(amount)} on {fmtDay(winner.result.startDay)} → valued at the {fmtDay(winner.result.endDay)} close
          </p>
        </div>
      )}
      {startDays.size > 1 && (
        <p className="rounded-2xl bg-accent-soft p-3 text-sm text-ink">Heads up: not every listing traded on the exact same first session, so start dates differ by a day for some rows.</p>
      )}

      {/* Bars */}
      <section className="card p-5 sm:p-6" aria-labelledby="bars-title">
        <h2 id="bars-title" className="font-display text-xl font-semibold">Ranked by today&apos;s value</h2>
        <ul className="mt-4 space-y-3">
          {sorted.map((r) => {
            const res = r.result;
            const ok = res?.status === "ok";
            return (
              <li key={r.symbol} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_1fr_7rem]">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <TickerLogo symbol={r.symbol} size={22} /> {r.symbol}
                </span>
                <div className="relative h-8 overflow-hidden rounded-lg bg-surface-2">
                  {ok ? (
                    <div className="h-full rounded-lg transition-[width] duration-500" style={{ width: `${Math.max(1.5, (res!.value / maxValue) * 100)}%`, background: r.color }} />
                  ) : (
                    <span className="absolute inset-0 flex items-center px-3 text-xs text-ink-3">
                      {!r.series && !r.error ? "Loading…" : r.error ? "No data" : res?.status === "before-listing" ? `Not trading yet — listed ${fmtDay(res.firstAvailableDay)}` : "Unavailable"}
                    </span>
                  )}
                  {ok && <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold tnum sm:hidden">{moneyCompact(res!.value)}</span>}
                </div>
                <span className="hidden text-right text-sm font-semibold tnum sm:block">{ok ? money(res!.value) : "—"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Table (desktop) / cards (mobile) */}
      <section className="card p-5 sm:p-6" aria-labelledby="table-title">
        <h2 id="table-title" className="font-display text-xl font-semibold">The numbers</h2>
        <div className="mt-4 hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                {headerBtn("symbol", "Company", "text-left")}
                <th className="pb-2 text-right font-medium">
                  Market cap
                  <div className="font-normal normal-case">{MARKET_CAP_HINT}</div>
                </th>
                <th className="pb-2 text-right font-medium">Invested</th>
                {headerBtn("value", "Value today")}
                {headerBtn("gain", "Gain / loss")}
                {headerBtn("totalReturn", "Total return")}
                {headerBtn("cagr", "CAGR")}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((r) => {
                const res = r.result;
                const ok = res?.status === "ok";
                return (
                  <tr key={r.symbol}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-ink-3">{r.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tnum text-ink-2">{capText(r.symbol)}</td>
                    {ok ? (
                      <>
                        <td className="text-right tnum">{money(res!.amount)}</td>
                        <td className="text-right font-semibold tnum">{money(res!.value)}</td>
                        <td className={`text-right tnum ${res!.gain >= 0 ? "text-gain" : "text-loss"}`}>{money(res!.gain, { sign: true })}</td>
                        <td className={`text-right tnum ${res!.gain >= 0 ? "text-gain" : "text-loss"}`}>{pct(res!.totalReturn)}</td>
                        <td className="text-right tnum">{res!.cagr != null ? pct(res!.cagr) : "n/a"}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="text-right text-xs text-ink-3">
                        {res?.status === "before-listing" ? `Unavailable — not publicly traded on ${fmtDay(day)} (data from ${fmtDay(res.firstAvailableDay)})` : r.error ?? "Loading…"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="self-center text-ink-3">Sort:</span>
            {(["value", "cagr", "symbol"] as SortKey[]).map((k) => (
              <button key={k} className="chip px-2.5 py-1 text-xs" aria-pressed={sort.key === k} onClick={() => setSort({ key: k, dir: k === "symbol" ? 1 : -1 })}>
                {k === "value" ? "Value" : k === "cagr" ? "CAGR" : "A–Z"}
              </button>
            ))}
          </div>
          {sorted.map((r) => {
            const res = r.result;
            const ok = res?.status === "ok";
            return (
              <div key={r.symbol} className="rounded-2xl border border-line p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="truncate text-sm text-ink-3">{r.name}</span>
                </div>
                <div className="mt-1 text-xs text-ink-3">
                  MARKET CAP <span className="normal-case">{MARKET_CAP_HINT}</span>: <b className="text-ink tnum">{capText(r.symbol)}</b>
                </div>
                {ok ? (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div><div className="text-[11px] text-ink-3">Value</div><div className="font-semibold tnum">{money(res!.value)}</div></div>
                    <div><div className="text-[11px] text-ink-3">Return</div><div className={`font-semibold tnum ${res!.gain >= 0 ? "text-gain" : "text-loss"}`}>{pct(res!.totalReturn)}</div></div>
                    <div><div className="text-[11px] text-ink-3">CAGR</div><div className="font-semibold tnum">{res!.cagr != null ? pct(res!.cagr) : "n/a"}</div></div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-3">{res?.status === "before-listing" ? `Not publicly traded yet (data from ${fmtDay(res.firstAvailableDay)})` : r.error ?? "Loading…"}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Lines */}
      {okRows.length > 0 && (
        <section className="card p-5 sm:p-6" aria-labelledby="lines-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="lines-title" className="font-display text-xl font-semibold">How each universe unfolded</h2>
            <button className="chip px-3 py-1.5 text-[13px]" aria-pressed={log} onClick={() => setLog(!log)}>Log scale</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Toggle lines">
            {okRows.map((r) => (
              <button
                key={r.symbol}
                className="chip px-2.5 py-1 text-xs"
                aria-pressed={!hidden.has(r.symbol)}
                onClick={() => {
                  const h = new Set(hidden);
                  if (h.has(r.symbol)) h.delete(r.symbol);
                  else h.add(r.symbol);
                  setHidden(h);
                }}
                style={!hidden.has(r.symbol) ? { background: r.color, borderColor: r.color, color: "#fff" } : undefined}
              >
                {r.symbol}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <LineChart
              series={lines}
              height={340}
              yLog={log}
              baseline={{ y: amount, label: `${money(amount)} invested` }}
              formatY={(v) => moneyCompact(v)}
              ariaLabel="Investment value over time for each company"
              renderTooltip={(x, values) => (
                <div>
                  <div className="text-ink-3">{fmtDay(x)}</div>
                  {[...values].sort((a, b) => b.point.y - a.point.y).map(({ series: s, point }) => (
                    <div key={s.id} className="flex justify-between gap-2 tnum">
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.id}</span>
                      <b>{moneyCompact(point.y)}</b>
                    </div>
                  ))}
                </div>
              )}
            />
          </div>
        </section>
      )}

      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs text-ink-3">
          Same amount, same start date, same valuation date ({commonEnd != null ? fmtDay(commonEnd) : "—"}) and the same method ({mode === "total" ? "dividends reinvested" : "price return"}) for every row. A date before a company&apos;s listing marks it unavailable — we never quietly move its start date. Excludes taxes and fees.
        </p>
        {okRows.length > 0 && (
          <ShareResult
            path={`/parallel?${query}`}
            imagePath={`/api/og?type=parallel&${query}`}
            filename={`parallel-universe-${date}.png`}
            text={`${money(amount)} in each on ${fmtDay(day)}: ${okRows.length} parallel universes. Winner: ${winner?.symbol} at ${winner?.result ? money(winner.result.value) : ""}.`}
          />
        )}
      </div>
    </div>
  );
}
