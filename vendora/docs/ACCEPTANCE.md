# VENDORA — Acceptance checklist

Status legend: ✅ verified by a command in this repository (evidence given) · 🟡 implemented, verification needs a configured Supabase project · ⬜ not done.

Evidence commands are run from `vendora/`. Live verification was run against a local Supabase stack (PostgreSQL 17, GoTrue, PostgREST, Storage) started with `npx supabase start`, with every migration applied from `supabase/migrations/`.

Verified against live Supabase in a real browser (phone 390px and desktop 1280px): sign-up for buyer, supplier and admin; supplier approval; product submission, moderation and publishing; product photo upload; address, cart and checkout; fulfilment to completion; buyer receipt confirmation; commission of IQD 12,000 on IQD 300,000 at 4%; buyer cancellation; supplier rejection with reason; return dispute and partial-return resolution with commission reversal; admin CSV export; anonymous and cross-role access refusal. Route sweep covers all 35 portal and public pages with no server errors or horizontal scroll.

Not verified in a browser (covered at database level only, or not built): email notifications (none built), buyer suspension from the UI, category creation from the UI, commission-rule changes from the UI, full refund from the UI, supplier coverage editing, default-address change and delete, password reset (not built), account self-deletion (not built).

## A. Storefront
| Item | Status | Evidence |
| --- | --- | --- |
| Landing page with Arabic RTL, brand, tagline | 🟡 | `src/app/page.tsx`; layout check `npm run test:e2e` |
| Categories page | 🟡 | `src/app/categories/page.tsx` |
| Product search, category filter, sort, pagination | 🟡 | `src/app/products/page.tsx`, `src/lib/data/catalog.ts` (`sanitizeSearch`) |
| Supplier profiles (approved only) | 🟡 | `src/app/suppliers/[id]/page.tsx`; RLS `businesses_select_public` |
| Product detail with min/max/stock | 🟡 | `src/app/products/[id]/page.tsx`, `AddToCartButton.tsx` |
| Registration and login | 🟡 | `src/lib/actions/auth.ts`, `src/app/register`, `src/app/login` |

## B. Buyer portal
| Item | Status | Evidence |
| --- | --- | --- |
| Business profile | 🟡 | `src/app/buyer/profile/page.tsx` |
| Delivery addresses (own only) | ✅ DB / 🟡 UI | `tests/db/workflows.test.ts` › "stores delivery addresses that only their owner can read" |
| Cart and checkout | ✅ DB / 🟡 UI | `tests/db/workflows.test.ts` › order creation block |
| Price and quantity validation (server-side) | ✅ | `tests/db/workflows.test.ts` › min/max/stock/invalid quantity; `tests/unit/cart-validation.test.ts` |
| Duplicate submission protection | ✅ | `tests/db/workflows.test.ts` › "returns the original orders on a duplicate submission" |
| Order history and status tracking | 🟡 | `src/app/buyer/orders`, `OrderTimeline.tsx` |
| Cancellation (before preparation) | ✅ | `tests/db/workflows.test.ts` › cancel and "does not let a buyer cancel once preparation has started"; `tests/unit/order-status.test.ts` |
| Disputes and partial returns | ✅ | `tests/db/workflows.test.ts` › disputes block |

## C. Supplier portal
| Item | Status | Evidence |
| --- | --- | --- |
| Onboarding and approval status | 🟡 | `src/app/supplier/onboarding/page.tsx` |
| Supplier cannot self-approve | ✅ | `tests/db/workflows.test.ts` › "prevents a supplier from approving their own business" |
| Pending suppliers cannot create products | ✅ | `tests/db/workflows.test.ts` › "stops a pending supplier from creating products" |
| Product create/edit, pricing, units, minimums, availability | 🟡 | `src/components/forms/ProductForm.tsx`, `src/lib/actions/supplier.ts` |
| Suppliers cannot publish their own products | ✅ | `tests/db/workflows.test.ts` › "stops suppliers from publishing their own product" |
| Accept, reject (reason), fulfil statuses | ✅ DB / 🟡 UI | `tests/db/workflows.test.ts` › transitions; `tests/unit/order-status.test.ts` |
| Commission and sales report | 🟡 | `src/app/supplier/reports/page.tsx` |

