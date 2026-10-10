import type { Metadata } from "next";
import { provider } from "@/lib/data";

export const metadata: Metadata = { title: "How we calculate", description: "The formulas, data and assumptions behind every hypothetical investment." };

export default function Methodology() {
  return (
    <article className="mx-auto max-w-2xl pt-10 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-ink">
      <h1 className="font-display text-4xl font-extrabold text-ink">How we calculate</h1>
      <p className="mt-3">Every number on this site comes from one shared, tested calculation engine and the same historical price data. Here&apos;s exactly what it does.</p>

      <h2>Price return</h2>
      <p className="mt-2">
        We buy fractional shares at the <b>closing price</b> of the purchase day and value them at the latest available close:
      </p>
      <p className="mt-2"><code>Value = Investment × (Ending price ÷ Starting price)</code></p>
      <p className="mt-2">
        Both prices are <b>split-adjusted</b> on the same basis, so stock splits and reverse splits never create fake gains or losses. A
        2-for-1 split doubles your shares and halves the price; the value is unchanged.
      </p>

      <h2>Total return (dividends reinvested)</h2>
      <p className="mt-2">
        When you choose <b>+ Dividends</b>, each cash dividend is reinvested in more shares at the close on its ex-dividend date — the
        standard total-return convention. You only receive a dividend if you held the shares before its ex-date. Each dividend is counted
        exactly once. If the data source can&apos;t supply reliable dividend history (for example, for an index), the option is disabled and
        we show price return only.
      </p>

      <h2>Annualized return (CAGR)</h2>
      <p className="mt-2"><code>CAGR = (Ending value ÷ Investment)^(1 ÷ Years) − 1</code></p>
      <p className="mt-2">
        Years are the actual elapsed calendar days between the purchase and valuation closes, divided by 365.2425. We don&apos;t show CAGR for
        periods under one year, because annualizing a few weeks of returns produces misleading numbers.
      </p>

      <h2>Dates</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Weekends and market holidays: we use the <b>next trading day&apos;s close</b> and always show the date actually used.</li>
        <li>Before a company listed: we say so and don&apos;t move the date for you. (In Parallel Universe, it&apos;s marked unavailable.)</li>
        <li>Missing or suspended sessions are skipped; we never fill in prices.</li>
        <li>Parallel Universe values every company on the same final date — the latest close that all of them share.</li>
        <li>Lookback periods (1Y, 10Y…) count back calendar months/years from the latest close. YTD is measured from the prior year&apos;s last close.</li>
      </ul>

      <h2>Corporate actions</h2>
      <p className="mt-2">
        Splits, reverse splits and dividends come from the data feed. Ticker changes are handled by the provider (for example, Meta&apos;s
        history includes its years as FB). Spin-offs, mergers and delisted companies depend on provider coverage; delisted securities
        may not be searchable, which means lists of &quot;winners&quot; can suffer from survivorship bias — we flag this where it matters.
      </p>

      <h2>What&apos;s not included</h2>
      <p className="mt-2">
        Taxes, trading commissions, fund fees beyond what&apos;s already reflected in an ETF&apos;s price, bid/ask spreads and inflation. Results are
        hypothetical and for education and entertainment. <b>Past performance doesn&apos;t predict future results.</b>
      </p>

      <h2>Data</h2>
      <p className="mt-2">
        Current source: <b className="text-ink">{provider.label}</b>. Quotes show whether they are real-time, delayed or the last close, with a
        timestamp. Fundamentals are shown as reported by the source and may lag company filings.
      </p>
    </article>
  );
}
