import Anthropic from "@anthropic-ai/sdk";
import type { TradePlan } from "../types";
import type { EkaNoeReport } from "./ekaNoe";
import type { MiroFishReport } from "./miroFish";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are MiroFish, a disciplined day-trading strategist.
Given market data (Eka Noe) and sentiment (MiroFish) for a single ticker,
return a JSON trade plan with entry, stop, TP1/2/3, position size, risk %,
R/R ratio, direction (long|short), timeframe, confidence (LOW|MED|HIGH) and
a 1-sentence thesis. Paper mode only — never include broker instructions.
Reply with JSON only, no prose.`;

export async function generateTradePlan(
  eka: EkaNoeReport,
  miro: MiroFishReport,
): Promise<TradePlan | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const client = new Anthropic({ apiKey: key });

  const userPayload = {
    ticker: eka.ticker,
    price: eka.price,
    change_pct: eka.changePct,
    technicals: eka.technicals,
    sentiment: { score: miro.score, prediction: miro.prediction, summary: miro.summary },
  };

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });

  const text = res.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = JSON.parse(text) as Partial<TradePlan>;
    return {
      ticker: eka.ticker,
      direction: parsed.direction === "short" ? "short" : "long",
      timeframe: parsed.timeframe ?? "intraday",
      thesis: parsed.thesis ?? "",
      entry_price: Number(parsed.entry_price ?? eka.price),
      stop_price: Number(parsed.stop_price ?? eka.price * 0.98),
      tp1: Number(parsed.tp1 ?? eka.price * 1.02),
      tp2: Number(parsed.tp2 ?? eka.price * 1.04),
      tp3: Number(parsed.tp3 ?? eka.price * 1.06),
      size_units: Number(parsed.size_units ?? 0),
      risk_pct: Number(parsed.risk_pct ?? 1),
      rr_ratio: Number(parsed.rr_ratio ?? 0),
      confidence: (parsed.confidence as TradePlan["confidence"]) ?? "MED",
      mirofish_score: miro.score,
      mirofish_prediction: miro.prediction,
    };
  } catch {
    return null;
  }
}
