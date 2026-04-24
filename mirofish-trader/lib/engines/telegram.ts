import type { TradePlan } from "../types";

export function formatAlert(plan: TradePlan, signalId: string): string {
  const arrow = plan.direction === "long" ? "▲" : "▼";
  return [
    `🎯 SIGNAL: ${plan.ticker} ${arrow} ${plan.mirofish_score >= 0 ? "+" : ""}${plan.mirofish_score.toFixed(1)}`,
    `MiroFish: ${plan.mirofish_prediction}`,
    `Confidence: ${plan.confidence}`,
    ``,
    `📋 TRADE PLAN`,
    `Entry: $${plan.entry_price}`,
    `Stop: $${plan.stop_price}`,
    `TP1: $${plan.tp1} | TP2: $${plan.tp2}${plan.tp3 ? ` | TP3: $${plan.tp3}` : ""}`,
    `Size: ${plan.size_units} units | Risk: ${plan.risk_pct}%`,
    `R/R: ${plan.rr_ratio}:1`,
    ``,
    `Reply /approve ${signalId} or /ignore ${signalId}`,
  ].join("\n");
}

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return res.ok;
}
