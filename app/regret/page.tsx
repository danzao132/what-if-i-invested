import type { Metadata } from "next";
import { RegretCalculator, type RegretState } from "@/components/regret/RegretCalculator";
import { dayFromISO } from "@/lib/engine/dates";
import { normalizeSymbol } from "@/lib/data/universe";
import { REGRET_PRESETS } from "@/lib/regret-presets";
import { parseAmount } from "@/lib/scenario";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parse(sp: Record<string, string | string[] | undefined>): RegretState {
  const preset = REGRET_PRESETS.find((p) => p.id === one(sp.p)) ?? REGRET_PRESETS[0];
  const date = one(sp.date);
  return {
    presetId: preset.id,
    item: (one(sp.item) ?? preset.item).slice(0, 60),
    amount: parseAmount(one(sp.amount), preset.amount),
    date: date && Number.isFinite(dayFromISO(date)) ? date : preset.date,
    symbol: normalizeSymbol(one(sp.symbol)) ?? preset.symbol,
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const s = parse(await searchParams);
  const q = new URLSearchParams({ type: "regret", item: s.item, amount: String(s.amount), date: s.date, symbol: s.symbol });
  const title = `The Regret Calculator: ${s.item} vs. ${s.symbol} stock`;
  return {
    title,
    description: "What if you bought the stock instead? Compare everyday purchases with what the same money could have become.",
    openGraph: { title, images: [{ url: `/api/og?${q}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [`/api/og?${q}`] },
  };
}

export default async function RegretPage({ searchParams }: Props) {
  const initial = parse(await searchParams);
  return (
    <div className="pt-8 sm:pt-12">
      <header className="mb-6 max-w-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-loss">No judgement. Just curiosity.</div>
        <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">The Regret Calculator</h1>
        <p className="mt-2 text-lg text-ink-2">What if you bought the stock instead?</p>
      </header>
      <RegretCalculator initial={initial} />
    </div>
  );
}
