import Link from "next/link";
import { ScenarioCard, StockCard } from "@/components/DiscoveryCards";
import { StockSearch } from "@/components/StockSearch";
import { TimeMachine } from "@/components/time-machine/TimeMachine";
import { computeScenarios, FASCINATING, NOT_WINNERS, summarize, WINNER_UNIVERSE } from "@/lib/discovery";
import { POPULAR } from "@/lib/data/universe";
import { money, pct } from "@/lib/format";

export const revalidate = 3600;

export default async function Home() {
  const [popular, fascinating, losers, winnersRaw] = await Promise.all([
    Promise.all(POPULAR.map(summarize)),
    computeScenarios(FASCINATING),
    computeScenarios(NOT_WINNERS),
    Promise.all(WINNER_UNIVERSE.map(summarize)),
  ]);
  const winners = winnersRaw
    .filter((s): s is NonNullable<typeof s> => !!s && s.tenYear.years >= 9.9 && s.tenYear.cagr != null)
    .sort((a, b) => b.tenYear.cagr! - a.tenYear.cagr!);
  const realLosers = losers.filter((l) => l.result.gain < 0);

  return (
    <div className="pt-8 sm:pt-14">
      {/* HERO */}
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gain" /> Real historical prices · no sign-up
        </p>
        <h1 className="font-display text-[2.9rem] font-extrabold leading-[0.95] sm:text-7xl">
          What if I <span className="bg-gradient-to-r from-past to-accent bg-clip-text text-transparent">invested?</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2 sm:text-xl">Pick a stock. Pick a date. See what your money could be worth today.</p>
        <StockSearch size="lg" className="mx-auto mt-7 max-w-xl text-left" />
      </section>

      {/* THE TIME MACHINE */}
      <div className="mt-10 sm:mt-14">
        <TimeMachine initialSymbol="AAPL" initialAmount={1000} />
      </div>

      {/* POPULAR */}
      <Section eyebrow="Popular" title="Ten years ago, $1,000 in…" href="/explore" cta="Explore all">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {popular.filter(Boolean).map((s) => (
            <StockCard key={s!.symbol} s={s!} />
          ))}
        </div>
      </Section>

      {/* FEATURE TEASERS */}
      <div className="mt-16 grid gap-4 md:grid-cols-2">
        <Link href="/regret" className="card group relative overflow-hidden p-7 transition hover:-translate-y-0.5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-loss">The Regret Calculator</div>
          <h3 className="mt-2 font-display text-3xl font-bold leading-tight">What if you bought the stock instead?</h3>
          <p className="mt-2 max-w-sm text-ink-2">That iPhone, that console, that daily latte. See what the same money could have become — no judgement, just curiosity.</p>
          <span className="mt-5 inline-flex items-center gap-1 font-semibold">Try it →</span>
          <div aria-hidden className="absolute -right-6 -top-6 text-[9rem] leading-none opacity-[0.08] transition group-hover:rotate-6">☕</div>
        </Link>
        <Link href="/parallel" className="card group relative overflow-hidden p-7 transition hover:-translate-y-0.5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-past">Parallel Universe</div>
          <h3 className="mt-2 font-display text-3xl font-bold leading-tight">Same money. Different companies.</h3>
          <p className="mt-2 max-w-sm text-ink-2">Race up to 10 stocks and ETFs from the same starting line. Tech Giants, Chip Wars, the Magnificent Seven…</p>
          <span className="mt-5 inline-flex items-center gap-1 font-semibold">Open a portal →</span>
          <div aria-hidden className="absolute -right-4 -top-8 text-[9rem] leading-none opacity-[0.08] transition group-hover:-rotate-6">🪐</div>
        </Link>
      </div>

      {/* FASCINATING */}
      <Section eyebrow="From the archives" title="Fascinating historical investments">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fascinating.map((sc) => (
            <ScenarioCard key={sc.symbol + sc.date} sc={sc} />
          ))}
        </div>
      </Section>

      {/* WINNERS + LOSERS */}
      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        <section className="card min-w-0 p-6">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-gain">Biggest historical winners</div>
          <h2 className="mt-1 font-display text-2xl font-bold">Best 10-year compounding</h2>
          <p className="mt-1 text-sm text-ink-2">
            Ranked by 10-year price CAGR among the {WINNER_UNIVERSE.length} well-known stocks and ETFs we track on this page — a fixed list chosen in
            advance, so the ranking includes laggards too.
          </p>
          <ol className="mt-4 divide-y divide-line">
            {winners.map((w, i) => (
              <li key={w.symbol}>
                <Link href={`/stock/${encodeURIComponent(w.symbol)}`} className="flex items-center gap-3 py-2.5 hover:text-accent-ink">
                  <span className="w-5 text-right text-xs text-ink-3 tnum">{i + 1}</span>
                  <span className="w-14 font-semibold">{w.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{w.name.replace(/\s\(.*\)$/, "")}</span>
                  <span className={`text-sm font-semibold tnum ${w.tenYear.cagr! >= 0 ? "text-gain" : "text-loss"}`}>{pct(w.tenYear.cagr)}/yr</span>
                  <span className="hidden w-24 text-right text-sm tnum sm:block">{money(w.tenYear.value)}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-3">$1,000 invested 10 years ago, price return. Survivorship note: companies that went bankrupt or were delisted can&apos;t appear in lists like this.</p>
        </section>
        <section className="min-w-0 space-y-4">
          <div className="card p-6">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-loss">Not every investment wins</div>
            <h2 className="mt-1 font-display text-2xl font-bold">Hindsight cuts both ways</h2>
            <p className="mt-1 text-sm text-ink-2">Even famous companies can lose money for years if you buy at the wrong moment.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {realLosers.map((sc) => (
              <ScenarioCard key={sc.symbol + sc.date} sc={sc} tone="muted" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Section({ eyebrow, title, href, cta, children }: { eyebrow: string; title: string; href?: string; cta?: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-ink-3">{eyebrow}</div>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-semibold text-ink-2 hover:text-ink">
            {cta} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
