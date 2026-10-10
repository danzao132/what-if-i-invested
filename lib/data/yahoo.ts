import "server-only";
import type { DataSourceInfo, MarketState, Quote } from "../types";
import { NotFoundError, type MarketDataProvider } from "./provider";
import { mapType, parseYahooChart, type YahooChart } from "./yahoo-parse";

/**
 * Keyless provider backed by Yahoo Finance's public web endpoints.
 *
 * LICENSING: these endpoints are undocumented and Yahoo's terms restrict
 * them to personal, non-commercial use. This adapter exists so the app works
 * out of the box for development and demos. For a public/commercial launch,
 * switch MARKET_DATA_PROVIDER to a licensed provider (see README).
 */
const UA = "Mozilla/5.0";
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

const toYahoo = (s: string) => s.replace(".", "-");
const fromYahoo = (s: string) => s.replace("-", ".");

function source(): DataSourceInfo {
  return { provider: "Yahoo Finance (unofficial)", kind: "live", fetchedAt: new Date().toISOString() };
}

async function getJSON(path: string, init?: RequestInit): Promise<unknown> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, {
        ...init,
        headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
        cache: "no-store", // our own LRU + CDN headers handle caching
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status === 404) throw new NotFoundError(path);
      if (!res.ok) throw new Error(`Yahoo ${res.status}`);
      return await res.json();
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---- crumb (required by quoteSummary) -------------------------------------
let crumbCache: { crumb: string; cookie: string; at: number } | null = null;

