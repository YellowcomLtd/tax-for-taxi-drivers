-- Files the admin attaches to a client record (licence copies, letters, etc.)

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size_label text not null default '',
  note text,
  data_url text not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists client_files_user_id_idx on public.client_files (user_id);

alter table public.client_files enable row level security;

drop policy if exists "client_files_select_own_or_admin" on public.client_files;
create policy "client_files_select_own_or_admin"
  on public.client_files for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "client_files_insert_admin" on public.client_files;
create policy "client_files_insert_admin"
  on public.client_files for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "client_files_delete_admin" on public.client_files;
create policy "client_files_delete_admin"
  on public.client_files for delete
  to authenticated
  using (public.is_admin());

grant select, insert, delete on public.client_files to authenticated;
