-- Mini-CRM fields on profiles (address, UTR, GoCardless id, etc.)

alter table public.profiles
  add column if not exists phone text,
  add column if not exists company_name text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_line3 text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postal_code text,
  add column if not exists country_code text,
  add column if not exists utr text,
  add column if not exists agent_reference text,
  add column if not exists gocardless_customer_id text,
  add column if not exists notes text;

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_utr_idx on public.profiles (utr);
create index if not exists profiles_gocardless_idx on public.profiles (gocardless_customer_id);
