import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { computeInvestment } from "@/lib/engine/calc";
import { sampleIndices } from "@/lib/engine/series";
import { getPrepared } from "@/lib/discovery";
import { getQuote } from "@/lib/data";
import { normalizeSymbol, universeEntry } from "@/lib/data/universe";
import { fmtDay, money, pct } from "@/lib/format";
import { parseAmount, parseScenario } from "@/lib/scenario";
import { rateLimited } from "@/lib/http";
import { dayFromISO } from "@/lib/engine/dates";

export const runtime = "nodejs";

const W = 1200;
const H = 630;
const BG = "#0a0b14";
const INK = "#f3f1ea";
const INK3 = "#8b8da1";
const AMBER = "#ffb547";
const VIOLET = "#9186ff";
const GAIN = "#3ddc97";
const LOSS = "#ff8a7a";

function Frame({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: BG, color: INK, padding: 64, fontFamily: "sans-serif", position: "relative" }}>
      <div style={{ position: "absolute", right: -200, top: -260, width: 760, height: 760, borderRadius: 999, background: "radial-gradient(circle, rgba(255,181,71,0.22), transparent 65%)", display: "flex" }} />
      <div style={{ position: "absolute", left: -260, bottom: -320, width: 760, height: 760, borderRadius: 999, background: "radial-gradient(circle, rgba(145,134,255,0.22), transparent 65%)", display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(45deg, ${VIOLET}, ${AMBER})`, display: "flex" }} />
        <span style={{ display: "flex" }}>
          What If I Invested<span style={{ color: AMBER }}>?</span>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", fontSize: 20, color: INK3 }}>{footer}</div>
    </div>
  );
}

function spark(values: number[], up: boolean) {
  const w = 1072, h = 120;
  const lo = Math.min(...values), hi = Math.max(...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / (hi - lo || 1)) * h).toFixed(1)}`).join("");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 28 }}>
      <path d={d} fill="none" stroke={up ? GAIN : LOSS} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

async function timeMachineCard(req: NextRequest) {
  const sc = parseScenario(req.nextUrl.searchParams);
  const s = await getPrepared(sc.symbol);
  const day = sc.day ?? s.days[Math.max(0, s.days.length - 2521)];
  const r = computeInvestment(s, sc.amount, day, sc.mode);
  const name = (await getQuote(sc.symbol).then((q) => q.name).catch(() => null)) ?? universeEntry(sc.symbol)?.name ?? sc.symbol;
  if (r.status !== "ok") {
    return (
      <Frame footer="Hypothetical. Not investment advice.">
        <div style={{ fontSize: 64, fontWeight: 800 }}>{name} wasn&apos;t trading yet on that date.</div>
      </Frame>
    );
  }
  const up = r.gain >= 0;
  const values = sampleIndices(r.startIndex, r.endIndex, 120).map((i) => (r.effectiveMode === "total" && s.tr ? s.tr[i] : s.price[i]));
  return (
    <Frame footer={`${r.effectiveMode === "total" ? "Total return, dividends reinvested" : "Price return, split-adjusted closes"} · valued at the ${fmtDay(r.endDay)} close · excludes taxes & fees · not investment advice`}>
      <div style={{ fontSize: 36, color: INK3, display: "flex" }}>
        {money(r.amount)} in {name} ({sc.symbol}) on {fmtDay(r.startDay)} would be
      </div>
      <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -4, lineHeight: 1.05, display: "flex" }}>{money(r.value)}</div>
      <div style={{ display: "flex", gap: 18, fontSize: 36, marginTop: 6 }}>
        <span style={{ color: up ? GAIN : LOSS, fontWeight: 700 }}>{pct(r.totalReturn)}</span>
        <span style={{ color: INK3 }}>·</span>
        <span>{money(r.gain, { sign: true })}</span>
        {r.cagr != null && <span style={{ color: INK3 }}>· {pct(r.cagr)}/yr over {r.durationLabel}</span>}
      </div>
      {spark(values, up)}
    </Frame>
  );
}

