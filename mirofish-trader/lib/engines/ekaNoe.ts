import type { Quote } from "../types";

export interface EkaNoeReport {
  ticker: string;
  price: number;
  changePct: number;
  technicals: {
    // stubbed — fill in RSI/MACD/EMA once we wire a real technicals provider
    trend: "up" | "down" | "flat";
    notes: string;
  };
}

// Eka Noe = market data + technicals engine.
// For the scaffold we just wrap the quote; the Claude call gets richer input later.
export function runEkaNoe(quote: Quote): EkaNoeReport {
  const trend = quote.changePct > 0.5 ? "up" : quote.changePct < -0.5 ? "down" : "flat";
  return {
    ticker: quote.ticker,
    price: quote.price,
    changePct: quote.changePct,
    technicals: {
      trend,
      notes: `Δ ${quote.changePct.toFixed(2)}% vs prev close ${quote.previousClose}`,
    },
  };
}
