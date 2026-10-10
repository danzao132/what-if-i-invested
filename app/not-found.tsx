import Link from "next/link";
import { StockSearch } from "@/components/StockSearch";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <div className="text-6xl" aria-hidden>🕰️</div>
      <h1 className="mt-4 font-display text-4xl font-bold">Lost in time</h1>
      <p className="mt-2 text-ink-2">We couldn&apos;t find that page or ticker. Try searching for a US-listed stock or ETF.</p>
      <StockSearch className="mt-6 text-left" />
      <Link href="/" className="btn btn-ghost mt-6">Back to the present</Link>
    </div>
  );
}