async function regretCard(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbol = normalizeSymbol(p.get("symbol")) ?? "AAPL";
  const amount = parseAmount(p.get("amount"), 1000);
  const item = (p.get("item") ?? "that purchase").slice(0, 60);
  const day = dayFromISO(p.get("date") ?? "");
  const s = await getPrepared(symbol);
  const r = computeInvestment(s, amount, day, "price");
  const ok = r.status === "ok";
  return (
    <Frame footer="The Regret Calculator · hypothetical price return · not investment advice">
      <div style={{ display: "flex", gap: 32 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 36, borderRadius: 32, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", fontSize: 24, color: INK3, letterSpacing: 3 }}>WHAT YOU BOUGHT</div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700, marginTop: 16 }}>{item}</div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, marginTop: 12 }}>{money(amount)}</div>
          <div style={{ display: "flex", fontSize: 26, color: INK3, marginTop: 8 }}>{ok ? fmtDay(r.startDay) : ""}</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 36, borderRadius: 32, background: "rgba(255,181,71,0.12)", border: `2px solid ${AMBER}` }}>
          <div style={{ display: "flex", fontSize: 24, color: AMBER, letterSpacing: 3 }}>COULD HAVE BECOME</div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700, marginTop: 16 }}>in {symbol} stock</div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, marginTop: 12 }}>{ok ? money(r.value) : "—"}</div>
          <div style={{ display: "flex", fontSize: 26, color: ok && r.gain >= 0 ? GAIN : LOSS, marginTop: 8 }}>{ok ? `${pct(r.totalReturn)} by ${fmtDay(r.endDay)}` : "Not trading on that date"}</div>
        </div>
      </div>
    </Frame>
  );
}

async function parallelCard(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbols = (p.get("symbols") ?? "").split(",").map(normalizeSymbol).filter((x): x is string => !!x).slice(0, 10);
  const amount = parseAmount(p.get("amount"), 10000);
  const day = dayFromISO(p.get("date") ?? "");
  const rows = (
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const r = computeInvestment(await getPrepared(sym), amount, day, p.get("mode") === "total" ? "total" : "price");
          return r.status === "ok" ? { sym, r } : null;
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.r.value - a.r.value)
    .slice(0, 6);
  const max = Math.max(...rows.map((x) => x.r.value), 1);
  const colors = [AMBER, VIOLET, GAIN, "#ff7eb0", "#5cb8ff", "#d4b483"];
  return (
    <Frame footer={`Parallel Universe · same amount, same start date · ${rows[0] ? `valued at the ${fmtDay(rows[0].r.endDay)} close` : ""} · not investment advice`}>
      <div style={{ fontSize: 40, fontWeight: 700, display: "flex" }}>
        {money(amount)} invested on {Number.isFinite(day) && rows[0] ? fmtDay(rows[0].r.startDay) : "the same day"}…
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
        {rows.map((x, i) => (
          <div key={x.sym} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
            <div style={{ width: 120, fontWeight: 700, display: "flex" }}>{x.sym}</div>
            <div style={{ display: "flex", flex: 1 }}>
              <div style={{ width: `${Math.max(2, (x.r.value / max) * 100)}%`, height: 40, borderRadius: 12, background: colors[i] }} />
            </div>
            <div style={{ width: 230, textAlign: "right", fontWeight: 700, display: "flex", justifyContent: "flex-end" }}>{money(x.r.value)}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export async function GET(req: NextRequest) {
  if (rateLimited(req, "og", 40)) return new Response("Too many requests", { status: 429 });
  const type = req.nextUrl.searchParams.get("type");
  let node: React.ReactElement;
  try {
    if (type === "regret") node = await regretCard(req);
    else if (type === "parallel") node = await parallelCard(req);
    else if (req.nextUrl.searchParams.get("symbol")) node = await timeMachineCard(req);
    else
      node = (
        <Frame footer="Real historical prices · split-adjusted · no sign-up">
          <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: -3, display: "flex" }}>What if I invested?</div>
          <div style={{ fontSize: 40, color: INK3, marginTop: 12, display: "flex" }}>Pick an amount. Pick a date. Discover what could have been.</div>
        </Frame>
      );
  } catch {
    node = (
      <Frame footer="What If I Invested?">
        <div style={{ fontSize: 64, fontWeight: 800 }}>Pick an amount. Pick a date.</div>
      </Frame>
    );
  }
  return new ImageResponse(node, { width: W, height: H, headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
