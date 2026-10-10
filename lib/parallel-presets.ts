/** Parallel Universe preset comparisons (shared by the server page and the client UI). */
export const PRESETS: { id: string; name: string; symbols: string[] }[] = [
  { id: "tech", name: "Tech Giants", symbols: ["AAPL", "MSFT", "GOOGL"] },
  { id: "chips", name: "Chip Wars", symbols: ["NVDA", "AMD", "INTC"] },
  { id: "ev", name: "Electric Car Race", symbols: ["TSLA", "F", "GM"] },
  { id: "index", name: "Index Battle", symbols: ["SPY", "QQQ", "BRK.B"] },
  { id: "mag7", name: "Magnificent Seven", symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"] },
  { id: "classic", name: "The Big Ten", symbols: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "TSLA", "BRK.B", "SPY", "QQQ", "KO"] },
];
