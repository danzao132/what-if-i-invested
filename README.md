# What If I Invested?

**Pick an amount. Pick a date. Discover what could have been.**

A stock-market time machine: search any US-listed stock or ETF, drag the **Time Machine** dial through its history, and watch what a hypothetical investment would be worth today. Every number comes from real historical prices and one tested calculation engine.

## Features

| Experience | Route | What it does |
|---|---|---|
| Home | `/` | Hero search, the full Time Machine (Apple, $1,000, 10Y by default), popular stocks, fascinating historical investments, biggest winners and "not every investment wins" (all computed live) |
| Time Machine | `/time-machine?symbol=NVDA&amount=1000&date=2016-10-07` | Dedicated, shareable Time Machine with URL sync |
| Explore / stock pages | `/explore`, `/stock/AAPL` | Quote header (real-time / delayed / at-close with timestamp), Time Machine, price chart (1D–MAX with volume), price vs. total-return performance table, key stats, company profile, financials |
| Regret Calculator | `/regret` | 12 purchase presets (launch prices vs. estimates labelled) vs. investing the same money |
| Parallel Universe | `/parallel?symbols=AAPL,MSFT,GOOGL&amount=10000&date=2016-10-07` | Up to 10 tickers, presets (Tech Giants, Chip Wars, EV Race, Index Battle, Magnificent Seven), sortable table / mobile cards, ranked bars, multi-line chart with toggles |
| Methodology | `/methodology` | Plain-English formulas and assumptions |
| Share images | `/api/og?...` | 1200×630 PNG cards for every experience (also used as Open Graph images) |

### The Time Machine (signature interaction)

- The price chart and the slider share **one horizontal time scale**, so the dashed marker runs from the purchase point on the curve straight down into the dial.
- The whole history is fetched **once** per symbol and prepared in memory (split-adjusted price + total-return index). Dragging is pure local math — a binary search and two array reads — and is rAF-throttled. No network requests while dragging.
- The big number eases toward its target by writing straight to the DOM (no per-frame React renders). Reduced-motion users get instant updates.
- Mobile: `touch-action: none` on the track (no accidental page scroll), a 44px handle, a 56px-tall hit area, a floating date label that also shows the value while you drag, and light haptic ticks at year boundaries on Android.
- Accessibility: `role="slider"` with spoken value text ("Oct 10, 2016: $1,000 would be $11,603 today"). ← → move one trading day, PgUp/PgDn about a month, Shift+arrows about a year, Home/End. The sentence's date and the **Custom** chip also open a native date picker.
- Stock splits from the data feed show as small dots on the timeline (hover for details). No events are invented.
- Auto log scale when a stock has grown more than 40×, with a manual toggle.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev           # http://localhost:3000
npm test              # calculation engine tests (vitest)
npm run build && npm start
```

Works with **no API keys**. See the data section below before launching publicly.

## Market data — ⚠️ read before going public

The app talks to data through a provider interface (`lib/data/provider.ts`). Switch providers with `MARKET_DATA_PROVIDER`:

| Value | Keys | Use for |
|---|---|---|
| `yahoo` (default) | none | **Development and personal use only.** Undocumented Yahoo Finance endpoints, whose terms restrict them to personal, non-commercial use. |
| `tiingo` | `TIINGO_API_KEY` | Licensed source for daily prices, splits, dividends and IEX quotes (adapter included and unit-tested). |
| `fixtures` | none | Offline demo: bundled **real** data snapshots for 22 tickers (see `data/fixtures`). Every price is labelled *Demo snapshot* with its capture date. |

If the live provider fails, the app falls back to the demo snapshot (labelled) for tickers it has. Set `DEMO_FALLBACK=off` to disable this.

### Provider evaluation

Please confirm current pricing and redistribution terms with each vendor. Plans change, and **displaying data on a public website needs an explicit display/redistribution licence from most vendors**, often on business-tier plans.

| | Historical depth | Splits & dividends | Quotes | ETFs | Fundamentals | Notes |
|---|---|---|---|---|---|---|
| **Tiingo** | Decades of US EOD | Yes (`splitFactor`, `divCash`) | IEX real-time | Yes | Add-on | Good value for prices; public display needs a commercial licence |
| **Massive (formerly Polygon)** | Long US history | Dedicated endpoints | Real-time on paid tiers | Yes | Yes | Strong all-in-one choice; check display licence |
| **Financial Modeling Prep** | Long US history | Yes | Delayed / real-time by tier | Yes | Very broad | Good fit for the fundamentals tab |
| **Twelve Data** | Good, international | Yes | Real-time by tier | Yes | Partial | Good if you expand internationally |

**Recommendation:** use Tiingo (prices, splits, dividends) plus FMP (fundamentals) under commercial licences, or Massive alone if you want real-time quotes from one vendor. To add a provider, implement `MarketDataProvider` and its split adjustment (see `lib/data/tiingo-adjust.ts`), then add one case in `lib/data/index.ts`. The adapter must return closes **split-adjusted but not dividend-adjusted**, plus dividends on the same basis. The engine handles everything else.

### Caching and safety

- In-process TTL/LRU caches (history 3h, quotes 60s, fundamentals 12h, search 24h) and concurrent-request de-duplication.
- API routes send `s-maxage` / `stale-while-revalidate`, so Vercel's CDN absorbs repeat traffic.
- API keys are only read on the server (`server-only` modules).
- Every route validates its ticker (`normalizeSymbol`) and is rate-limited per IP. The limiter is in-memory per instance; for multi-region production, back it with Upstash/Redis.

## Calculation engine

`lib/engine/` is pure TypeScript with no framework imports.

- **Price return:** `value = amount × close[end] / close[start]` on split-adjusted closes. Fractional shares.
- **Total return:** `tr[i] = tr[i−1] × (close[i] + dividend[i]) / close[i−1]`, so dividends are reinvested at the ex-date close and counted exactly once. Buying on the ex-date earns no dividend. Disabled when dividends aren't reliable (e.g. indices).
- **CAGR:** `(value / amount)^(1/years) − 1`, years = elapsed days / 365.2425. Hidden under one year.
- **Dates:** weekends and holidays roll forward to the next trading day (always disclosed). Dates before listing return `before-listing` and are never silently moved. Parallel Universe values every row on a common final date.
- **Lookbacks:** calendar months/years from the last close. YTD is measured from the prior year's last close. Periods longer than the available history show "not enough history".

### Tests (`tests/engine.test.ts`, 23 tests, run against the bundled real data)

- Formula, dividend reinvestment, ex-date entitlement, unreliable-dividend fallback, CAGR timing, input validation
- Tiingo split adjustment
- **Independently anchored splits:** AAPL's published pre-split close of $499.23 (2020-08-28, 4:1), NVDA's $1,208.88 (2024-06-07, 10:1), and Citigroup's 1:10 reverse split (2011)
- Apple 10Y, Nvidia 10Y, **SPY 20Y and Coca-Cola 30Y total return cross-checked against Yahoo's independent dividend adjustment** (within 1.5% and 3%; the two conventions differ slightly)
- Weekend date, market holiday (Christmas 2020), recent IPO (ARM, pre-listing rejected), negative return (Peloton 2021), multi-stock comparison with identical dates

Refresh the snapshots with `npm run snapshot` (or `node scripts/snapshot-fixtures.mjs AAPL MSFT`). Tests use sanity bands rather than exact present-day values, so they keep passing as data updates.

## Deploying (Vercel)

1. Push the repo and import it in Vercel (framework: Next.js).
2. Set the environment variables: `MARKET_DATA_PROVIDER`, the provider key, and `NEXT_PUBLIC_SITE_URL=https://your-domain` (used for absolute Open Graph URLs).
3. Deploy. `next.config.ts` already includes `data/fixtures` in the serverless bundle for the demo fallback.

