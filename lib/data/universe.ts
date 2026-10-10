import type { AssetType, SearchResult } from "../types";

export interface UniverseEntry extends SearchResult {
  /** Company website domain, used for the favicon-style logo. */
  domain?: string;
  aliases?: string[];
}

const e = (symbol: string, name: string, exchange: string, type: AssetType, domain?: string, aliases?: string[]): UniverseEntry => ({
  symbol,
  name,
  exchange,
  type,
  domain,
  aliases,
});

/**
 * A curated list of well-known US listings. Powers instant autocomplete
 * (before the provider's search responds) and the discovery sections.
 * Symbols use the provider-neutral class separator "." (BRK.B).
 */
export const UNIVERSE: UniverseEntry[] = [
  e("AAPL", "Apple Inc.", "NASDAQ", "EQUITY", "apple.com", ["iphone"]),
  e("NVDA", "NVIDIA Corporation", "NASDAQ", "EQUITY", "nvidia.com"),
  e("MSFT", "Microsoft Corporation", "NASDAQ", "EQUITY", "microsoft.com"),
  e("AMZN", "Amazon.com, Inc.", "NASDAQ", "EQUITY", "amazon.com"),
  e("GOOGL", "Alphabet Inc. (Class A)", "NASDAQ", "EQUITY", "abc.xyz", ["google"]),
  e("TSLA", "Tesla, Inc.", "NASDAQ", "EQUITY", "tesla.com"),
  e("META", "Meta Platforms, Inc.", "NASDAQ", "EQUITY", "meta.com", ["facebook", "instagram"]),
  e("NFLX", "Netflix, Inc.", "NASDAQ", "EQUITY", "netflix.com"),
  e("BRK.B", "Berkshire Hathaway Inc. (Class B)", "NYSE", "EQUITY", "berkshirehathaway.com", ["buffett"]),
  e("KO", "The Coca-Cola Company", "NYSE", "EQUITY", "coca-colacompany.com", ["coke"]),
  e("SPY", "SPDR S&P 500 ETF Trust", "NYSE Arca", "ETF", "ssga.com", ["s&p 500", "s&p"]),
  e("QQQ", "Invesco QQQ Trust", "NASDAQ", "ETF", "invesco.com", ["nasdaq 100"]),
  e("VOO", "Vanguard S&P 500 ETF", "NYSE Arca", "ETF", "vanguard.com"),
  e("AMD", "Advanced Micro Devices, Inc.", "NASDAQ", "EQUITY", "amd.com"),
  e("INTC", "Intel Corporation", "NASDAQ", "EQUITY", "intel.com"),
  e("F", "Ford Motor Company", "NYSE", "EQUITY", "ford.com"),
  e("GM", "General Motors Company", "NYSE", "EQUITY", "gm.com"),
  e("DIS", "The Walt Disney Company", "NYSE", "EQUITY", "disney.com"),
  e("NKE", "NIKE, Inc.", "NYSE", "EQUITY", "nike.com"),
  e("SBUX", "Starbucks Corporation", "NASDAQ", "EQUITY", "starbucks.com", ["coffee"]),
  e("MCD", "McDonald's Corporation", "NYSE", "EQUITY", "mcdonalds.com"),
  e("COST", "Costco Wholesale Corporation", "NASDAQ", "EQUITY", "costco.com"),
  e("WMT", "Walmart Inc.", "NYSE", "EQUITY", "walmart.com"),
  e("JPM", "JPMorgan Chase & Co.", "NYSE", "EQUITY", "jpmorganchase.com"),
  e("V", "Visa Inc.", "NYSE", "EQUITY", "visa.com"),
  e("SONY", "Sony Group Corporation", "NYSE", "EQUITY", "sony.com", ["playstation"]),
  e("CSCO", "Cisco Systems, Inc.", "NASDAQ", "EQUITY", "cisco.com"),
  e("PTON", "Peloton Interactive, Inc.", "NASDAQ", "EQUITY", "onepeloton.com"),
  e("C", "Citigroup Inc.", "NYSE", "EQUITY", "citigroup.com"),
  e("ARM", "Arm Holdings plc", "NASDAQ", "EQUITY", "arm.com"),
  e("LYV", "Live Nation Entertainment, Inc.", "NYSE", "EQUITY", "livenationentertainment.com", ["concert", "ticketmaster"]),
  e("BKNG", "Booking Holdings Inc.", "NASDAQ", "EQUITY", "bookingholdings.com", ["travel"]),
  e("RL", "Ralph Lauren Corporation", "NYSE", "EQUITY", "ralphlauren.com"),
  e("BBY", "Best Buy Co., Inc.", "NYSE", "EQUITY", "bestbuy.com"),
  e("CMG", "Chipotle Mexican Grill, Inc.", "NYSE", "EQUITY", "chipotle.com"),
  e("^GSPC", "S&P 500 Index", "INDEX", "INDEX", undefined, ["s&p 500 index"]),
  e("^IXIC", "NASDAQ Composite Index", "INDEX", "INDEX"),
  e("^DJI", "Dow Jones Industrial Average", "INDEX", "INDEX", undefined, ["dow"]),
];

const BY_SYMBOL = new Map(UNIVERSE.map((u) => [u.symbol, u]));

export function universeEntry(symbol: string): UniverseEntry | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export const POPULAR = ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "TSLA", "META", "NFLX", "BRK.B", "KO"];

export function searchUniverse(q: string, limit = 8): SearchResult[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const scored: { u: UniverseEntry; score: number }[] = [];
  for (const u of UNIVERSE) {
    const sym = u.symbol.toLowerCase();
    const name = u.name.toLowerCase();
    let score = 0;
    if (sym === query) score = 100;
    else if (sym.startsWith(query)) score = 80 - sym.length;
    else if (name.startsWith(query)) score = 60;
    else if (name.split(/[\s.,()]+/).some((w) => w.startsWith(query))) score = 45;
    else if (u.aliases?.some((a) => a.startsWith(query))) score = 40;
    else if (name.includes(query)) score = 20;
    if (score) scored.push({ u, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ u }) => ({ symbol: u.symbol, name: u.name, exchange: u.exchange, type: u.type }));
}

/** Validates user-supplied tickers before they reach a provider. */
export function normalizeSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = decodeURIComponent(raw).trim().toUpperCase().replace(/-/g, ".");
  return /^\^?[A-Z0-9]{1,6}(\.[A-Z]{1,2})?$/.test(s) ? s : null;
}
