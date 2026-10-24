# VENDORA — Trade Smarter. Grow Faster.

Arabic-first B2B wholesale marketplace for businesses in Iraq, piloted in Baghdad.
Buyers browse verified suppliers' wholesale products, order, and track fulfilment.
Suppliers manage products and orders. Administrators approve accounts, moderate
products, resolve disputes, and manage commission.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL 17, Auth, Storage) · Vercel · Vitest · PGlite (PostgreSQL 17 for tests) · Playwright.

> The Flutter/Firebase files at the root of this repository belong to a different, earlier project. VENDORA lives entirely in this `vendora/` folder.

## Quick start

```bash
cd vendora
npm ci
cp .env.example .env.local     # then fill in your Supabase values
npm run dev                    # http://localhost:3000
```

Without Supabase credentials the app shows a setup screen that lists the variables to add. Full instructions: [`docs/SETUP.md`](docs/SETUP.md).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm run typecheck` | TypeScript strict type check |
| `npm test` | Unit tests (commission, order rules, cart, authorization, validation, redirects) |
| `npm run test:db` | Database tests against real PostgreSQL 17 with every migration and RLS |
| `npm run test:e2e` | Browser RTL/responsive smoke test (needs `npm run start` running) |
| `npm run seed:demo` | Demo data for a **test** project only (refuses without `VENDORA_ALLOW_DEMO_SEED=true`) |
| `npm run check` | lint + typecheck + unit tests + build |

## Project layout

```
vendora/
├── supabase/migrations/   SQL: schema, RLS, workflow functions, admin functions, storage
├── src/
│   ├── app/               Pages and route handlers (storefront, /buyer, /supplier, /admin)
│   ├── components/        UI primitives and feature components
│   ├── lib/
│   │   ├── domain/        Pure business rules (order status, commission, cart, authz)
│   │   ├── actions/       Server actions (writes)
│   │   ├── data/          Server-only queries (reads)
│   │   ├── validation/    zod schemas
│   │   ├── supabase/      Client factories, session refresh
│   │   └── cart/          Browser cart context
│   └── middleware.ts      Session refresh and protected-route redirects
├── tests/
│   ├── unit/              Vitest unit tests
│   └── db/                PGlite database tests (real migrations)
├── scripts/               Demo seed and browser smoke test
└── docs/                  Setup, deployment, operations, architecture, database, limitations, acceptance
```

## Key behaviours

- **Checkout** is one database transaction (`place_order`). Prices, minimums, maximums and stock are read from the database, never trusted from the browser. Resubmitting the same checkout returns the original orders.
- **Order status** changes go through `transition_order`, which validates the actor and the allowed transitions, and records who changed the status, when, and why.
- **Commission** = eligible product value after sale prices, excluding units returned and delivery fees, × rate. Rates are stored in basis points (400 = 4%) and frozen per order line. One commission record per completed order.
- **Access control** is enforced by Row Level Security and column-level grants in PostgreSQL. Roles cannot be set by clients; admin rights are granted by an operator.
- **Audit trail**: every administrator decision is logged with before/after values and a reason.

## Documentation

- [Setup](docs/SETUP.md) · [Deployment (Vercel + Supabase)](docs/DEPLOYMENT.md) · [Operations, backup and recovery](docs/OPERATIONS.md)
- [Architecture](docs/ARCHITECTURE.md) · [Database reference](docs/DATABASE.md)
- [Known limitations and outstanding work](docs/LIMITATIONS.md) · [Acceptance checklist](docs/ACCEPTANCE.md)

## Security notes

- Never commit `.env*` files (except `.env.example`, which holds variable names only).
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Keep it out of the application environment.
- Report suspected vulnerabilities to the project owner privately; do not open public issues with exploit details.
