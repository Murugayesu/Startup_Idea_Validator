-- =============================================================
-- Startup Idea Validator — Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor)
-- =============================================================

-- ---------------------------------------------------------------
-- 1. validation_runs
-- ---------------------------------------------------------------
create table if not exists validation_runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  startup_idea     text not null,
  status           text not null check (status in ('pending', 'running', 'complete', 'failed')),
  validation_score int  check (validation_score between 1 and 10),
  report_markdown  text,
  error_message    text,              -- populated on failure
  cost_usd         numeric(10, 6),    -- Phase 3: LLM cost per run
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

-- ---------------------------------------------------------------
-- 2. run_events  (live progress feed)
-- ---------------------------------------------------------------
create table if not exists run_events (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references validation_runs(id) on delete cascade not null,
  agent_name  text,
  event_type  text not null,   -- started | tool_call | completed | error
  message     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------
create index if not exists idx_validation_runs_user_created
  on validation_runs(user_id, created_at desc);

create index if not exists idx_run_events_run_id_created
  on run_events(run_id, created_at asc);

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
alter table validation_runs enable row level security;
alter table run_events       enable row level security;

-- Users may only SELECT their own runs
create policy "users read own runs"
  on validation_runs for select
  using (auth.uid() = user_id);

-- Users may only SELECT events that belong to their own runs
create policy "users read own run events"
  on run_events for select
  using (
    run_id in (
      select id from validation_runs where user_id = auth.uid()
    )
  );

-- NOTE: INSERT / UPDATE on both tables is done exclusively by the
-- Celery worker using the service_role key, which bypasses RLS.
-- No client-side write policies are needed.

-- ---------------------------------------------------------------
-- 5. Daily run-count helper (used for rate limiting in the API)
-- Returns the number of runs submitted by a user today (UTC).
-- All submissions count — including failed ones.
-- ---------------------------------------------------------------
create or replace function get_daily_run_count(p_user_id uuid)
returns int
language sql
stable
security definer
as $$
  select count(*)::int
  from validation_runs
  where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'utc');
$$;
