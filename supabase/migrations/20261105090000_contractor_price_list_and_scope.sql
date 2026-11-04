-- Workspace price list and the quote's scope of works.
-- Additive. Does not delete or rewrite existing rows.
-- The price list is the contractor's own file. ElectraScan does not ship a supplier catalogue.
-- Apply in the Supabase SQL editor for project zxeznkuodpseijkvjwxa.
-- Until this is applied, the app keeps the price list in the browser and the scope inside line_items.

create table if not exists public.contractor_price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null default 'Workspace price list',
  source_label text not null default '',
  lines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.contractor_price_lists enable row level security;

alter table public.estimates
  add column if not exists scope_of_works jsonb;
