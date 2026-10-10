/**
 * Regret Calculator presets. `priceBasis` is shown next to every price:
 *  - "launch": the widely reported US launch price (MSRP) of that product.
 *  - "estimate": an illustrative typical cost, clearly labelled as such.
 */
export interface RegretPreset {
  id: string;
  category: string;
  emoji: string;
  item: string;
  amount: number;
  date: string;
  symbol: string;
  priceBasis: "launch" | "estimate";
  note?: string;
}

export const REGRET_PRESETS: RegretPreset[] = [
  { id: "phone", category: "Smartphones", emoji: "📱", item: "iPhone 7 (32GB)", amount: 649, date: "2016-09-16", symbol: "AAPL", priceBasis: "launch" },
  { id: "car", category: "Cars", emoji: "🚗", item: "A new mid-size car", amount: 30000, date: "2016-01-04", symbol: "F", priceBasis: "estimate" },
  { id: "vacation", category: "Vacations", emoji: "🏝️", item: "A week-long vacation", amount: 3500, date: "2018-06-01", symbol: "BKNG", priceBasis: "estimate" },
  { id: "concert", category: "Concert tickets", emoji: "🎤", item: "Two concert tickets", amount: 250, date: "2019-07-01", symbol: "LYV", priceBasis: "estimate" },
  { id: "coffee", category: "Coffee", emoji: "☕", item: "A $5 latte every workday for a year", amount: 1250, date: "2016-01-04", symbol: "SBUX", priceBasis: "estimate", note: "250 workdays × $5, treated as one lump sum on the start date." },
  { id: "sneakers", category: "Sneakers", emoji: "👟", item: "Limited-edition sneakers", amount: 220, date: "2017-09-01", symbol: "NKE", priceBasis: "estimate" },
  { id: "console", category: "Gaming consoles", emoji: "🎮", item: "PlayStation 4", amount: 399, date: "2013-11-15", symbol: "SONY", priceBasis: "launch" },
  { id: "designer", category: "Designer clothing", emoji: "🧥", item: "A designer jacket", amount: 1500, date: "2015-11-27", symbol: "RL", priceBasis: "estimate" },
  { id: "watch", category: "Luxury watches", emoji: "⌚", item: "A luxury watch", amount: 8000, date: "2014-04-01", symbol: "SPY", priceBasis: "estimate", note: "No major Swiss watchmaker trades on a US exchange, so we suggest the S&P 500." },
  { id: "dinner", category: "Restaurant meals", emoji: "🍝", item: "A fancy dinner for two", amount: 300, date: "2019-02-14", symbol: "CMG", priceBasis: "estimate" },
  { id: "tv", category: "Home electronics", emoji: "📺", item: "A 65-inch TV", amount: 1500, date: "2017-11-24", symbol: "BBY", priceBasis: "estimate" },
  { id: "custom", category: "Custom purchase", emoji: "✨", item: "Something I bought", amount: 500, date: "2020-01-02", symbol: "SPY", priceBasis: "estimate" },
];
