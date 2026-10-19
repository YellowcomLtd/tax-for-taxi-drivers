-- Promote office inbox to admin (profiles + auth app_metadata).
update public.profiles
set role = 'admin', active = true
where lower(email) = 'info@taxfortaxidrivers.co.uk';

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = 'info@taxfortaxidrivers.co.uk';
