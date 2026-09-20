# Live portal setup (Vercel + Supabase + Mailgun)

The marketing site is statically prerendered. `/portal` and `/api/portal/*` run as Vercel serverless functions with Supabase Auth, Postgres RLS, and Mailgun email.

## Environment variables (Vercel)

| Name | Notes |
|------|--------|
| `PUBLIC_SUPABASE_URL` | Project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key |
| `PUBLIC_SITE_URL` | `https://www.taxfortaxidrivers.co.uk` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `MAILGUN_API_KEY` | Server only |
| `MAILGUN_DOMAIN` | Verified sending domain |
| `MAILGUN_FROM` | From address on that domain |
| `MAILGUN_API_BASE` | `https://api.eu.mailgun.net` for EU |

## Database

Run the SQL in `supabase/migrations/` in the Supabase SQL editor (foundation + login challenges).

Create the first admin in Authentication → Users, then set:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'your-admin@email.com';

update public.profiles
set role = 'admin', active = true
where email = 'your-admin@email.com';
```

Further drivers and staff are invited from **Portal → Users**.

## Security

- Password + emailed OTP at sign-in
- Roles in `app_metadata` (not `user_metadata`)
- RLS on portal tables
- Service role used only on the server for invites, resets, and OTP challenges
