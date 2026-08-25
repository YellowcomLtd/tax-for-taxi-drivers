# Build Brief: Tax for Taxi Drivers - Client Portal (Demo)

**Prepared by:** Stephen McClelland
**Purpose:** Demo backend portal to show the client. Proof of concept, not final production.
**Attached files:** Two example spreadsheets (`Making_Tax_Digital_3_month_Spreadsheet_Taxi_Drivers.xlsx` and `Making_Tax_Digital_3_month_Spreadsheet_Beauticians.xlsx`). These define the structure of the data we collect from clients. Read them before building the submission form.

---

## 1. What we are building and why

Tax for Taxi Drivers helps self-employed clients (taxi drivers, and the same model extends to beauticians and other trades) prepare and submit their earnings to HMRC under Making Tax Digital. Right now that data moves around in spreadsheets and email.

This portal replaces that with a single system where:

- Clients log in, enter their income and expenditure, and sign off a declaration that the figures are accurate.
- The business owner sees every client and every submission in one dashboard.
- The team can email all clients at once with important updates.

The sign-off (our own built-in e-signature, replacing DocuSign) and the client email function are the two priorities. Everything else supports those.

This is a **demo to win the client**, so it needs to look real and the core flows must work end to end. It does not need production hardening yet. Section 9 sets out what to build properly versus what to keep simple.

---

## 2. Tech stack

- **Frontend + hosting:** Next.js on Vercel
- **Database + auth:** Supabase (Postgres, Supabase Auth, Supabase Storage for files and signed PDFs)
- **Email:** MailGun for all transactional and bulk email
- **Build tool:** Cursor

Use Supabase Auth for login and the email one-time-passcode step rather than building session handling from scratch. Use Supabase Row Level Security so a client can only ever see their own records.

---

## 3. User roles

**Admin (Tax for Taxi Drivers team / business owner)**
- Sees all clients and all submissions
- Reviews a submission and marks it ready for the client to sign
- Sends bulk email to all clients

**Client (the taxi driver, beautician, etc.)**
- Logs in and sees only their own account
- Creates a submission by entering their monthly income and expenditure
- Uploads supporting files if needed
- Signs off their declaration

---

## 4. Core features

### 4.1 Authentication with email 2FA
- Email and password login via Supabase Auth.
- After password, send a six-digit code to the user's email (via MailGun), valid for 10 minutes, single use. User enters it to complete login.
- Supabase Auth supports email OTP and magic links natively, so lean on that rather than hand-rolling.
- Role (admin or client) is stored on the user record and drives which dashboard they land on.

**Acceptance:** A client and an admin can each log in, pass the email code step, and land on the correct dashboard. A client cannot reach any admin route.

### 4.2 Client dashboard and submissions
This is where the spreadsheet structure matters. Each submission mirrors the attached templates:

- A **trade type** (taxi driver, beautician) that determines the default expenditure categories. Use the two attached sheets for the exact category lists.
- A **three-month period** with a label (e.g. "Apr to Jun 2026").
- **Expenditure lines:** one row per category, with a figure for Month 1, Month 2, Month 3. Row total and column totals calculated automatically.
- **Income** per month.
- **Profit** calculated as total income minus total expenditure.

The client fills this in through a form that behaves like the spreadsheet (categories down the side, three months across), sees their profit update live, and saves a draft or submits.

Expenditure categories from the attached sheets:
- **Taxi drivers:** Depot Rent, Fuel, Insurance, Taxi Rental/Repayment, Service Costs, Road Tax/PSV/Licencing, Tolls, Interest/Pension, Phone, Accountancy
- **Beauticians:** Premises Rent, Rates, Electricity, Product, Professional Fees, Marketing, Equipment, Sundry, Phone, Accountancy

Let clients add a custom line too, so they are not boxed in.

**Acceptance:** A client can create a submission, enter figures across three months, see totals and profit calculate correctly, save a draft, and submit for review.

### 4.3 File upload
- Clients can attach supporting files (receipts, existing spreadsheets) to a submission.
- Store in Supabase Storage, scoped to that client.

### 4.4 Sign-off (our DocuSign equivalent)
Single-signer flow. The client signs a declaration that their figures are accurate.

