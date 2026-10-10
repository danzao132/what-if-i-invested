import { moneyCompact } from "@/lib/format";
import type { AssetType } from "@/lib/types";

export const MARKET_CAP_LABEL = "Market cap";
export const MARKET_CAP_HINT = "(what is the value of the company)";

/** "MARKET CAP (what is the value of the company)" + value; funds get a note instead. */
export function MarketCap({ value, type, size = "md", className = "" }: { value?: number; type?: AssetType; size?: "sm" | "md"; className?: string }) {
  const isFund = type === "ETF" || type === "MUTUALFUND" || type === "INDEX";
  return (
    <div className={className}>
      <div className={`font-semibold uppercase tracking-wider text-ink-3 ${size === "sm" ? "text-[10px]" : "text-[11px]"}`}>
        {MARKET_CAP_LABEL} <span className="font-normal normal-case tracking-normal">{MARKET_CAP_HINT}</span>
      </div>
      <div className={`font-display font-bold tnum ${size === "sm" ? "text-sm" : "text-2xl"} ${value == null ? "text-ink-3" : "text-ink"}`}>
        {value != null ? moneyCompact(value) : isFund ? "Fund — no market cap" : "—"}
      </div>
    </div>
  );
}
