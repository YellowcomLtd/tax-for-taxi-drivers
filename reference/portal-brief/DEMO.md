# Client portal (static demo)

Proof-of-concept portal for Tax for Taxi Drivers. Full brief and source spreadsheets live in `reference/portal-brief/`.

## What this demo includes

- Email + password login with a simulated email OTP (code shown on screen)
- Role routing: admin vs client
- Client three-month income/expenditure form matching taxi & beautician spreadsheet categories
- Live totals and profit (Income − Expenditure)
- Draft / submit / ready to sign / signed workflow
- Demo sign-off with OTP, locked HTML document, SHA-256 hash, and audit block
- Admin contacts + submissions dashboard, mark ready to sign, bulk email log
- Data persisted in `localStorage` only (no Supabase / MailGun yet)

## Demo accounts

Password for all: `demo123`

| Role | Email |
|------|-------|
| Admin | admin@taxfortaxidrivers.co.uk |
| Taxi client | james.driver@example.com |
| Beautician client | sara.beauty@example.com |

## Suggested demo path

1. Log in as **James** → open the seeded “Ready to sign” submission → Sign → use the on-screen code → download signed document.
2. Log in as **Sara** → New submission → enter beautician figures → Save draft / Submit.
3. Log in as **Admin** → review Sara’s submission → Mark ready to sign → Bulk email all clients.
4. Use **Reset demo** in the portal header to restore seed data.

## After client approval

Wire Supabase Auth + Postgres + Storage, MailGun for OTP/bulk/PDF delivery, and replace the HTML document with a real locked PDF — per the brief in `reference/portal-brief/`.
