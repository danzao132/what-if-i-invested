import type { NextRequest } from "next/server";
import { search } from "@/lib/data";
import { error, json, rateLimited } from "@/lib/http";

export async function GET(req: NextRequest) {
  if (rateLimited(req, "search", 180)) return error(429, "Too many requests — please slow down.");
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 40).trim();
  if (!q) return json([], 3600);
  if (!/^[\p{L}\p{N}\s.&'^-]+$/u.test(q)) return error(400, "Invalid search.");
  return json(await search(q), 3600);
}
