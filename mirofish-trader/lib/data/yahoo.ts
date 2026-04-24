import type { Quote } from "../types";

// Yahoo Finance quote endpoint. ASX tickers require the ".AX" suffix.
const BASE = process.env.YAHOO_FINANCE_BASE_URL || "https://query1.finance.yahoo.com";

export function yahooSymbol(ticker: string, assetClass: "us_equity" | "asx"): string {
  return assetClass === "asx" ? `${ticker}.AX` : ticker;
}

export async function fetchYahooQuote(symbol: string): Promise<Quote | null> {
  const url = `${BASE}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: { "user-agent": "mirofish-trader/0.1" }, cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    quoteResponse?: { result?: Array<{ symbol: string; regularMarketPrice?: number; regularMarketPreviousClose?: number; regularMarketTime?: number }> };
  };
  const q = json.quoteResponse?.result?.[0];
  if (!q || q.regularMarketPrice == null || q.regularMarketPreviousClose == null) return null;
  const price = q.regularMarketPrice;
  const prev = q.regularMarketPreviousClose;
  return {
    ticker: q.symbol.replace(/\.AX$/, ""),
    price,
    previousClose: prev,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    asOf: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
  };
}
