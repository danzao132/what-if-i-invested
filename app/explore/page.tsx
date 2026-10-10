import type { Metadata } from "next";
import Link from "next/link";
import { StockCard } from "@/components/DiscoveryCards";
import { StockSearch } from "@/components/StockSearch";
import { summarize } from "@/lib/discovery";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Explore stocks & ETFs", description: "Search US stocks and ETFs and see what $1,000 invested years ago would be worth today." };

const GROUPS: { title: string; symbols: string[] }[] = [
  { title: "Big Tech", symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX"] },
  { title: "Index funds & ETFs", symbols: ["SPY", "QQQ", "VOO"] },
  { title: "Household names", symbols: ["KO", "DIS", "NKE", "SBUX", "MCD", "COST", "WMT", "BRK.B"] },
  { title: "Chips", symbols: ["NVDA", "AMD", "INTC", "ARM"] },
  { title: "Cars", symbols: ["TSLA", "F", "GM"] },
  { title: "Finance", symbols: ["JPM", "V", "C"] },
];

export default async function ExplorePage() {
  const all = [...new Set(GROUPS.flatMap((g) => g.symbols))];
  const summaries = new Map((await Promise.all(all.map(summarize))).filter(Boolean).map((s) => [s!.symbol, s!]));
  return (
    <div className="pt-8 sm:pt-12">
      <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Explore</h1>
      <p className="mt-2 max-w-xl text-ink-2">Search any US-listed stock or ETF, or start with a few favourites. Every card shows what $1,000 invested ten years ago is worth now.</p>
      <StockSearch size="lg" className="mt-6 max-w-2xl" />
      {GROUPS.map((g) => (
        <section key={g.title} className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold">{g.title}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.symbols.map((s) => {
              const sum = summaries.get(s);
              return sum ? (
                <StockCard key={s} s={sum} />
              ) : (
                <Link key={s} href={`/stock/${s}`} className="card p-4 text-sm text-ink-2">
                  {s} — data unavailable right now
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <p className="mt-10 text-xs text-ink-3">Price returns from split-adjusted closes; dividends not included on these cards. Open a stock to include dividends.</p>
    </div>
  );
}
