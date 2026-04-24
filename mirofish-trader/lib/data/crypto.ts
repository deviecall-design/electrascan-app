import type { Quote } from "../types";

// Placeholder Crypto.com MCP client. Swap with real MCP call once the server
// URL is configured. Falls back to Yahoo (BTC-USD, ETH-USD) so the cron can run.
const MCP_URL = process.env.CRYPTO_COM_MCP_URL;

export async function fetchCryptoQuote(ticker: string): Promise<Quote | null> {
  if (MCP_URL) {
    // TODO: wire up the Crypto.com MCP protocol call.
    return null;
  }
  const symbol = `${ticker}-USD`;
  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
    { headers: { "user-agent": "mirofish-trader/0.1" }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    quoteResponse?: { result?: Array<{ symbol: string; regularMarketPrice?: number; regularMarketPreviousClose?: number; regularMarketTime?: number }> };
  };
  const q = json.quoteResponse?.result?.[0];
  if (!q || q.regularMarketPrice == null || q.regularMarketPreviousClose == null) return null;
  const price = q.regularMarketPrice;
  const prev = q.regularMarketPreviousClose;
  return {
    ticker,
    price,
    previousClose: prev,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    asOf: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
  };
}
