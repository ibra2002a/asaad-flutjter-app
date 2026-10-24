# VENDORA — Architecture

## Overview

```
Browser (Arabic RTL, PWA)
   │  Server Components render pages; Client Components handle cart and forms
   ▼
Next.js 15 on Vercel (App Router, TypeScript)
   │  Server Actions + Route Handlers; @supabase/ssr keeps the session in cookies
   ▼
Supabase
   ├── Auth            email + password, email confirmation
   ├── PostgreSQL 17   schema, RLS, SECURITY DEFINER functions, triggers
   └── Storage         product-images bucket (public read, owner write)
```

The database is the system of record and the security boundary. The application
layer adds validation, redirects and friendly messages, but every privilege is
enforced again in PostgreSQL.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain rules (pure) | `src/lib/domain/` | Order transitions, commission math, cart validation, authorization decisions. Unit-tested. |
| Validation | `src/lib/validation/schemas.ts` | zod schemas for every form and action input |
| Data access (reads) | `src/lib/data/` | Server-only queries as the signed-in user (RLS applies) |
| Actions (writes) | `src/lib/actions/` | `'use server'` functions. Validate input, call RPCs, revalidate paths |
| Session/guards | `src/lib/session.ts`, `src/middleware.ts` | Current user, portal guards, session refresh |
| UI | `src/app/**`, `src/components/` | Pages, layouts, accessible primitives |
| Database | `supabase/migrations/` | Schema, RLS, grants, workflow functions, audit |

## Portals

| Portal | Route prefix | Who | Guard |
| --- | --- | --- | --- |
| Public storefront | `/`, `/products`, `/categories`, `/suppliers` | Everyone | Only moderated data is readable (RLS) |
| Buyer | `/buyer`, `/checkout`, `/cart` | role `buyer`, business approved | `requirePortal('buyer')` + `place_order()` checks |
| Supplier | `/supplier` | role `supplier`, business approved to sell | `requirePortal('supplier')` + RLS + `canSellProducts` |
| Administration | `/admin` | role `admin` | `requirePortal('admin')` + `is_admin()` in every admin function |

## Request flow: checkout

1. The cart lives in the browser (`localStorage`) and holds only product ids and quantities. It stores no prices.
2. The checkout page loads current prices from the database for display.
3. The browser posts product ids, quantities, address id and an idempotency key to `placeOrderAction`.
4. `place_order()` runs in one transaction. It locks the buyer row (serialising checkouts), returns existing orders for a repeated key, locks each product row in a fixed order, checks status, supplier approval, category, minimum, maximum and stock, reads prices from the database, snapshots names and units, writes one order per supplier with its events, and decrements stock.
5. Any failed check aborts the whole transaction. Nothing is half-created.

## Request flow: order status change

`transition_order(order_id, to_status, reason)` checks, in one locked transaction:
the caller is the buyer, the owning supplier, or an admin, the transition is in the
allowed matrix, and a reason is present when required. It then updates the order,
appends an `order_events` row (append-only), restores stock on cancellation, and
creates the commission once when the order completes.

## Commission

- Rates are stored in basis points (400 = 4%) and resolved **per line at checkout**: supplier agreement, then category, then global default. The resolved rate is frozen on the line.
- Eligible base = `(quantity − returned) × unit price` (sale price already applied). Delivery fees are excluded.
- Line commission = `floor((base × rate_bp + 5000) / 10000)`, integer arithmetic, rounded half-up.
- One `commissions` row per order (unique `order_id`), created on completion, idempotent via `ON CONFLICT DO NOTHING`.
- Returns after completion create `commission_adjustments` rows that bring the net to the recalculated target. The original record is never edited.

## Security model

- **Authentication**: Supabase Auth. Sessions are HTTP-only cookies refreshed by middleware.
- **Authorization**: Row Level Security on every table; column-level grants so clients cannot write privileged columns (role, verification status, prices of placed orders, commission, dispute outcome); SECURITY DEFINER functions for every privileged write, each checking `auth.uid()` and role.
- **Roles**: `buyer`, `supplier`, `admin` on `profiles.role`. Sign-up can only choose buyer or supplier (enforced in the database trigger). Admin is assigned by an operator.
- **Secrets**: the service-role key is used only by the demo seed script run locally. The app reads only `NEXT_PUBLIC_*` variables.
- **Input handling**: zod validation on the server; SQL parameters everywhere; search strings sanitised; CSV output neutralises formula injection.
- **Open redirects**: post-login redirects accept only same-site relative paths.
- **Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer policy, restricted permissions policy.
- **Audit**: administrator decisions write `audit_logs` rows in the same transaction as the change.
- **Money**: integer IQD everywhere (`bigint` in SQL, `Number.isSafeInteger` checks in TypeScript).

## Notifications

In-app only, stored in `notifications` (RLS: owner-only). Written by a trigger on order events and by administrator functions. There is no email or SMS provider configured in the MVP; see LIMITATIONS.md.

## Frontend

- Next.js 15.5 App Router, React 19, Tailwind CSS 4.
- `<html lang="ar" dir="rtl">`, Cairo typeface via `next/font`, logical CSS properties (`ms-`, `me-`, `start-`, `end-`) so layouts mirror correctly.
- Dark green (`brand-*`) and lime (`lime-*`) tokens are defined in `src/app/globals.css`.
- Mobile-first layouts; navigation collapses to a disclosure menu below 768px.
- PWA: web app manifest (`src/app/manifest.ts`) and an installable icon. No offline caching in the MVP.
