"use client";

import { useEffect, useState } from "react";
import { prepareSeries, type PreparedSeries } from "../engine/series";
import type { Fundamentals, IntradaySeries, Quote, SearchResult } from "../types";
import { decodeHistory, type WireHistory } from "../wire";

/**
 * Browser-side data hooks. Histories are fetched once per symbol per session
 * and prepared (total-return index etc.) once, so every slider movement is a
 * pure in-memory calculation — no network.
 */
const seriesCache = new Map<string, Promise<PreparedSeries>>();

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function loadSeries(symbol: string): Promise<PreparedSeries> {
  let p = seriesCache.get(symbol);
  if (!p) {
    p = getJSON<WireHistory>(`/api/history/${encodeURIComponent(symbol)}`).then((w) => prepareSeries(decodeHistory(w)));
    p.catch(() => seriesCache.delete(symbol));
    seriesCache.set(symbol, p);
  }
  return p;
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: !!key });
  useEffect(() => {
    if (!key) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let alive = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    load().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: Error) => alive && setState({ data: null, error: e.message, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export const useSeries = (symbol: string | null) => useAsync(symbol, () => loadSeries(symbol!));

export function useManySeries(symbols: string[]) {
  const key = symbols.join(",");
  const [state, setState] = useState<Record<string, PreparedSeries | Error>>({});
  useEffect(() => {
    let alive = true;
    for (const s of symbols) {
      loadSeries(s).then(
        (d) => alive && setState((st) => ({ ...st, [s]: d })),
        (e: Error) => alive && setState((st) => ({ ...st, [s]: e })),
      );
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

const quoteCache = new Map<string, Promise<Quote>>();
function loadQuote(symbol: string): Promise<Quote> {
  let p = quoteCache.get(symbol);
  if (!p) {
    p = getJSON<Quote>(`/api/quote/${encodeURIComponent(symbol)}`);
    p.catch(() => quoteCache.delete(symbol));
    quoteCache.set(symbol, p);
  }
  return p;
}

/** Quotes for several symbols; missing/failed ones are simply absent. */
export function useManyQuotes(symbols: string[]) {
  const key = symbols.join(",");
  const [state, setState] = useState<Record<string, Quote>>({});
  useEffect(() => {
    let alive = true;
    for (const s of symbols) loadQuote(s).then((q) => alive && setState((st) => ({ ...st, [s]: q })), () => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export const useQuote = (symbol: string | null) => useAsync(symbol, () => getJSON<Quote>(`/api/quote/${encodeURIComponent(symbol!)}`));

export const useFundamentals = (symbol: string | null) =>
  useAsync(symbol, () => getJSON<Fundamentals | null>(`/api/fundamentals/${encodeURIComponent(symbol!)}`));

export const useIntraday = (symbol: string | null, range: "1d" | "5d" | null) =>
  useAsync(symbol && range ? `${symbol}:${range}` : null, () =>
    getJSON<IntradaySeries | null>(`/api/intraday/${encodeURIComponent(symbol!)}?range=${range}`),
  );

export function searchSymbols(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  return fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal }).then((r) => (r.ok ? r.json() : []));
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
