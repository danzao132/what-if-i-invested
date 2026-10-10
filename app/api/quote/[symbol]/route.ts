import { getQuote } from "@/lib/data";
import { json, symbolRoute } from "@/lib/http";

export const GET = symbolRoute("quote", 240, async (symbol) => json(await getQuote(symbol), 30));
