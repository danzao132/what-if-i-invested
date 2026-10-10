"use client";

import { useState } from "react";
import { universeEntry } from "@/lib/data/universe";

const PALETTE = ["#6a5cff", "#f2a01d", "#0b8f63", "#d9487e", "#1f8fd6", "#8a6d3b", "#00a3a3", "#b45ad6"];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Company favicon (from the company's own domain) with a monogram fallback. */
export function TickerLogo({ symbol, domain, size = 40 }: { symbol: string; domain?: string; size?: number }) {
  const d = domain ?? universeEntry(symbol)?.domain;
  const [failed, setFailed] = useState(false);
  const color = PALETTE[hash(symbol) % PALETTE.length];
  const label = symbol.replace(/^\^/, "").slice(0, symbol.length > 4 ? 3 : 4);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * (label.length > 3 ? 0.26 : 0.32) }}
      aria-hidden
    >
      {label}
      {d && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://icons.duckduckgo.com/ip3/${d}.ico`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // DDG returns a 48px grey placeholder for unknown domains.
            if ((e.currentTarget.naturalWidth || 0) < 16) setFailed(true);
          }}
          className="absolute inset-0 h-full w-full bg-white object-contain p-[14%]"
        />
      )}
    </span>
  );
}
