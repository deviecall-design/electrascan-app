-- Assemblies, detection corrections, one-request supplier prices,
-- draft invoices, and job actuals.
-- Additive. Does not delete or rewrite existing rows.
-- Apply in the Supabase SQL editor for project zxeznkuodpseijkvjwxa.

create table if not exists public.assemblies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  assembly_key text not null,
  name text not null,
  keywords jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  labour_hours numeric not null default 0,
  sell_price numeric not null default 0,
  is_default boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.detection_corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  scan_id uuid,
  item_id integer,
  symbol text,
  original_desc text,
  original_qty numeric,
  corrected_desc text,
  corrected_qty numeric,
  action text not null,
  created_at timestamptz not null default now(),
  constraint detection_corrections_action_check
    check (action in ('confirmed', 'rejected', 'fixed'))
);

create table if not exists public.supplier_price_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  token text not null unique,
  materials_request_id uuid,
  estimate_ref text,
  job_name text,
  supplier_name text not null default 'Lawrence & Hanson',
  lines jsonb not null default '[]'::jsonb,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint supplier_price_links_status_check
    check (status in ('sent', 'priced', 'ordered', 'delivered'))
);

create table if not exists public.draft_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  source text not null,
  source_ref text,
  job_name text,
  client_name text,
  amount numeric not null default 0,
  tax numeric not null default 0,
  status text not null default 'draft',
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint draft_invoices_source_check check (source in ('milestone', 'variation')),
  constraint draft_invoices_status_check check (status in ('draft', 'pushed'))
);

create table if not exists public.job_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  job_key text not null,
  name text not null,
  stage text not null default 'takeoff',
  quoted_sell numeric not null default 0,
  actual_materials numeric not null default 0,
  actual_hours numeric not null default 0,
  labour_rate numeric not null default 110,
  updated_at timestamptz not null default now(),
  constraint job_records_stage_check
    check (stage in ('lead', 'takeoff', 'quoted', 'approved', 'in_progress', 'variations', 'invoicing', 'complete'))
);

alter table public.assemblies enable row level security;
alter table public.detection_corrections enable row level security;
alter table public.supplier_price_links enable row level security;
alter table public.draft_invoices enable row level security;
alter table public.job_records enable row level security;