## D. Administration
| Item | Status | Evidence |
| --- | --- | --- |
| Admin access not grantable from client | ✅ | `tests/db/workflows.test.ts` › "prevents a buyer from changing their own role to admin" and INVALID_ROLE |
| Supplier approval workflow with reasons | ✅ | `tests/db/workflows.test.ts` › supplier approval block |
| Buyer suspension with reason; self-suspension blocked | ✅ | `tests/db/workflows.test.ts` › administrator controls |
| Product moderation (reason required on rejection) | ✅ | `tests/db/workflows.test.ts` › "requires a reason to reject a product" |
| Order management | ✅ UI list + DB | `src/app/admin/orders/page.tsx`; route sweep |
| Commission rules, precedence and rate freeze | ✅ | `tests/db/workflows.test.ts` › commission block; `tests/unit/commission.test.ts` |
| Dispute resolution (partial, full, none) with commission reconciliation | ✅ | `tests/db/workflows.test.ts` › dispute block |
| Audit logs | ✅ | `tests/db/workflows.test.ts` › "writes an audit entry…" and "keeps the audit log admin-only" |
| Real database-backed dashboard | 🟡 | `src/lib/data/admin.ts` |
| CSV exports | 🟡 | `src/app/admin/exports/[name]/route.ts` (admin check + formula-injection guard) |

## E. Security and data isolation
| Item | Status | Evidence |
| --- | --- | --- |
| RLS on every table | ✅ | `tests/db/workflows.test.ts` (isolation tests across buyer, supplier, anon, admin) |
| Buyers cannot read other buyers' orders | ✅ | `tests/db/workflows.test.ts` › "stops buyers from reading each other's orders…" |
| Suppliers cannot read other suppliers' orders | ✅ | `tests/db/workflows.test.ts` › "stops one supplier from reading another supplier's orders" |
| Anonymous access blocked from private tables and RPCs | ✅ | `tests/db/workflows.test.ts` › anonymous tests |
| Append-only order event log | ✅ | `tests/db/workflows.test.ts` › "makes the order event log append-only" |
| Service-role key never used by the app | ✅ | `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|service_role" src/` returns no matches (checked) |
| Secrets not committed | ✅ | `.gitignore` excludes `.env*` except `.env.example` |
| Safe redirects after login | ✅ | `tests/unit/redirects.test.ts` (`safeNextPath`) |

## F. Money and orders
| Item | Status | Evidence |
| --- | --- | --- |
| Integer IQD only | ✅ | `src/lib/domain/money.ts`; `bigint` columns |
| IQD 300,000 at 4% = IQD 12,000 | ✅ | `tests/unit/commission.test.ts`; `tests/db/workflows.test.ts` › "creates exactly IQD 12,000…" |
| One commission per order | ✅ | `tests/db/workflows.test.ts` › "never creates a second commission record" |
| Status transitions validated on server; matrix parity | ✅ | `tests/db/order-status-parity.test.ts` (256 combinations) |
| Delivery fees excluded from commission | 🟡 | By construction: the commission base is summed from `order_items` only and never reads `delivery_fee_iqd`. No test sets a non-zero fee yet (fees are always 0 in the MVP) |

## G. Engineering quality
| Item | Status | Evidence |
| --- | --- | --- |
| TypeScript strict type check | ✅ | `npm run typecheck` |
| ESLint | ✅ | `npm run lint` |
| Unit tests | ✅ | `npm run test` |
| Database tests on real PostgreSQL 17 | ✅ | `npm run test:db` |
| Production build | ✅ | `npm run build` |
| Browser RTL/responsive layout check | ✅ for routes that render without data (setup screen, 404) at 375px and 1280px; 🟡 data-backed pages need Supabase | `npm run test:e2e` (prints NOTE for unverified content) |
| Seed/demo data clearly labelled and gated | ✅ | `scripts/seed-demo.ts` (refuses without `VENDORA_ALLOW_DEMO_SEED=true`) |
| Setup, deployment, operations, backup and recovery docs | ✅ | `docs/SETUP.md`, `DEPLOYMENT.md`, `OPERATIONS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `LIMITATIONS.md` |

## H. Deployment
| Item | Status | Evidence |
| --- | --- | --- |
| Vercel-compatible Next.js app in `vendora/` | ✅ build | `npm run build` |
| Supabase migrations ready | ✅ | applied to PGlite in `npm run test:db`; not yet applied to a hosted project |
| Live deployment with a public URL | ⬜ | Requires Supabase and Vercel accounts and founder approval |
