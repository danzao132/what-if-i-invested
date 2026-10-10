import type { Metadata } from "next";
import { ParallelUniverse, type ParallelInit } from "@/components/parallel/ParallelUniverse";
import { PRESETS } from "@/lib/parallel-presets";
import { dayFromISO } from "@/lib/engine/dates";
import { normalizeSymbol } from "@/lib/data/universe";
import { parseAmount } from "@/lib/scenario";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parse(sp: Record<string, string | string[] | undefined>): ParallelInit {
  const syms = [...new Set((one(sp.symbols) ?? "").split(",").map(normalizeSymbol).filter((s): s is string => !!s))].slice(0, 10);
  const date = one(sp.date);
  return {
    symbols: syms.length ? syms : PRESETS[0].symbols,
    amount: parseAmount(one(sp.amount), 10000),
    date: date && Number.isFinite(dayFromISO(date)) ? date : null,
    mode: one(sp.mode) === "total" ? "total" : "price",
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = parse(await searchParams);
  const q = new URLSearchParams({ type: "parallel", symbols: p.symbols.join(","), amount: String(p.amount), ...(p.date ? { date: p.date } : {}) });
  const title = `Parallel Universe: ${p.symbols.join(" vs ")}`;
  return {
    title,
    description: "What if you had invested the same money in different companies? Compare up to 10 stocks and ETFs.",
    openGraph: { title, images: p.date ? [{ url: `/api/og?${q}`, width: 1200, height: 630 }] : ["/api/og"] },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ParallelPage({ searchParams }: Props) {
  const initial = parse(await searchParams);
  return (
    <div className="pt-8 sm:pt-12">
      <header className="mb-6 max-w-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-past">Same money. Different timelines.</div>
        <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">Parallel Universe</h1>
        <p className="mt-2 text-lg text-ink-2">What if you had invested the same money in different companies?</p>
      </header>
      <ParallelUniverse initial={initial} />
    </div>
  );
}
