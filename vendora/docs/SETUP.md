# VENDORA — Local setup

This guide takes a fresh machine to a running VENDORA with a real Supabase
database. Commands are exact; run them from the `vendora/` folder.

## 1. Requirements

| Tool | Version |
| --- | --- |
| Node.js | 20.9 or newer (22 LTS recommended) |
| npm | 10 or newer (ships with Node) |
| Supabase account | Free tier is enough for the pilot |

## 1b. Run a full local Supabase stack (optional, recommended for testing)

Requires Docker. This starts PostgreSQL 17, Auth, the REST API, Storage and Studio locally and applies every migration in `supabase/migrations/`:

```bash
npx supabase start          # first run downloads images (several GB)
npx supabase status         # prints API URL and keys
npx supabase stop           # when finished
```

Use the printed `API_URL` and `ANON_KEY` in `.env.local`. Local email confirmation is disabled, so sign-up returns a session immediately.

## 2. Install

```bash
cd vendora
npm ci
```

## 3. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**. Choose the region closest to Iraq that is available, set a strong database password, and store it in your password manager.
2. When the project is ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never commit it)
3. Open **Authentication → Providers → Email** and keep it enabled. For the pilot we recommend keeping **Confirm email** on.
4. Open **Authentication → URL Configuration** and set:
   - **Site URL**: your app URL (for local work: `http://localhost:3000`)
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and, after deployment, `https://<your-domain>/auth/callback`

## 4. Apply the database migrations

Migrations live in `supabase/migrations/` and run in filename order. Use the Supabase SQL editor (paste each file in order) **or** the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The migrations are:

| File | Purpose |
| --- | --- |
| `20260101000100_core_schema.sql` | Tables, enums, constraints, indexes |
| `20260101000200_reference_data.sql` | Cities, categories, default 4% commission rule (safe for production) |
| `20260101000300_functions_triggers.sql` | Helper functions, triggers, notifications, onboarding |
| `20260101000400_rls_grants.sql` | Row Level Security policies and column-level grants |
| `20260101000500_order_functions.sql` | Atomic checkout, status transitions, commissions, disputes |
| `20260101000600_admin_functions.sql` | Audited administrator functions |
| `20260101000700_storage.sql` | Product image bucket and storage policies |

Run them once on each environment. Do not edit an applied migration; add a new one instead.

## 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values from step 3. `.env.local` is git-ignored. Only variables starting with `NEXT_PUBLIC_` reach the browser.

## 6. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>.

## 7. Create the first administrator

Administrator access is never granted by sign-up. An operator promotes an existing account once, from the Supabase SQL editor (see `docs/OPERATIONS.md` → "Creating an administrator"):

1. Sign up through the app as a buyer with the admin's email.
2. Run the promotion statement shown in OPERATIONS.md.

## 8. Optional: demo data for a TEST project

Demo data is clearly labelled `[DEMO]` / `[تجريبي]` and uses `@vendora.test` emails. It is refused unless you opt in:

```bash
VENDORA_ALLOW_DEMO_SEED=true \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
DEMO_PASSWORD='a-strong-test-password-123' \
npm run seed:demo
```

Never run the seed against the production project.

## 9. Live tests (against a running Supabase)

```bash
# Live data path: auth, RLS, RPCs, storage policy (18 tests)
SUPABASE_INTEGRATION=1 npm run test:integration

# Full browser journey: sign-up → approval → publish → order → fulfil → commission,
# plus cancellation, rejection, dispute and CSV export (35 steps). Needs the app
# running (npm run build && npm run start -p 3200) and Chromium.
E2E_BASE_URL=http://localhost:3200 E2E_DB_CONTAINER=supabase_db_vendora npm run test:flows

# Route sweep: every portal page as each role, at phone width (35 checks)
E2E_BASE_URL=http://localhost:3200 E2E_ANON_KEY=... npm run test:routes
```

The journey and route sweep create uniquely named `@vendora.test` accounts. They promote an admin with SQL through the local Supabase Docker container, so they are for local or test projects only.

## 10. Quality checks

```bash
npm run lint          # ESLint (Next.js rules, TypeScript)
npm run typecheck     # TypeScript strict mode
npm test              # Unit tests: commission, order rules, cart, authorization, validation
npm run test:db       # Database tests: real PostgreSQL 17 with RLS and every migration
npm run build         # Production build
npm run test:e2e      # Browser layout/RTL smoke test (needs a running server)
npm run check         # lint + typecheck + unit + build
```

`npm run test:db` needs no Supabase project: it runs the real migrations on an in-process PostgreSQL 17 (PGlite).
