-- Onboarding / engagement documents for clients (Letter of Engagement + Contract)

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  doc_type text not null check (doc_type in ('letter_of_engagement', 'contract_tax_returns')),
  title text not null,
  body_html text not null,
  status text not null check (status in ('sent', 'signed')) default 'sent',
  fee_amount text,
  client_signature jsonb,
  signed_document_html text,
  signed_at timestamptz,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_documents_user_id_idx on public.client_documents (user_id);
create index if not exists client_documents_status_idx on public.client_documents (status);

drop trigger if exists client_documents_set_updated_at on public.client_documents;
create trigger client_documents_set_updated_at
  before update on public.client_documents
  for each row execute function public.set_updated_at();

alter table public.client_documents enable row level security;

drop policy if exists "client_documents_select_own_or_admin" on public.client_documents;
create policy "client_documents_select_own_or_admin"
  on public.client_documents for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "client_documents_insert_admin" on public.client_documents;
create policy "client_documents_insert_admin"
  on public.client_documents for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "client_documents_update_own_or_admin" on public.client_documents;
create policy "client_documents_update_own_or_admin"
  on public.client_documents for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

grant select, insert, update on public.client_documents to authenticated;
