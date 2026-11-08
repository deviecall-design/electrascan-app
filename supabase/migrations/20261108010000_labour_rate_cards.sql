-- Labour rate card for one electrical contractor.
-- Additive. Does not change assemblies, estimates, or the single electrician rate.
-- Until this is applied, the app keeps the card in the browser.

create table if not exists public.labour_rate_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  roles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.labour_rate_cards enable row level security;

drop policy if exists "Members read labour rates" on public.labour_rate_cards;
create policy "Members read labour rates"
  on public.labour_rate_cards for select to authenticated
  using (tenant_id is null or tenant_id = public.get_tenant_id());

drop policy if exists "Members write labour rates" on public.labour_rate_cards;
create policy "Members write labour rates"
  on public.labour_rate_cards for all to authenticated
  using (tenant_id is null or tenant_id = public.get_tenant_id())
  with check (tenant_id is null or tenant_id = public.get_tenant_id());
