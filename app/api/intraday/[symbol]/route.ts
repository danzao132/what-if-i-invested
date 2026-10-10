import { getIntraday } from "@/lib/data";
import { json, symbolRoute } from "@/lib/http";

export const GET = symbolRoute("intraday", 120, async (symbol, req) => {
  const range = req.nextUrl.searchParams.get("range") === "5d" ? "5d" : "1d";
  return json(await getIntraday(symbol, range), 60);
});
