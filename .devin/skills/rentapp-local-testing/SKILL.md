---
name: Rentapp local Core MVP testing
description: How to build and end-to-end test the Rentapp Next.js + Supabase web app from the `devin/ticket-001-foundation` branch (Core MVP).
---

# Rentapp local Core MVP testing

## Repository / branch

- Repo root: `/home/ubuntu/repos/Rentapp`
- App directory: `web/`
- Target branch: `devin/ticket-001-foundation`

## Devin Secrets Needed

None in this session. The local Supabase stack uses the default demo keys; place them in `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## Local Supabase setup

```bash
cd /home/ubuntu/repos/Rentapp/web
npx supabase start
npx supabase db query --local < ./supabase/migrations/001_ticket_001.sql
npx supabase db query --local < ./supabase/migrations/002_core_mvp.sql
```

The migrations grant the required table privileges to `authenticated`/`anon`.

## Static checks

```bash
cd /home/ubuntu/repos/Rentapp/web
npm install
npm run lint
npx tsc --noEmit
npm run build
```

## Browser tips

- Chrome binary: `/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome`
- Launch with password-manager disabled:
  ```bash
  /opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome \
    --user-data-dir=/tmp/chrome-profile \
    --no-sandbox --disable-gpu --disable-infobars \
    --disable-features=PasswordCheck,PasswordManager,AutofillAddressProfileSavePrompt,AutofillAddressSave \
    --disable-save-password-bubble \
    --remote-debugging-port=29229 \
    http://localhost:3002/login
  ```
- Typing `@` via `computer type` can be unreliable; use `key Shift+2` while the email field is focused.
- Address/password save prompts still appear despite the flags; dismiss them with `Escape` or by clicking `No thanks`.
- Chrome password/address save prompts may intercept mouse clicks during manual testing; navigate directly to a URL, dismiss the prompt, or use a programmatic click if a link appears unresponsive.

## End-to-end test checklist

1. Sign in page renders `Sign in`, email/password inputs, and `Create an account`.
2. Sign-up creates a user and redirects to `/dashboard`.
3. Sidebar shows Dashboard, Inbox, Properties, Obligations, Parties, Accounts, Recurring, Documents, Add, and Sign out.
4. `Properties` → `Add property` form creates a property; confirm it appears in `/properties` with `Active` badge.
5. Click a property title; view property detail with rent summary, upcoming obligations, accounts, recurring rules, and parties.
6. Click `Edit`; update the nickname/city; save; confirm changes in the list.
7. Click `Archive`; confirm the property is archived (status changed to `archived`).
8. `Parties` → add a tenant, utility provider, or contractor.
9. `Accounts` → add a property account linked to a party.
10. `Obligations` → add a bill (e.g. water), then view it on the dashboard.
11. Record a partial and full payment on the water bill; confirm status becomes `partially paid` then `paid` and the dashboard balances update.
12. `Recurring` → add a monthly rent or quarterly water rule and verify it generates obligations.
13. `/seed` (optional) creates demo properties, tenants, accounts, recurring rules, obligations, and payments.
14. Sign out redirects to `/login`; sign back in.
15. Resize the browser to < 768px width; sidebar hides and a bottom nav appears (`Dashboard`, `Inbox`, `Add`, `Properties`, `Bills`).

## Common gotchas

- `permission denied for table properties` → run the migrations shown above; they contain the required `GRANT` statements.
- Port 3000 may be claimed by a stale or auto-restarted `next dev` from the main checkout; use `ss -ltnp | grep 3000` and kill it, or simply test on port 3002.
