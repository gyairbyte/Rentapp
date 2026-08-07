# Rentapp

Rental property operations system — starting with the Ticket 001 foundation:
auth, responsive app shell, and property CRUD backed by Supabase.

## Getting started

1. Copy `web/.env.local.example` to `web/.env.local` and fill in your Supabase
   project URL and anon key.
2. Run the migration in `web/supabase/migrations/001_ticket_001.sql` against
   your Supabase project (SQL Editor or `supabase db push` once the CLI is
   configured).
3. Install dependencies and start the dev server:

```bash
cd web
npm install
npm run dev
```

## Tech stack

- Next.js 14 App Router + React 18 + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- `@supabase/ssr` for cookie-based sessions
- Zod for form validation
