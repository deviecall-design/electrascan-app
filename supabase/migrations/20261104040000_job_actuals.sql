-- Dated job actuals and the job's own start and end dates.
-- Additive. Enables row level security the same way as the other beta tables:
-- no anon policies, so only the service role used by /api/beta can read or write.
-- Apply in the Supabase SQL editor for project zxeznkuodpseijkvjwxa.

create table if not exists public.job_actuals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  job_id text not null,
  spent_on date not null default current_date,
  materials numeric not null default 0,
  labour_hours numeric not null default 0,
  labour_cost numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  constraint job_actuals_amounts_check check (
    materials >= 0 and labour_hours >= 0 and labour_cost >= 0
  )
);

create index if not exists job_actuals_job_id_idx on public.job_actuals (job_id, spent_on);

create table if not exists public.job_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  job_id text not null,
  start_on date,
  end_on date,
  updated_at timestamptz not null default now()
);

create unique index if not exists job_schedules_job_id_idx on public.job_schedules (job_id);

alter table public.job_actuals enable row level security;
alter table public.job_schedules enable row level security;
