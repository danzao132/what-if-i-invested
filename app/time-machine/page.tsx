import type { Metadata } from "next";
import { TimeMachine } from "@/components/time-machine/TimeMachine";
import { parseScenario, scenarioQuery } from "@/lib/scenario";
import { universeEntry } from "@/lib/data/universe";
import { fmtDay } from "@/lib/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sc = parseScenario(await searchParams);
  const name = universeEntry(sc.symbol)?.name ?? sc.symbol;
  const title = sc.day != null ? `$${sc.amount.toLocaleString("en-US")} in ${name} on ${fmtDay(sc.day)}` : "The Time Machine";
  const image = `/api/og?${scenarioQuery(sc)}`;
  return {
    title,
    description: "Drag through history and see what an investment would be worth today — calculated from real historical prices.",
    openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function TimeMachinePage({ searchParams }: Props) {
  const sc = parseScenario(await searchParams);
  return (
    <div className="pt-8 sm:pt-12">
      <header className="mb-6 max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">The Time Machine</h1>
        <p className="mt-2 text-ink-2">
          Drag the dial through any stock&apos;s history. Every position is a real trading day; the number updates as you travel.
        </p>
      </header>
      <TimeMachine initialSymbol={sc.symbol} initialAmount={sc.amount} initialDay={sc.day} initialMode={sc.mode} syncUrl />
      <p className="mt-6 text-sm text-ink-3">
        Tip: use ← → for one trading day, Page Up/Down for about a month, Shift + arrows for about a year. Tap the chart to jump.
      </p>
    </div>
  );
}
