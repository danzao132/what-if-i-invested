#!/usr/bin/env node
// Captures REAL daily history from the Yahoo chart endpoint into
// data/fixtures/<SYMBOL>.json. The fixtures power (a) the automated
// calculation tests and (b) the offline "demo snapshot" provider.
//
//   node scripts/snapshot-fixtures.mjs            # default symbol set
//   node scripts/snapshot-fixtures.mjs AAPL MSFT  # specific symbols
//
// Nothing here is synthesised: values are stored exactly as returned (closes
// trimmed to 8 significant digits). `adjclose` is stored only so tests can
// cross-check our own total-return math against an independent adjustment.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT = [
  "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "TSLA", "META", "NFLX", "BRK.B", "KO",
  "SPY", "QQQ", "AMD", "INTC", "F", "GM", "C", "ARM", "PTON", "CSCO", "SBUX", "SONY",
];
const symbols = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "fixtures");
await mkdir(outDir, { recursive: true });

const sig = (v) => (v == null ? null : Number(v.toPrecision(8)));

for (const symbol of symbols) {
  const y = symbol.replace(".", "-");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?period1=0&period2=9999999999&interval=1d&events=div%2Csplit&includeAdjustedClose=true`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) {
    console.error(`${symbol}: HTTP ${res.status}`);
    continue;
  }
  const r = (await res.json()).chart.result[0];
  const m = r.meta;
  const fixture = {
    capturedAt: new Date().toISOString(),
    source: "Yahoo Finance chart endpoint (unofficial)",
    chart: {
      meta: {
        symbol: m.symbol,
        currency: m.currency,
        gmtoffset: m.gmtoffset,
        instrumentType: m.instrumentType,
        firstTradeDate: m.firstTradeDate,
        longName: m.longName,
        shortName: m.shortName,
        exchangeName: m.exchangeName,
        fullExchangeName: m.fullExchangeName,
        regularMarketPrice: m.regularMarketPrice,
        regularMarketTime: m.regularMarketTime,
        chartPreviousClose: m.chartPreviousClose,
      },
      timestamp: r.timestamp,
      indicators: {
        quote: [{ close: r.indicators.quote[0].close.map(sig), volume: r.indicators.quote[0].volume }],
      },
      events: r.events ?? {},
    },
    adjclose: r.indicators.adjclose?.[0]?.adjclose?.map(sig) ?? null,
  };
  await writeFile(join(outDir, `${symbol}.json`), JSON.stringify(fixture));
  console.log(`${symbol}: ${r.timestamp.length} bars`);
  await new Promise((r) => setTimeout(r, 400));
}
