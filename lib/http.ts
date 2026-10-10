import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeSymbol } from "./data/universe";
import { NotFoundError } from "./data/provider";

/**
 * Per-instance sliding-window rate limiter. Good enough to stop a single
 * client hammering the upstream provider; put a shared store (e.g. Upstash)
 * behind this for multi-region production.
 */
const hits = new Map<string, number[]>();
export function rateLimited(req: NextRequest, bucket: string, limit = 120, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > limit;
}

export function json(data: unknown, sMaxAge: number, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}`,
      ...(init?.headers ?? {}),
    },
  });
}

export function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

type Ctx = { params: Promise<{ symbol: string }> };

/** Wraps a symbol route with validation, rate limiting and error mapping. */
export function symbolRoute(bucket: string, limit: number, handler: (symbol: string, req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx) => {
    if (rateLimited(req, bucket, limit)) return error(429, "Too many requests — please slow down.");
    const symbol = normalizeSymbol((await ctx.params).symbol);
    if (!symbol) return error(400, "Invalid ticker symbol.");
    try {
      return await handler(symbol, req);
    } catch (err) {
      if (err instanceof NotFoundError) return error(404, `We couldn't find market data for ${symbol}.`);
      console.error(`[api:${bucket}]`, symbol, err);
      return error(502, "Market data is temporarily unavailable.");
    }
  };
}
