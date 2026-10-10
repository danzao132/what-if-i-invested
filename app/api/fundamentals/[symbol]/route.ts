import { getFundamentals } from "@/lib/data";
import { json, symbolRoute } from "@/lib/http";

export const GET = symbolRoute("fundamentals", 60, async (symbol) => json(await getFundamentals(symbol), 6 * 3600));
