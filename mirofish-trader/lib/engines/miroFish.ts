import type { Quote } from "../types";

export interface MiroFishReport {
  ticker: string;
  score: number;        // -100 bearish ... +100 bullish
  prediction: string;
  summary: string;
}

// MiroFish = crowd sentiment simulation. Real implementation will fan out to
// social / news and score. For the scaffold we derive a coarse score from the
// price move so the downstream Claude step has a realistic shape.
export function runMiroFish(quote: Quote): MiroFishReport {
  const score = Math.max(-100, Math.min(100, quote.changePct * 20));
  const prediction =
    score > 40 ? "Bullish momentum, crowd chasing breakout" :
    score < -40 ? "Bearish capitulation, crowd derisking" :
    "Mixed tape, no clear crowd bias";
  return {
    ticker: quote.ticker,
    score,
    prediction,
    summary: `Sentiment proxy from ${quote.changePct.toFixed(2)}% move — ${prediction.toLowerCase()}.`,
  };
}
