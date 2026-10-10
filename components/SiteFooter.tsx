import Link from "next/link";
import { provider } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line pb-28 pt-10 lg:pb-12">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 text-sm text-ink-2 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="font-display text-base font-semibold text-ink">What If I Invested?</p>
          <p className="max-w-md text-xs leading-relaxed text-ink-3">
            For education and entertainment. Results are hypothetical, based on historical closing prices adjusted for stock splits (and,
            when selected, reinvested dividends). They exclude taxes, fees, slippage and inflation. Past performance does not predict future
            results. Nothing here is investment advice or an offer to buy or sell any security.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Explore</p>
          <Link href="/time-machine" className="block hover:text-ink">Time Machine</Link>
          <Link href="/regret" className="block hover:text-ink">Regret Calculator</Link>
          <Link href="/parallel" className="block hover:text-ink">Parallel Universe</Link>
          <Link href="/methodology" className="block hover:text-ink">How we calculate</Link>
        </div>
        <div className="space-y-2 text-xs text-ink-3">
          <p className="font-semibold uppercase tracking-wider">Data</p>
          <p>
            Market data: <span className="text-ink-2">{provider.label}</span>. Quotes may be delayed; every price shows its timestamp.
          </p>
          <p>Company logos are favicons from each company&apos;s own website and remain their owners&apos; trademarks.</p>
        </div>
      </div>
    </footer>
  );
}
