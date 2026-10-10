"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { searchSymbols } from "@/lib/client/data";
import { POPULAR, searchUniverse, universeEntry } from "@/lib/data/universe";
import type { SearchResult } from "@/lib/types";
import { TickerLogo } from "./ui/Logo";
import { useLocalStorage } from "./ui/hooks";

const RECENTS_KEY = "wiii:recent-searches";

/**
 * Accessible combobox (WAI-ARIA 1.2 pattern): instant local matches from the
 * curated universe, then provider results merged in after a short debounce.
 */
export function StockSearch({
  onSelect,
  placeholder = "Search any stock or ETF — Apple, NVDA, SPY…",
  size = "md",
  autoFocus = false,
  className = "",
}: {
  onSelect?: (r: SearchResult) => void;
  placeholder?: string;
  size?: "md" | "lg";
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useLocalStorage<SearchResult[]>(RECENTS_KEY, []);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions: SearchResult[] = q.trim()
    ? results
    : recents.length
      ? recents
      : POPULAR.map((s) => universeEntry(s)!).filter(Boolean);
  const heading = q.trim() ? null : recents.length ? "Recent" : "Popular";

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setResults(searchUniverse(query));
    setActive(0);
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchSymbols(query, ctrl.signal)
        .then((r: SearchResult[]) => {
          setResults((local) => {
            const seen = new Set<string>();
            return [...local, ...r].filter((x) => (seen.has(x.symbol) ? false : (seen.add(x.symbol), true))).slice(0, 10);
          });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const choose = (r: SearchResult) => {
    setRecents([r, ...recents.filter((x) => x.symbol !== r.symbol)].slice(0, 6));
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    if (onSelect) onSelect(r);
    else router.push(`/stock/${encodeURIComponent(r.symbol)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const pick = suggestions[active];
      if (pick) choose(pick);
      else if (/^[A-Za-z.^-]{1,8}$/.test(q.trim())) choose({ symbol: q.trim().toUpperCase(), name: q.trim().toUpperCase(), exchange: "", type: "EQUITY" });
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const lg = size === "lg";
  const showEmpty = q.trim() && !loading && results.length === 0;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-3 rounded-full border border-line-strong bg-surface shadow-card transition focus-within:border-accent ${
          lg ? "h-16 px-6" : "h-12 px-4"
        }`}
      >
        <svg width={lg ? 22 : 18} height={lg ? 22 : 18} viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
          aria-label="Search stocks and ETFs"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3 ${lg ? "text-lg" : "text-[15px]"}`}
        />
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" aria-hidden />}
        {!lg && (
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-3 sm:inline" aria-hidden>
            /
          </kbd>
        )}
      </div>
      {open && (suggestions.length > 0 || showEmpty) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-card rise">
          {heading && <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{heading}</div>}
          <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
            {suggestions.map((r, i) => (
              <li
                key={r.symbol}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? "bg-surface-2" : ""}`}
              >
                <TickerLogo symbol={r.symbol} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-ink">{r.name}</div>
                  <div className="text-xs text-ink-3">
                    <span className="font-semibold text-ink-2">{r.symbol}</span>
                    {r.exchange && ` · ${r.exchange}`}
                    {r.type !== "EQUITY" && ` · ${r.type === "ETF" ? "ETF" : r.type === "INDEX" ? "Index" : "Fund"}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {showEmpty && (
            <div className="px-4 py-4 text-sm text-ink-2">
              No US-listed stock or ETF matches “{q}”. Try a ticker like <b>AAPL</b> or a name like <b>Coca-Cola</b>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
