-- Portal foundation: profiles, submissions, campaigns, notices + RLS
-- Roles live in auth.users.raw_app_meta_data.role ('admin' | 'client') — never user_metadata.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'client')),
  trade_type text check (trade_type is null or trade_type in ('taxi', 'beautician')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_label text not null,
  trade_type text not null check (trade_type in ('taxi', 'beautician')),
  status text not null check (
    status in ('draft', 'submitted', 'ready_to_sign', 'client_signed', 'signed')
  ) default 'draft',
  months jsonb not null default '[]'::jsonb,
  income jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  sign_document jsonb,
  client_signature jsonb,
  admin_signature jsonb,
  signed_document_html text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_user_id_idx on public.submissions (user_id);
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_updated_at_idx on public.submissions (updated_at desc);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  sent_by uuid not null references public.profiles (id),
  sent_at timestamptz not null default now(),
  recipient_count integer not null default 0,
  recipients text[] not null default '{}'
);

create table if not exists public.email_notices (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  kind text not null default 'transactional',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- Keep profile in sync when auth user is created (service role / invite path also upserts)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_role text := coalesce(new.raw_app_meta_data->>'role', 'client');
  claimed_trade text := new.raw_app_meta_data->>'trade_type';
begin
  if claimed_role not in ('admin', 'client') then
    claimed_role := 'client';
  end if;
  if claimed_trade is not null and claimed_trade not in ('taxi', 'beautician') then
    claimed_trade := null;
  end if;

  insert into public.profiles (id, email, full_name, role, trade_type)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    claimed_role,
    claimed_trade
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = excluded.role,
        trade_type = excluded.trade_type,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers for RLS (read role from JWT app_metadata — not user_metadata)
create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->'app_metadata'->>'role', '')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_role() = 'admin'
$$;

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_notices enable row level security;

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Submissions
drop policy if exists "submissions_select_own_or_admin" on public.submissions;
create policy "submissions_select_own_or_admin"
  on public.submissions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own"
  on public.submissions for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "submissions_update_own_or_admin" on public.submissions;
create policy "submissions_update_own_or_admin"
  on public.submissions for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "submissions_admin_delete" on public.submissions;
create policy "submissions_admin_delete"
  on public.submissions for delete
  to authenticated
  using (public.is_admin());

-- Campaigns / notices: admin read/write; clients cannot see other people's mail logs
drop policy if exists "campaigns_admin_all" on public.email_campaigns;
create policy "campaigns_admin_all"
  on public.email_campaigns for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "notices_admin_all" on public.email_notices;
create policy "notices_admin_all"
  on public.email_notices for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select, insert on public.email_campaigns to authenticated;
grant select, insert on public.email_notices to authenticated;