Flow:
1. Admin reviews a submitted set of figures and marks it "Ready to sign".
2. Client is emailed (MailGun) that their declaration is ready.
3. Client opens the submission, reads the declaration text, and clicks to sign.
4. System sends a one-time code to their email; client enters it to confirm intent.
5. On success, the system generates a **locked PDF** of the submission plus a signature and audit block, stores it, and marks the submission "Signed".
6. Both the client and the Tax for Taxi Drivers team receive the signed PDF by email.

The audit block on the PDF must record: signer name, signer email, date and time of signing, IP address, and confirmation the email code was verified. This is what makes an electronic signature stand up under UK law (intent to sign, consent, attribution, and a retained tamper-evident record). See section 8.

**Acceptance:** A client can take a "Ready to sign" submission through the code step to a "Signed" state, a locked PDF is produced with the audit block, and both parties receive it by email.

### 4.5 Admin dashboard
- List of all clients (contacts) with status at a glance.
- Drill into any client to see their submissions and current status (Draft, Submitted, Ready to sign, Signed).
- View or download any signed PDF.
- Mark a submission "Ready to sign".

**Acceptance:** Admin can see every contact, open any submission, move it to "Ready to sign", and retrieve the signed PDF.

### 4.6 Bulk email to all clients
- Admin composes a subject and message and sends to all clients in one go, via MailGun.
- Keep a simple record of what was sent and when.

**Acceptance:** Admin can send one message that reaches every client, and see it was sent.

---

## 5. Suggested data model

Adjust as needed, but this covers it:

- **users** - id, email, full_name, role (admin/client), trade_type, created_at
- **submissions** - id, user_id, period_label, status (draft/submitted/ready_to_sign/signed), income_month_1/2/3, created_at, signed_at, signed_pdf_url
- **submission_lines** - id, submission_id, category, month_1, month_2, month_3 (expenditure lines; totals and profit can be calculated in-app rather than stored)
- **submission_files** - id, submission_id, file_url, uploaded_at
- **signatures** - id, submission_id, signer_email, signer_name, ip_address, otp_verified (bool), signed_at, document_hash
- **email_campaigns** - id, subject, body, sent_by, sent_at, recipient_count

Enforce Row Level Security so clients only ever read and write their own rows.

---

## 6. Environment variables needed

- Supabase URL and anon/service keys
- MailGun API key and sending domain
- App base URL

---

## 7. Declaration text (placeholder)

Use this on the sign-off screen and PDF until the client gives us final wording:

> I confirm that the income and expenditure figures in this submission are accurate and complete to the best of my knowledge, and I authorise Tax for Taxi Drivers to use them in preparing my Making Tax Digital submission to HMRC.

Flag this clearly as placeholder text so we swap in the client's approved version.

---

## 8. Compliance notes (build these in, do not skip)

- **Audit trail is the evidence.** Every signature must capture signer email, name, timestamp, IP address, and confirmation the email code was verified. Without it the signature is weak.
- **Locked final PDF.** Once signed, the PDF is read-only and should flag if altered afterwards. For the demo, generating the PDF with a document hash stored alongside is enough; full cryptographic tamper-proofing can come later.
- **UK GDPR.** We are storing personal and financial data, so keep it in the client's own scoped records, secure storage only, and no data shared between clients.
- These figures feed HMRC submissions, so both parties keep a retained copy of every signed declaration.

---

## 9. Demo scope: build properly vs keep simple

**Build properly (these sell the demo):**
- Login with email 2FA
- Client submission form matching the spreadsheet structure
- Sign-off flow through to a locked PDF with audit block
- Admin view of all contacts and submissions
- Bulk email via MailGun

**Keep simple for now:**
- Full cryptographic tamper-proofing (store a hash for now)
- Multi-signer or signing order (single signer only)
- Payment collection
- Advanced reporting and analytics
- SMS codes (email codes only, no Twilio)

---

## 10. Suggested build order

1. Supabase project, schema, and Row Level Security
2. Auth with email 2FA and role-based routing
3. Client submission form (the spreadsheet-driven part)
4. Admin dashboard listing contacts and submissions
5. Sign-off flow and locked PDF generation
6. MailGun wiring for codes, signed PDFs, and bulk email
7. Polish so it demos cleanly

---

**Note for Cursor:** The two attached spreadsheets are the source of truth for the submission structure. Match the category names exactly, and calculate totals and profit the same way the sheets do (Income minus total Expenditure).