The site runs on any Node 20+ host (`npm run build && npm start`).

## Project layout

```
app/                    routes (pages + /api/*)
components/
  time-machine/         TimeMachine, TimelineStage (chart + slider), InvestmentValueChart
  stock/                StockHeader, StockPriceChart, HistoricalPerformance, StockFundamentals
  parallel/ regret/     the two comparison experiences
  charts/LineChart.tsx  dependency-free SVG chart (scrub tooltips, log scale, volume)
  StockSearch, ShareResult, SiteHeader (+ MobileNavigation), ThemeToggle
lib/
  engine/               dates, series preparation, calculations  ← unit-tested
  data/                 provider interface, yahoo / tiingo / fixtures adapters, cache facade, universe
  discovery.ts          server-computed homepage content
  scenario.ts wire.ts   URL state + compact history encoding
data/fixtures/          real-data snapshots (tests + demo mode)
```

## Known limitations and next steps

- **Founding year** appears only when the provider's company profile states it. We don't add facts ourselves.
- Intraday 1D/5D charts and fundamentals come from the Yahoo adapter. The Tiingo adapter shows "not available" until a fundamentals source is licensed.
- Logos are favicons from each company's own domain, with a monogram fallback.
- Delisted companies depend on provider coverage (survivorship bias is noted on the winners list).
- Built for future additions: recurring investments (`valuePath` already returns the daily path), portfolios (sum several `computeInvestment` results), milestones (scan `valuePath`), inflation adjustment (divide by CPI on the same dates), saved scenarios (URLs already encode them).

---
For education and entertainment only. Hypothetical results exclude taxes, fees and inflation. Past performance does not predict future results. Not investment advice.
