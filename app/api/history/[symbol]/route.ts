import { getHistory } from "@/lib/data";
import { json, symbolRoute } from "@/lib/http";
import { encodeHistory } from "@/lib/wire";

export const GET = symbolRoute("history", 60, async (symbol) => json(encodeHistory(await getHistory(symbol)), 3600));
