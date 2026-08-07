# Rentapp

A personal rental-property operations system that makes it difficult for a property-related obligation to be forgotten.

This repository contains the Core MVP plus the **Document Intelligence** phase: document capture/upload, AI extraction, review, confirmation into obligations/tasks, and inbox tracking.

## Tech stack

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Private Supabase Storage bucket (`documents`)
- `@supabase/ssr` for cookie-based sessions
- Zod for form validation
- Vitest for unit tests
- ESLint 9 with flat config
- OpenAI Responses API for multimodal document extraction (pluggable provider interface)

## Project structure

```
Rentapp/
├── README.md
├── web/
│   ├── package.json
│   ├── next.config.mjs
│   ├── eslint.config.mjs
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/           # Authenticated app routes (with app shell)
│   │   │   ├── (auth)/          # Public auth routes (login/signup)
│   │   │   ├── layout.tsx       # Root layout (fonts, globals)
│   │   │   └── page.tsx         # Root redirect
│   │   ├── components/          # UI components, forms, shell
│   │   ├── lib/
│   │   │   ├── actions/         # Server actions
│   │   │   ├── supabase/        # SSR client and proxy session helper
│   │   │   ├── validations/     # Zod schemas
│   │   │   ├── utils.ts         # Shared helpers
│   │   │   ├── types.ts         # Manual Database types
│   │   │   └── constants.ts     # Option constants
│   │   └── proxy.ts             # Next.js 16 proxy (auth/route guards)
│   ├── .env.local.example
│   └── supabase/migrations/
│       ├── 001_ticket_001.sql
│       ├── 002_core_mvp.sql
│       ├── 003_foreign_key_rls.sql
│       └── 004_document_intelligence.sql
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
2. In the Vercel project settings, set **Root Directory** to `web` because the Next.js application lives under `web/`.
3. Set the following environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key.
   - `NEXT_PUBLIC_SITE_URL` — the production domain (e.g., `https://rentapp.example.com`).
   - `OPENAI_API_KEY` — your server-side OpenAI key for document extraction.
   - `DOCUMENT_AI_MODEL` — model to use, e.g., `gpt-5.6-terra` (defaults to `gpt-5.6-terra`).
   - Vercel automatically provides `NEXT_PUBLIC_VERCEL_URL` for preview deployments.
4. In your Supabase project, add the Vercel production and preview domains under **Authentication → URL Configuration**:
   - Site URL: `https://your-production-domain.vercel.app`
   - Redirect URLs: `https://*.vercel.app/*` for preview deployments and `http://localhost:3000/*` for local development.
5. `SUPABASE_SERVICE_ROLE_KEY` should only be added to Vercel if you run one-off migration/seeder scripts there. It is not used by the application code.
6. Push and trigger a build. `next build --webpack` is configured in `package.json`. PRs will generate preview deployments automatically.

## Security notes

- Row-level security (RLS) is enabled on all user-owned tables (`properties`, `parties`, `accounts`, `obligations`, `payments`, `recurring_rules`, `documents`, `document_processing_runs`, `tasks`).
- RLS `WITH CHECK` policies on insert/update additionally validate that referenced foreign keys (`property_id`, `account_id`, `party_id`, `recurring_rule_id`, `obligation_id`, `source_document_id`, `confirmed_obligation_id`, `confirmed_task_id`) belong to the current user, preventing cross-user relationship tampering.
- The `documents` Supabase Storage bucket is private.
- Server-only credentials (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) are not referenced by the app code and should not be committed.
- `NEXT_PUBLIC_*` keys are public by design; the actual Supabase access is gated by RLS and authenticated sessions.
- `/seed` is disabled in production (both the route and the server action).
- OpenAI API calls run only in server actions; document buffers are downloaded from private Supabase Storage, sent to OpenAI, and the original file is preserved unchanged.

## Core MVP features

- **Properties** — create, edit, archive (soft delete), and view property detail with rent/bills/accounts.
- **Parties** — tenants, utility providers, contractors, government/tax authorities, insurers, etc.
- **Property accounts** — link a property/provider to an account number for future document matching.
- **Obligations** — track money owed or receivable (rent, water, taxes, insurance, repairs, etc.) with status and balances.
- **Payments** — partial and multiple payments against one obligation, with automatic paid/partial/overdue status.
- **Recurring obligations** — monthly/quarterly/semiannual/annual rules that generate individual obligations and avoid duplicates.
- **Basic rent tracking** — expected rent, received rent, outstanding balance.
- **Dashboard** — Needs Attention, This Month, Upcoming, and Properties summaries.
- **Global Add flow** — mobile-optimized entry point for property, bill, payment, recurring rule, party, and document upload.
- **Documents** — mobile capture (photo/PDF), SHA-256 exact duplicate detection, private Supabase Storage, processing status tracking, and document listing.
- **Document Intelligence** — OpenAI Responses API extraction behind a provider-neutral interface; structured schema with confidence per field.
- **Review & confirm** — side-by-side document and proposed fields; edit, confirm (idempotent), retry processing, or archive.
- **Inbox** — queues documents by Needs Review, Processing, Failed, and Recently Confirmed.
- **Task creation** — nonfinancial actions from documents become tasks with due dates.
- **AI cost/audit metadata** — every processing run records provider, model, tokens, duration, and raw output in `document_processing_runs`.
- **Semantic duplicate warnings** — provider+account+statement date, invoice number, and property+amount+due date.
- **Seed data** — `/seed` creates demo properties, tenants, accounts, recurring rules, obligations, and payments.

## Migrations

- `001_ticket_001.sql` — `properties` table, `handle_updated_at` trigger, initial RLS.
- `002_core_mvp.sql` — `archived` column, `parties`, `accounts`, `recurring_rules`, `obligations`, `payments`, `documents`, unique index preventing duplicate generated obligations, storage bucket/RLS, and updated-at triggers.
- `003_foreign_key_rls.sql` — FK ownership checks in RLS `WITH CHECK` policies to prevent cross-user relationships.
- `004_document_intelligence.sql` — document processing states, `document_processing_runs`, `tasks`, file hash/duplicate detection, `source_document_id` links, and updated RLS policies.

## Recurring rule edit behavior

When a recurring rule is updated:

- Historical obligations (`due_date` before today) are never modified.
- Obligations that already have payments (`paid_amount > 0`) are never modified.
- Future unpaid obligations generated by the rule are deleted and regenerated so they reflect the new amount, category, frequency, and other fields.
- If the rule is deactivated, no new future obligations are generated.

This keeps historical/payment records intact while ensuring upcoming expected obligations stay in sync with the rule.

## Known limitations / deferred functionality

- Bank syncing and automatic bill payment are out of scope.
- Full lease management (lease terms, move-in/move-out, etc.) is deferred.
- Repairs are currently a placeholder category; a full work-order workflow is future work.
- Expected-obligation gap detection (e.g., a quarterly water bill that never arrived) is a future enhancement.
- Only OpenAI is implemented as a document intelligence provider; the interface is ready for additional providers.
