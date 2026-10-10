import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StockDetail } from "@/components/stock/StockDetail";
import { StockHeader } from "@/components/stock/StockHeader";
import { getHistory, getQuote } from "@/lib/data";
import { normalizeSymbol, universeEntry } from "@/lib/data/universe";
import { parseScenario, scenarioQuery } from "@/lib/scenario";

type Props = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const symbol = normalizeSymbol((await params).symbol);
  if (!symbol) return {};
  const q = await getQuote(symbol).catch(() => null);
  const name = q?.name ?? universeEntry(symbol)?.name ?? symbol;
  const sc = parseScenario(await searchParams, { symbol });
  const image = `/api/og?${scenarioQuery({ ...sc, symbol })}`;
  const title = `${name} (${symbol}) — what if you had invested?`;
  return {
    title,
    description: `See what an investment in ${name} would be worth today. Price history, returns and key stats for ${symbol}.`,
    alternates: { canonical: `/stock/${symbol}` },
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function StockPage({ params, searchParams }: Props) {
  const symbol = normalizeSymbol((await params).symbol);
  if (!symbol) notFound();
  const sc = parseScenario(await searchParams, { symbol });
  const quote = await getQuote(symbol).catch(() => null);
  // Unknown tickers get a real 404 rather than an empty page.
  if (!quote && !(await getHistory(symbol).then(() => true, () => false))) notFound();
  const name = quote?.name ?? universeEntry(symbol)?.name ?? symbol;
  return (
    <div className="space-y-8 pt-8">
      <StockHeader quote={quote} symbol={symbol} fallbackName={name} />
      <StockDetail symbol={symbol} name={name} quote={quote} amount={sc.amount} day={sc.day} mode={sc.mode} />
    </div>
  );
}