async function getCrumb(force = false): Promise<{ crumb: string; cookie: string }> {
  if (!force && crumbCache && Date.now() - crumbCache.at < 6 * 3600_000) return crumbCache;
  const r = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual", cache: "no-store" });
  const cookie = (r.headers.getSetCookie?.() ?? [r.headers.get("set-cookie") ?? ""])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  const c = await fetch(`${HOSTS[1]}/v1/test/getcrumb`, { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store" });
  const crumb = (await c.text()).trim();
  if (!c.ok || !crumb || crumb.includes(" ")) throw new Error("Could not obtain Yahoo crumb");
  crumbCache = { crumb, cookie, at: Date.now() };
  return crumbCache;
}

const raw = (v: unknown): number | undefined => {
  if (v && typeof v === "object" && "raw" in v) {
    const n = (v as { raw: unknown }).raw;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  }
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

const EXCHANGES: Record<string, string> = {
  NMS: "NASDAQ",
  NGM: "NASDAQ",
  NCM: "NASDAQ",
  NAS: "NASDAQ",
  NYQ: "NYSE",
  NYS: "NYSE",
  PCX: "NYSE Arca",
  ASE: "NYSE American",
  BTS: "Cboe BZX",
  PNK: "OTC",
  SNP: "INDEX",
  DJI: "INDEX",
  NIM: "INDEX",
};
const US_EXCHANGES = new Set(Object.keys(EXCHANGES));

async function chart(symbol: string, query: string): Promise<YahooChart> {
  const json = (await getJSON(`/v8/finance/chart/${encodeURIComponent(toYahoo(symbol))}?${query}`)) as {
    chart: { result?: YahooChart[] | null; error?: { code: string } | null };
  };
  const result = json.chart.result?.[0];
  if (!result || json.chart.error) throw new NotFoundError(symbol);
  return result;
}

function marketState(s: string | undefined): MarketState {
  switch (s) {
    case "REGULAR":
      return "open";
    case "PRE":
    case "PREPRE":
      return "pre";
    case "POST":
    case "POSTPOST":
      return "post";
    default:
      return "closed";
  }
}

export const yahooProvider: MarketDataProvider = {
  id: "yahoo",
  label: "Yahoo Finance (unofficial, personal-use)",

  async search(query) {
    const json = (await getJSON(
      `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false`,
    )) as { quotes?: { symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }[] };
    return (json.quotes ?? [])
      .filter((q) => q.symbol && q.exchange && US_EXCHANGES.has(q.exchange))
      .filter((q) => ["EQUITY", "ETF", "INDEX"].includes(q.quoteType ?? ""))
      .map((q) => ({
        symbol: fromYahoo(q.symbol),
        name: q.longname || q.shortname || q.symbol,
        exchange: EXCHANGES[q.exchange!] ?? q.exchange!,
        type: mapType(q.quoteType),
      }));
  },

  async history(symbol) {
    const c = await chart(symbol, "period1=0&period2=9999999999&interval=1d&events=div%2Csplit&includeAdjustedClose=false");
    const h = parseYahooChart(symbol, c, source());
    if (h.days.length < 2) throw new NotFoundError(symbol);
    return h;
  },

  async quote(symbol) {
    let summary: Record<string, unknown> | null = null;
    try {
      summary = await quoteSummary(symbol, ["price"]);
    } catch {
      summary = null;
    }
    const p = (summary?.price ?? null) as Record<string, unknown> | null;
    if (p && raw(p.regularMarketPrice) != null) {
      const state = marketState(p.marketState as string);
      const delay = Number(p.exchangeDataDelayedBy ?? 0);
      const price = raw(p.regularMarketPrice)!;
      const prev = raw(p.regularMarketPreviousClose) ?? price;
      const asOfSec = Number(p.regularMarketTime ?? 0);
      let extended: Quote["extended"];
      const post = raw(p.postMarketPrice);
      const pre = raw(p.preMarketPrice);
      if (state === "post" && post != null && p.postMarketTime) {
        extended = { label: "After hours", price: post, change: raw(p.postMarketChange) ?? 0, changePercent: (raw(p.postMarketChangePercent) ?? 0) * 100, asOf: new Date(Number(p.postMarketTime) * 1000).toISOString() };
      } else if (state === "pre" && pre != null && p.preMarketTime) {
        extended = { label: "Pre-market", price: pre, change: raw(p.preMarketChange) ?? 0, changePercent: (raw(p.preMarketChangePercent) ?? 0) * 100, asOf: new Date(Number(p.preMarketTime) * 1000).toISOString() };
      }
      const ex = String(p.exchange ?? "");
      return {
        symbol,
        name: String(p.longName ?? p.shortName ?? symbol),
        exchange: EXCHANGES[ex] ?? String(p.exchangeName ?? ex),
        currency: String(p.currency ?? "USD"),
        type: mapType(p.quoteType as string),
        price,
        change: raw(p.regularMarketChange) ?? price - prev,
        changePercent: (raw(p.regularMarketChangePercent) ?? price / prev - 1) * 100,
        previousClose: prev,
        asOf: new Date(asOfSec * 1000).toISOString(),
        freshness: state === "open" ? (delay > 0 ? "delayed" : "real-time") : "previous-close",
        delayMinutes: delay,
        marketState: state,
        extended,
        open: raw(p.regularMarketOpen),
        dayHigh: raw(p.regularMarketDayHigh),
        dayLow: raw(p.regularMarketDayLow),
        volume: raw(p.regularMarketVolume),
        source: source(),
      };
    }
    // Fallback: chart metadata (no crumb needed).
    const c = await chart(symbol, "range=5d&interval=1d");
    const m = c.meta as Record<string, number | string | undefined>;
    const price = Number(m.regularMarketPrice);
    const prev = Number(m.chartPreviousClose ?? m.previousClose ?? price);
    return {
      symbol,
      name: String(m.longName ?? m.shortName ?? symbol),
      exchange: EXCHANGES[String(m.exchangeName)] ?? String(m.fullExchangeName ?? m.exchangeName ?? ""),
      currency: String(m.currency ?? "USD"),
      type: mapType(m.instrumentType as string),
      price,
      change: price - prev,
      changePercent: (price / prev - 1) * 100,
      previousClose: prev,
      asOf: new Date(Number(m.regularMarketTime) * 1000).toISOString(),
      freshness: "delayed",
      delayMinutes: 15,
      marketState: "closed",
      dayHigh: Number(m.regularMarketDayHigh) || undefined,
      dayLow: Number(m.regularMarketDayLow) || undefined,
      volume: Number(m.regularMarketVolume) || undefined,
      source: source(),
    };
  },

  async fundamentals(symbol) {
    const r = await quoteSummary(symbol, [
      "assetProfile",
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "incomeStatementHistory",
      "fundProfile",
      "price",
    ]);
    const ap = (r.assetProfile ?? {}) as Record<string, unknown>;
    const sd = (r.summaryDetail ?? {}) as Record<string, unknown>;
    const ks = (r.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const fd = (r.financialData ?? {}) as Record<string, unknown>;
    const fp = (r.fundProfile ?? {}) as Record<string, unknown>;
    const pr = (r.price ?? {}) as Record<string, unknown>;
    const inc = ((r.incomeStatementHistory as { incomeStatementHistory?: Record<string, unknown>[] } | undefined)
      ?.incomeStatementHistory ?? [])[0];
    const hq = [ap.city, ap.state, ap.country].filter(Boolean).join(", ");
    const fees = (fp.feesExpensesInvestment ?? {}) as Record<string, unknown>;
    const fyEnd = inc?.endDate as { fmt?: string } | undefined;
    const yieldRaw = raw(sd.dividendYield) ?? raw(sd.yield) ?? raw(ks.yield);
    return {
      symbol,
      market: {
        marketCap: raw(pr.marketCap) ?? raw(sd.marketCap),
        peRatio: raw(sd.trailingPE),
        eps: raw(ks.trailingEps),
        dividendYield: yieldRaw,
        fiftyTwoWeekHigh: raw(sd.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: raw(sd.fiftyTwoWeekLow),
        volume: raw(sd.volume) ?? raw(pr.regularMarketVolume),
        avgVolume: raw(sd.averageVolume),
        beta: raw(sd.beta) ?? raw(ks.beta3Year),
        sharesOutstanding: raw(ks.sharesOutstanding),
        expenseRatio: raw(fees.annualReportExpenseRatio) ?? raw(ks.annualReportExpenseRatio),
      },
      profile: {
        description: ap.longBusinessSummary as string | undefined,
        sector: (ap.sectorDisp ?? ap.sector) as string | undefined,
        industry: (ap.industryDisp ?? ap.industry) as string | undefined,
        headquarters: hq || undefined,
        website: ap.website as string | undefined,
        employees: typeof ap.fullTimeEmployees === "number" ? ap.fullTimeEmployees : undefined,
        founded: foundedYear(ap.longBusinessSummary),
        category: fp.categoryName as string | undefined,
        fundFamily: fp.family as string | undefined,
      },
      financials: {
        fiscalYearEnd: fyEnd?.fmt,
        revenue: raw(fd.totalRevenue) ?? raw(inc?.totalRevenue),
        revenueGrowth: raw(fd.revenueGrowth),
        netIncome: raw(inc?.netIncome) ?? raw(ks.netIncomeToCommon),
        operatingMargin: raw(fd.operatingMargins),
        freeCashFlow: raw(fd.freeCashflow),
        totalDebt: raw(fd.totalDebt),
        cash: raw(fd.totalCash),
      },
      source: source(),
    };
  },

  async intraday(symbol, range) {
    const interval = range === "1d" ? "5m" : "15m";
    const c = await chart(symbol, `range=${range}&interval=${interval}&includePrePost=false`);
    const ts = c.timestamp ?? [];
    const q = c.indicators.quote[0];
    const bars = ts
      .map((t, i) => ({ t, c: q.close[i] as number, v: (q.volume[i] ?? 0) as number }))
      .filter((b) => b.c != null && Number.isFinite(b.c));
    return {
      symbol,
      bars,
      previousClose: Number(c.meta.chartPreviousClose ?? c.meta.previousClose) || undefined,
      source: source(),
    };
  },
};

async function quoteSummary(symbol: string, modules: string[]): Promise<Record<string, unknown>> {
  for (const force of [false, true]) {
    const { crumb, cookie } = await getCrumb(force);
    const res = await fetch(
      `${HOSTS[1]}/v10/finance/quoteSummary/${encodeURIComponent(toYahoo(symbol))}?modules=${modules.join(",")}&crumb=${encodeURIComponent(crumb)}`,
      { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    if (res.status === 401 || res.status === 403) continue; // stale crumb → refresh once
    if (res.status === 404) throw new NotFoundError(symbol);
    if (!res.ok) throw new Error(`Yahoo quoteSummary ${res.status}`);
    const json = (await res.json()) as { quoteSummary: { result?: Record<string, unknown>[] } };
    const r = json.quoteSummary.result?.[0];
    if (!r) throw new NotFoundError(symbol);
    return r;
  }
  throw new Error("Yahoo quoteSummary unauthorized");
}

function foundedYear(text: unknown): number | undefined {
  if (typeof text !== "string") return undefined;
  const m = /\b(?:founded|incorporated|established) in (\d{4})\b/i.exec(text);
  const y = m ? Number(m[1]) : NaN;
  return y > 1600 && y <= new Date().getFullYear() ? y : undefined;
}
