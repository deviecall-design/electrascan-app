-- MiroFish Trader — Supabase schema (paper mode)
-- Apply with: supabase db execute -f supabase/schema.sql
-- or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────
-- watchlist
-- ────────────────────────────────────────────────────────────────
create table if not exists public.watchlist (
  ticker         text primary key,
  name           text not null,
  asset_class    text not null check (asset_class in ('crypto','us_equity','asx')),
  theme          text,
  active         boolean not null default true,
  last_price     numeric(18,6),
  last_checked   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists watchlist_active_idx on public.watchlist (active);
create index if not exists watchlist_theme_idx  on public.watchlist (theme);

-- ────────────────────────────────────────────────────────────────
-- signals — raw detection events (price move, news)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.signals (
  id           uuid primary key default gen_random_uuid(),
  ticker       text not null references public.watchlist(ticker) on update cascade,
  source       text not null check (source in ('price','news','manual','eka_noe','mirofish')),
  signal_type  text not null,
  score        numeric(6,2),
  summary      text,
  payload      jsonb,
  actioned     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists signals_ticker_created_idx on public.signals (ticker, created_at desc);
create index if not exists signals_actioned_idx       on public.signals (actioned, created_at desc);

-- ────────────────────────────────────────────────────────────────
-- trades — paper trades with full trade plan + P&L
-- ────────────────────────────────────────────────────────────────
create table if not exists public.trades (
  id                   uuid primary key default gen_random_uuid(),
  ticker               text not null references public.watchlist(ticker) on update cascade,
  direction            text not null check (direction in ('long','short')),
  timeframe            text,
  thesis               text,

  entry_price          numeric(18,6) not null,
  stop_price           numeric(18,6) not null,
  tp1                  numeric(18,6),
  tp2                  numeric(18,6),
  tp3                  numeric(18,6),

  size_units           numeric(18,6) not null,
  risk_pct             numeric(6,3),
  rr_ratio             numeric(6,2),
  confidence           text check (confidence in ('LOW','MED','HIGH')),

  mirofish_score       numeric(6,2),
  mirofish_prediction  text,

  status               text not null default 'OPEN' check (status in ('PENDING','OPEN','CLOSED','CANCELLED')),
  opened_at            timestamptz,
  closed_at            timestamptz,
  exit_price           numeric(18,6),

  pnl_usd              numeric(18,2),
  pnl_pct              numeric(8,4),
  outcome              text check (outcome in ('WIN','LOSS','BE','OPEN')),
  notes                text,

  signal_id            uuid references public.signals(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists trades_status_idx       on public.trades (status);
create index if not exists trades_ticker_idx       on public.trades (ticker);
create index if not exists trades_opened_at_idx    on public.trades (opened_at desc);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trades_set_updated_at on public.trades;
create trigger trades_set_updated_at
before update on public.trades
for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- Seed initial watchlist
-- ────────────────────────────────────────────────────────────────
insert into public.watchlist (ticker, name, asset_class, theme) values
  ('BTC',  'Bitcoin',                      'crypto',    null),
  ('ETH',  'Ethereum',                     'crypto',    null),
  ('NVDA', 'NVIDIA',                       'us_equity', 'AI energy/nuclear'),
  ('ASML', 'ASML Holding',                 'us_equity', 'ASML supply chain'),
  ('PLTR', 'Palantir',                     'us_equity', 'Defence upstream'),
  ('TSLA', 'Tesla',                        'us_equity', null),
  ('TSM',  'Taiwan Semiconductor',         'us_equity', 'ASML supply chain'),
  ('DRO',  'DroneShield',                  'asx',       'Defence upstream')
on conflict (ticker) do nothing;
