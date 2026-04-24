import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import { fetchYahooQuote, yahooSymbol } from "@/lib/data/yahoo";
import { fetchCryptoQuote } from "@/lib/data/crypto";
import { runEkaNoe } from "@/lib/engines/ekaNoe";
import { runMiroFish } from "@/lib/engines/miroFish";
import { generateTradePlan } from "@/lib/engines/claudePlan";
import { formatAlert, sendTelegram } from "@/lib/engines/telegram";
import type { WatchlistRow, Quote } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THRESHOLD = Number(process.env.PRICE_MOVE_THRESHOLD_PCT ?? "2.0");

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow locally if unset
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function quoteFor(row: WatchlistRow): Promise<Quote | null> {
  if (row.asset_class === "crypto") return fetchCryptoQuote(row.ticker);
  return fetchYahooQuote(yahooSymbol(row.ticker, row.asset_class));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSupabaseService();
  const { data: watchlist, error } = await sb
    .from("watchlist")
    .select("*")
    .eq("active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const triggered: string[] = [];
  const now = new Date().toISOString();

  for (const row of (watchlist ?? []) as WatchlistRow[]) {
    const quote = await quoteFor(row);
    if (!quote) continue;

    await sb.from("watchlist").update({ last_price: quote.price, last_checked: now }).eq("ticker", row.ticker);

    if (Math.abs(quote.changePct) < THRESHOLD) continue;

    const eka = runEkaNoe(quote);
    const miro = runMiroFish(quote);
    const plan = await generateTradePlan(eka, miro);

    const { data: signal } = await sb
      .from("signals")
      .insert({
        ticker: row.ticker,
        source: "price",
        signal_type: quote.changePct >= 0 ? "breakout" : "breakdown",
        score: miro.score,
        summary: miro.summary,
        payload: { quote, eka, miro, plan },
      })
      .select("id")
      .single();

    if (plan && signal?.id) {
      await sendTelegram(formatAlert(plan, signal.id));
    }
    triggered.push(row.ticker);
  }

  return NextResponse.json({ ok: true, scanned: watchlist?.length ?? 0, triggered });
}
