"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StockSearch } from "./StockSearch";
import { ThemeToggle } from "./ThemeToggle";

export const NAV = [
  { href: "/explore", label: "Explore", icon: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3" },
  { href: "/time-machine", label: "Time Machine", icon: "M12 7v5l3 2M12 3a9 9 0 110 18 9 9 0 010-18z" },
  { href: "/regret", label: "Regret Calculator", short: "Regret", icon: "M4 7h16M6 7l1 12h10l1-12M9 7V5h6v2" },
  { href: "/parallel", label: "Parallel Universe", short: "Parallel", icon: "M4 18L9 9l4 5 7-10M4 21h16" },
];

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="wiii-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--past)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#wiii-mark)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.2" strokeDasharray="44 13" transform="rotate(-60 16 16)" />
      <path d="M11 19l4-4 3 2.5 4-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => setSearchOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => document.querySelector<HTMLInputElement>("#header-search input")?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="What If I Invested? — home">
          <Mark />
          <span className="font-display text-[17px] font-bold leading-none">
            What If I Invested<span className="text-accent">?</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href) || (n.href === "/explore" && pathname.startsWith("/stock"));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${active ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div id="header-search" className={`${searchOpen ? "absolute inset-x-3 top-2 z-50 md:static md:w-72" : "hidden md:block md:w-64 xl:w-72"}`}>
            <StockSearch placeholder="Search stocks & ETFs" />
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-line md:hidden"
            aria-label="Search"
            onClick={() => {
              setSearchOpen((o) => !o);
              setTimeout(() => document.querySelector<HTMLInputElement>("#header-search input")?.focus(), 0);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </div>
      {searchOpen && <div className="fixed inset-0 top-16 z-30 bg-bg/60 md:hidden" onClick={() => setSearchOpen(false)} aria-hidden />}
    </header>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href) || (n.href === "/explore" && pathname.startsWith("/stock"));
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-ink" : "text-ink-3"}`}
            >
              <span className={`grid h-8 w-12 place-items-center rounded-full ${active ? "bg-accent-soft text-accent-ink" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d={n.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {n.short ?? n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
