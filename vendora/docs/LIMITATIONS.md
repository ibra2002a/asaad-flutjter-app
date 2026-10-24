# VENDORA — Known limitations and outstanding work

This is an honest list of what the MVP does **not** do yet, plus what must happen before real customers use it.

## Required before real customers (business and operations)

| # | Item | Owner | Notes |
| --- | --- | --- | --- |
| 1 | Create Supabase **test** and **production** projects and apply migrations | Founder / engineer | Needs your account. Steps: `docs/SETUP.md`, `docs/DEPLOYMENT.md` |
| 2 | Run `npm run test:e2e` and the content checks against the configured test project | Engineer | The layout check runs without credentials; data-backed pages need Supabase |
| 3 | Decide the commission policy (4% is the development default) and any delivery-fee policy | Founder | Financial decision. Changing it is an admin action, not a deploy |
| 4 | Define supplier document checks (trade licence, tax card) and approval SLA | Founder + ops | The app records approval and reasons; document collection is manual |
| 5 | Choose and configure an email/SMS provider for notifications (optional) | Founder + engineer | Currently in-app only. Costs money, so needs approval |
| 6 | Legal copy: terms of service, privacy policy, dispute policy (Arabic) | Founder / counsel | Placeholders are generic wording. Not legal advice |
| 7 | Purchase a domain (optional) and set `NEXT_PUBLIC_SITE_URL` | Founder | Costs money; needs approval |
| 8 | Name at least two operators with administrator access and document the process | Founder | Admins are created by an operator via SQL (OPERATIONS.md) |
| 9 | Enable PITR/daily backups on a paid Supabase plan; run the first restore drill | Founder + engineer | Recommended before launch |
| 10 | Run the seed script only on the test project; confirm no demo data exists in production | Engineer | `npm run seed:demo` refuses without an explicit flag |

## Functional limitations (MVP scope)

- **Payments**: none. Payment is agreed directly between buyer and supplier. VENDORA does not hold funds (by design). Settlement of commission is recorded manually by an administrator.
- **Delivery fees**: the system stores a `delivery_fee_iqd` column (always 0 in the MVP) and excludes it from commission. There is no delivery-fee configuration UI.
- **Cart**: stored in the browser (`localStorage`). A cart does not follow the user to another device, and it is not reserved. Stock is only reserved when the order is placed; on checkout the server rejects anything no longer available.
- **Supplier price changes on live products**: edits to an active product go live immediately without re-review. Admins can see and reject the product later from moderation. A stricter rule (re-review on price change) is a small change if the founder wants it.
- **Partial shipments**: an order moves through statuses as a whole. Individual line fulfilment is not tracked.
- **Returns**: handled through disputes. Returned goods are not returned to stock automatically (they may be damaged); an admin or supplier re-stocks by editing the product.
- **Dispute window**: disputes can be opened at any time after delivery. A time limit (e.g. 7 days) is not enforced yet.
- **Supplier coverage**: recorded and displayed. Orders are not automatically blocked for buyers outside a supplier's coverage area; the checkout does not check the delivery city against coverage.
- **Multi-language**: Arabic only. The interface is set to RTL and `ar`. English text appears only in the tagline and developer-facing identifiers.
- **Pagination**: lists show the latest 100 (orders, disputes) or 200 (audit, users, products) records. Cursor-based pagination is not implemented.
- **Search**: case-insensitive substring match on the Arabic product name. No full-text or fuzzy search.
- **Images**: up to 8 per product, JPG/PNG/WebP, 3 MB each. No automatic resizing; images are served from Supabase Storage as uploaded.
- **Reports**: supplier commission report and admin totals are computed live. No scheduled monthly statements or PDF export.
- **Accounting**: no invoices, VAT or tax documents are generated.
- **Admin dashboard**: real database metrics, but no time-series charts.
- **Password reset**: relies on Supabase's built-in email flow; there is no custom "forgot password" page in the app yet.
- **Account deletion**: not self-service. Requires an operator to remove the auth user (to keep order history).
- **Rate limiting**: relies on Supabase Auth's built-in protections. No application-level throttling on forms.

## Technical limitations

- **Loading state**: pages do not show a skeleton while streaming. A root `loading.tsx` was removed because it caused the address form (and other content) to be rendered twice on about 1 in 13 full page loads, verified in the browser. Pages load in one step instead.
- **Form results**: administrator and order-status forms show results inline (they no longer redirect), so the page stays put and refreshes its data.

- **Concurrency tests**: the database tests run sequentially in one in-process PostgreSQL. Race conditions for overselling are guarded by row locks (`SELECT … FOR UPDATE` in `place_order`) and by the per-buyer lock, but this has not been stress-tested under real concurrent load.
- **Test database**: `npm run test:db` uses PGlite (PostgreSQL 17 in WebAssembly) with a minimal shim for Supabase's `auth` schema. Supabase-specific behaviour (for example, Storage policies) is not exercised by these tests; the storage migration is skipped when the `storage` schema is absent.
- **End-to-end flows**: the browser suite checks RTL and responsive layout on public pages. Full signup-to-delivery flows through the UI are not automated yet; they are covered at the database layer and listed as manual steps in `docs/DEPLOYMENT.md`.
- **Generated types**: database types are hand-written (`src/lib/data/types.ts`). Generating types with `supabase gen types` would give compile-time checks on every query and is a recommended next step.
- **Server actions and queries**: the TypeScript layer that calls Supabase is type-checked but not exercised against a live Supabase instance in this environment.
- **Service-role use**: only in the local seed script. No runtime code uses it.
- **Cookie/session security**: relies on `@supabase/ssr` defaults (HTTP-only, secure in production over HTTPS, same-site).
- **Offline PWA**: installable manifest only; no service worker or offline cache.
- **Accessibility**: skip link, focus styles, labelled controls, reduced-motion support and sufficient contrast were applied. A full WCAG audit with assistive technology has not been performed.
- **Browser support**: modern evergreen browsers. `:has()` (used in one checkbox style) requires a recent browser.
- **Lint scope**: ESLint with Next.js core-web-vitals and TypeScript rules. Stylistic formatting is not enforced by a formatter.

## Outstanding engineering tasks (priority order)

1. Run the full flow on a Supabase **test** project and fix anything the live environment reveals.
2. Generate typed database definitions and use them for all queries.
3. Add an end-to-end suite (Playwright) covering: register → approve → publish → order → fulfil → complete → commission.
4. Add delivery-city validation against supplier coverage.
5. Add a dispute time window and an admin SLA view.
6. Add a password-reset page and account self-service deletion request.
7. Add cursor pagination to large lists.
8. Add an optional email provider for order and approval notifications.
9. Add structured logging/monitoring (for example, Sentry) after the founder approves the vendor.
