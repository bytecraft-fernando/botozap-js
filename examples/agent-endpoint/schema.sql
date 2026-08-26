create table if not exists __AGENT_JOBS_TABLE__ (
  id bigint generated always as identity primary key,
  idempotency_key text not null unique,
  event_type text not null,
  payload jsonb not null,
  state text not null default 'queued'
    check (state in ('queued', 'processing', 'sending', 'completed', 'ignored', 'failed', 'ambiguous')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processing_started_at timestamptz,
  response_plan jsonb,
  outbound_wamid text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists __AGENT_JOBS_INDEX__
  on __AGENT_JOBS_TABLE__ (state, available_at, id);
