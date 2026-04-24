# MiroFish Trader

Day trading engine — **paper mode only**. Next.js 14 + Supabase + Claude API + Vercel.

## What it does

1. Polls the watchlist every 20 min via Vercel cron.
2. Detects price moves > 2% (news detection to come) on any active asset.
3. Runs **Eka Noe** (market data + technicals) and **MiroFish** (sentiment) engines.
4. Calls **Claude** to produce a structured trade plan (entry / stop / TP1-3 / size / R:R).
5. Pings Damien on **Telegram** — `APPROVE` or `IGNORE`.
6. On approve: paper-executes at live price, logs to Supabase, tracks P&L.

## Stack

- Next.js 14 (App Router, Node runtime on API routes)
- Supabase (Postgres + service-role writes from the cron)
- `@anthropic-ai/sdk` for Claude (model: `claude-sonnet-4-6`)
- Yahoo Finance for US + ASX quotes; Crypto.com MCP for BTC/ETH (Yahoo fallback until MCP is wired)
- Telegram Bot API for alerts

## Getting started

```bash
cp .env.example .env.local
# fill in Supabase, Anthropic, Telegram keys
npm install
npm run dev
```

Then apply the schema:

```bash
# Using supabase CLI linked to your project
supabase db execute -f supabase/schema.sql
# or paste the file into the SQL editor in the Supabase dashboard
```

## Cron

`vercel.json` registers `/api/cron/scan` on `*/20 * * * *`. Locally you can hit it
directly: `curl http://localhost:3000/api/cron/scan`. In production set `CRON_SECRET`
and Vercel will send it as a bearer token.

## Layout

```
app/
  page.tsx                 Dashboard
  signals/page.tsx         Signal feed
  journal/page.tsx         Trade journal
  performance/page.tsx     Win rate / expectancy / equity curve
  watchlist/page.tsx       Watchlist view (reads from Supabase)
  api/cron/scan/           Scan cron — price move → Eka Noe → MiroFish → Claude → Telegram
  api/telegram/webhook/    Telegram command webhook (stub)
lib/
  supabase.ts              Supabase clients (anon + service role)
  data/yahoo.ts            Yahoo Finance quote fetch
  data/crypto.ts           Crypto.com MCP (stub; Yahoo fallback)
  engines/ekaNoe.ts        Market data + technicals engine
  engines/miroFish.ts      Sentiment simulation engine
  engines/claudePlan.ts    Claude trade plan generator
  engines/telegram.ts      Alert formatting + sendMessage
supabase/
  schema.sql               `trades`, `signals`, `watchlist` + seed rows
vercel.json                Cron config
```

## Status

First commit: schema + scaffold + cron skeleton. Still to build: approve/ignore
flow from Telegram back to `trades`, paper execution + P&L tracker, live
signal feed UI, performance charts, news detection.
