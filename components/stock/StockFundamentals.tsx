"use client";

import { useState } from "react";
import { useFundamentals } from "@/lib/client/data";
import { compactNumber, moneyCompact, pct, price } from "@/lib/format";
import type { Quote } from "@/lib/types";

type Tab = "market" | "company" | "financials";

export function StockFundamentals({ symbol, quote }: { symbol: string; quote: Quote | null }) {
  const { data: f, loading } = useFundamentals(symbol);
  const [tab, setTab] = useState<Tab>("market");
  const [expanded, setExpanded] = useState(false);
  const isFund = quote?.type === "ETF" || quote?.type === "MUTUALFUND" || quote?.type === "INDEX";

  const market: [string, string][] = [
    ["Open", price(quote?.open)],
    ["Day high", price(quote?.dayHigh)],
    ["Day low", price(quote?.dayLow)],
    ["Market cap (what is the value of the company)", isFund ? "Fund — n/a" : moneyCompact(f?.market.marketCap)],
    ["P/E ratio (TTM)", f?.market.peRatio != null ? f.market.peRatio.toFixed(2) : "—"],
    ["EPS (TTM)", f?.market.eps != null ? price(f.market.eps) : "—"],
    ["Dividend yield", f?.market.dividendYield != null ? pct(f.market.dividendYield, { sign: false }) : "—"],
    ["52-week high", price(f?.market.fiftyTwoWeekHigh)],
    ["52-week low", price(f?.market.fiftyTwoWeekLow)],
    ["Volume", compactNumber(f?.market.volume ?? quote?.volume)],
    ["Avg. volume", compactNumber(f?.market.avgVolume)],
    ["Beta", f?.market.beta != null ? f.market.beta.toFixed(2) : "—"],
    ["Shares outstanding", compactNumber(f?.market.sharesOutstanding)],
    ...(isFund ? ([["Expense ratio", f?.market.expenseRatio != null ? pct(f.market.expenseRatio, { sign: false }) : "—"]] as [string, string][]) : []),
  ];
  const company: [string, string][] = isFund
    ? [
        ["Category", f?.profile.category ?? "—"],
        ["Fund family", f?.profile.fundFamily ?? "—"],
      ]
    : [
        ["Sector", f?.profile.sector ?? "—"],
        ["Industry", f?.profile.industry ?? "—"],
        ["Headquarters", f?.profile.headquarters ?? "—"],
        ["Founded", f?.profile.founded != null ? String(f.profile.founded) : "—"],
        ["Employees", f?.profile.employees != null ? f.profile.employees.toLocaleString("en-US") : "—"],
      ];
  const fin = f?.financials;
  const financials: [string, string][] = [
    ["Revenue (TTM)", moneyCompact(fin?.revenue)],
    ["Revenue growth (latest quarter, YoY)", fin?.revenueGrowth != null ? pct(fin.revenueGrowth) : "—"],
    ["Net income", moneyCompact(fin?.netIncome)],
    ["Operating margin", fin?.operatingMargin != null ? pct(fin.operatingMargin, { sign: false }) : "—"],
    ["Free cash flow", moneyCompact(fin?.freeCashFlow)],
    ["Total debt", moneyCompact(fin?.totalDebt)],
    ["Cash & equivalents", moneyCompact(fin?.cash)],
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "market", label: "Key stats" },
    { id: "company", label: isFund ? "Fund" : "Company" },
    ...(isFund ? [] : [{ id: "financials" as const, label: "Financials" }]),
  ];
  const rows = tab === "market" ? market : tab === "company" ? company : financials;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="fund-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="fund-title" className="font-display text-xl font-semibold">About {symbol}</h2>
        <div className="flex gap-1" role="tablist" aria-label="Company information">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="chip px-3 py-1.5 text-[13px]">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !f ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      ) : (
        <>
          {tab === "company" && f?.profile.description && (
            <div className="mt-4">
              <p className={`text-sm leading-relaxed text-ink-2 ${expanded ? "" : "line-clamp-4"}`}>{f.profile.description}</p>
              <button className="mt-1 text-sm font-semibold text-ink" onClick={() => setExpanded((e) => !e)}>
                {expanded ? "Show less" : "Read more"}
              </button>
            </div>
          )}
          <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-right font-medium tnum">{v}</dd>
              </div>
            ))}
            {tab === "company" && f?.profile.website && (
              <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm">
                <dt className="text-ink-3">Website</dt>
                <dd>
                  <a href={f.profile.website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink underline-offset-2 hover:underline">
                    {f.profile.website.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {!f && <p className="mt-3 text-xs text-ink-3">Fundamentals aren&apos;t available from the current data source.</p>}
          {tab === "financials" && fin?.fiscalYearEnd && <p className="mt-3 text-xs text-ink-3">Net income from the fiscal year ending {fin.fiscalYearEnd}; other figures trailing twelve months where available.</p>}
          {f && <p className="mt-3 text-[11px] text-ink-3">Source: {f.source.provider}. Figures may lag company filings.</p>}
        </>
      )}
    </section>
  );
}
