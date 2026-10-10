import { dayFromISO } from "../engine/dates";
import type { DataSourceInfo, Dividend, PriceHistory, Split } from "../types";

export interface EodRow {
  date: string;
  close: number;
  volume: number;
  divCash: number;
  splitFactor: number;
}

export function adjustTiingoRows(symbol: string, rows: EodRow[], src: DataSourceInfo): PriceHistory {
  const n = rows.length;
  const days = rows.map((r) => dayFromISO(r.date.slice(0, 10)));
  const close = new Array<number>(n);
  const volume = new Array<number>(n);
  const dividends: Dividend[] = [];
  const splits: Split[] = [];
  let factor = 1; // cumulative split factor for bars strictly before the current split
  for (let i = n - 1; i >= 0; i--) {
    const r = rows[i];
    close[i] = r.close / factor;
    volume[i] = r.volume * factor;
    if (r.divCash > 0) dividends.push({ day: days[i], amount: r.divCash / factor });
    if (r.splitFactor && r.splitFactor !== 1) {
      splits.push({ day: days[i], ratio: r.splitFactor });
      factor *= r.splitFactor;
    }
  }
  return {
    symbol,
    currency: "USD",
    days,
    close,
    volume,
    dividends: dividends.reverse(),
    splits: splits.reverse(),
    dividendsReliable: true,
    source: src,
  };
}

