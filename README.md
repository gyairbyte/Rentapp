# Rentapp

A personal rental-property operations system that makes it difficult for a property-related obligation to be forgotten.

This repository contains the **Core MVP** built on the Ticket 001 foundation: auth, responsive app shell, property CRUD, parties, property accounts, obligations, payments, recurring obligations, documents, and an actionable dashboard.

## Tech stack

- Next.js 14 App Router + React 18 + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Private Supabase Storage bucket (`documents`)
- `@supabase/ssr` for cookie-based sessions
- Zod for form validation

## Project structure

```
Rentapp/
├── README.md
├── web/
│   ├── package.json
│   ├── next.config.mjs
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/            # UI components, forms, shell
│   │   ├── lib/
│   │   │   ├── actions/         # Server actions
│   │   │   ├── supabase/        # SSR client and middleware
│   │   │   ├── validations/     # Zod schemas
│   │   │   ├── utils.ts         # Shared helpers
│   │   │   ├── types.ts         # Manual Database types
│   │   │   └── constants.ts     # Option constants
│   │   └── middleware.ts
│   ├── .env.local.example
│   └── supabase/migrations/
│       ├── 001_ticket_001.sql
│       └── 002_core_mvp.sql
```

## Getting started

1. Copy `web/.env.local.example` to `web/.env.local` and fill in your Supabase project URL, anon key, and optional service role key.
2. Run the migrations in `web/supabase/migrations/` against your Supabase project (SQL Editor or `supabase db push`).
3. Install dependencies and start the dev server:

```bash
cd web
npm install
npm run dev
```

4. (Optional) Visit `/seed` after logging in to generate demo data.

## Vercel deployment

1. Connect the `gyairbyte/Rentapp` repository to a Vercel project.
2. Set the following environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key.
   - `NEXT_PUBLIC_SITE_URL` — the production domain (e.g., `https://rentapp.example.com`).
   - Vercel automatically provides `NEXT_PUBLIC_VERCEL_URL` for preview deployments.
3. In your Supabase project, add the Vercel production and preview domains under **Authentication → URL Configuration**:
   - Site URL: `https://your-production-domain.vercel.app`
   - Redirect URLs: `https://*.vercel.app/*` for preview deployments and `http://localhost:3000/*` for local development.
4. `SUPABASE_SERVICE_ROLE_KEY` should only be added to Vercel if you run one-off migration/seeder scripts there. It is not used by the application code.
5. Push and trigger a build. PRs will generate preview deployments automatically.

## Security notes

- Row-level security (RLS) is enabled on all user-owned tables (`properties`, `parties`, `accounts`, `obligations`, `payments`, `recurring_rules`, `documents`).
- The `documents` Supabase Storage bucket is private.
- Server-only credentials (`SUPABASE_SERVICE_ROLE_KEY`) are not referenced by the app code and should not be committed.
- `NEXT_PUBLIC_*` keys are public by design; the actual Supabase access is gated by RLS and authenticated sessions.

## Core MVP features

- **Properties** — create, edit, archive (soft delete), and view property detail with rent/bills/accounts.
- **Parties** — tenants, utility providers, contractors, government/tax authorities, insurers, etc.
- **Property accounts** — link a property/provider to an account number for future document matching.
- **Obligations** — track money owed or receivable (rent, water, taxes, insurance, repairs, etc.) with status and balances.
- **Payments** — partial and multiple payments against one obligation, with automatic paid/partial/overdue status.
- **Recurring obligations** — monthly/quarterly/semiannual/annual rules that generate individual obligations and avoid duplicates.
- **Basic rent tracking** — expected rent, received rent, outstanding balance.
- **Dashboard** — Needs Attention, This Month, Upcoming, and Properties summaries.
- **Global Add flow** — mobile-optimized entry point for property, bill, payment, recurring rule, party, and document placeholders.
- **Documents foundation** — manual upload to private Supabase Storage and document listing.
- **Seed data** — `/seed` creates demo properties, tenants, accounts, recurring rules, obligations, and payments.

## Migrations

- `001_ticket_001.sql` — `properties` table, `handle_updated_at` trigger, initial RLS.
- `002_core_mvp.sql` — `archived` column, `parties`, `accounts`, `recurring_rules`, `obligations`, `payments`, `documents`, storage bucket/RLS, and updated-at triggers.

## Known limitations / deferred functionality

- AI/OCR, automatic document classification, and extraction are intentionally not implemented.
- Bank syncing and automatic bill payment are out of scope.
- Full lease management (lease terms, move-in/move-out, etc.) is deferred.
- Repairs are currently a placeholder category; a full work-order workflow is future work.
- Document review UI is a basic manual form; the review-extract-confirm flow will be built in the Document Intelligence phase.

## Recommended next phase: Document Intelligence

- Add an OCR + multimodal extraction layer behind a stable application interface.
- Implement the review screen that displays the original document next to extracted fields (property, type, provider, account, amount, due date, service period, required action) with low-confidence highlighting.
- Use property/account data to pre-match documents to properties.
- Generate obligations/tasks from approved document extractions.
- Add expected-obligation gap detection (e.g., a quarterly water bill that never arrived).
