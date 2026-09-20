-- Short-lived login OTP challenges (server-only via service role / RLS deny-all for clients)

create table if not exists public.login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_challenges_user_idx on public.login_challenges (user_id);

alter table public.login_challenges enable row level security;
-- No policies for authenticated/anon: only service role can read/write
