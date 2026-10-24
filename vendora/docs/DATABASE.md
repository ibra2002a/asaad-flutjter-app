# VENDORA — Database reference

PostgreSQL 17 (Supabase). Migrations: `supabase/migrations/`. All money is `bigint`
whole IQD. Timestamps are `timestamptz`. Every table has RLS enabled.

## Tables

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `cities` | Serviceable cities (pilot: Baghdad) | `code` slug pattern |
| `categories` | Product categories (Arabic names) | unique `slug`, `is_active` |
| `profiles` | One per auth user; holds `role` (`buyer`/`supplier`/`admin`) and `is_active` | `id` → `auth.users`; role never client-writable |
| `businesses` | Legal entity per user (buyer or supplier), with `verification_status` | unique `owner_id`; phone format check |
| `supplier_coverage` | Cities a supplier delivers to | unique (`business_id`, `city_code`) |
| `addresses` | Buyer delivery addresses; one default per buyer (trigger) | per-profile |
| `products` | Supplier products with price, sale price, min/max quantity, stock, moderation status | `sale_price < price`; `max ≥ min`; `stock ≥ 0`; status enum |
| `product_images` | Storage paths for product photos (max 8 per product, trigger) | unique (`product_id`, `storage_path`) |
| `orders` | One per supplier per checkout; totals; delivery address snapshot | unique (`buyer_id`, `idempotency_key`, `supplier_business_id`); `total = subtotal + fee` |
| `order_items` | Immutable snapshot of product name, unit, price, quantity; returned quantity; commission rate | `returned ≤ quantity`; `line_total` generated |
| `order_events` | Append-only status history: from, to, actor, role, reason, time | UPDATE/DELETE blocked by trigger |
| `commission_rules` | Rates in basis points by scope (global / category / supplier); history kept | one active rule per target (partial unique indexes) |
| `commissions` | One record per completed order: eligible base and commission | unique `order_id`; `settled` requires `settled_at` |
| `commission_adjustments` | Corrections after returns/disputes | `amount ≠ 0` |
| `disputes` | Buyer-opened disputes with previous status and resolution | one open per order (partial unique index) |
| `notifications` | In-app notifications | link must start with `/` |
| `audit_logs` | Administrator actions with before/after and reason | append-only; admin-readable |

## Enumerations

- `order_status`: `submitted`, `accepted`, `preparing`, `out_for_delivery`, `delivered`, `completed`, `cancelled`, `disputed`
- `product_status`: `draft`, `pending_review`, `active`, `rejected`, `archived`
- `verification_status`: `pending`, `approved`, `rejected`, `suspended`
- `dispute_resolution`: `partial_return`, `refund_full`, `no_action`
- `actor_role`: `buyer`, `supplier`, `admin`, `system`

## Order state machine

```
submitted ──► accepted ──► preparing ──► out_for_delivery ──► delivered ──► completed
   │             │
   ▼             ▼
cancelled     cancelled            (preparing → cancelled: admin only)

delivered / completed ──► disputed ──► (previous status | cancelled on full refund)
```

| From → To | Allowed actors |
| --- | --- |
| submitted → accepted | supplier (owner), admin |
| submitted → cancelled | buyer, supplier (reason required), admin (reason required) |
| accepted → preparing | supplier, admin |
| accepted → cancelled | buyer, admin (reason required) |
| preparing → out_for_delivery | supplier, admin |
| preparing → cancelled | admin (reason required) |
| out_for_delivery → delivered | supplier, admin |
| delivered → completed | buyer, admin |

The same matrix is in `public.order_transition_allowed()` and `src/lib/domain/order-status.ts`. `tests/db/order-status-parity.test.ts` checks all 256 combinations.

## Functions (SECURITY DEFINER unless noted)

| Function | Who | What it guarantees |
| --- | --- | --- |
| `place_order(address_id, items, idempotency_key)` | buyer | Atomic checkout; server prices; stock lock; one order per supplier; idempotent |
| `transition_order(order_id, to, reason)` | buyer / supplier / admin | Validates actor and matrix; writes event; restores stock on cancel; accrues commission on completion |
| `open_dispute(order_id, kind, item, qty, reason)` | buyer | Only after delivery; one open per order; freezes order |
| `admin_resolve_dispute(id, resolution, note, qty)` | admin | Applies return or refund; reconciles commission; audits |
| `admin_review_business(id, status, note)` | admin | Approve, reject or suspend a business; notifies owner; audits |
| `admin_review_product(id, status, note)` | admin | Approve or reject a product; notifies supplier; audits |
| `admin_set_profile_active(id, active, reason)` | admin | Suspend or reactivate a user; cannot target self; audits |
| `admin_set_commission_rule(scope, category, supplier, bp, note)` | admin | Retires the previous active rule for the target; audits |
| `admin_mark_commission_settled(id)` | admin | Manual reconciliation marker; audits |
| `admin_upsert_category(...)` | admin | Category maintenance; audits |
| `accrue_commission(order_id)` | internal | Creates the single commission record (idempotent) |
| `reconcile_commission(order_id, dispute, actor, reason)` | internal | Inserts one adjustment to match the recalculated target |
| `resolve_commission_rate(supplier, category)` | internal | Supplier > category > global |
| `commission_for_line(base, bp)` | immutable | Half-up integer rounding |
| `current_app_role()`, `is_admin()`, `my_business_id()`, `is_approved_business()` | policy helpers | Read-only, RLS-safe |
| `handle_new_user()` (trigger on `auth.users`) | system | Creates profile and business; accepts only buyer/supplier roles |
| `guard_product_write()` (trigger) | system | Suppliers cannot set active/rejected or moderation notes |
| `notify_order_event()` (trigger) | system | In-app notification to the other party for each status change |

## Row Level Security summary

| Table | Anonymous | Buyer | Supplier | Admin |
| --- | --- | --- | --- | --- |
| `businesses` | approved suppliers | own + parties to own orders | own + buyers who ordered | all (read) |
| `products` | active, approved supplier, active category | same | own (all statuses) | all |
| `orders`, `order_items`, `order_events` | — | own | assigned to own business | all |
| `addresses` | — | own (CRUD) | — | — |
| `commissions` | — | — | own business | all |
| `disputes` | — | own | on own orders | all |
| `notifications` | — | own | own | own |
| `audit_logs` | — | — | — | all |
| `commission_rules` | — | — | — | all |

Writes to `orders`, `commissions`, `disputes`, `businesses.verification_status`, and `profiles.role` are not granted to clients at all; they only happen through the functions above.

## Column-level write grants (authenticated)

- `profiles`: `full_name`, `phone`
- `businesses`: `legal_name`, `description_ar`, `tax_number`, `street_address`, `phone`, `city_code`
- `products`: insert and update of listing fields and `status` (guarded by trigger); `moderation_note` is not writable
- `addresses`: insert, update, delete (own)
- `supplier_coverage`: insert, delete (own)
- `product_images`: insert, delete (own product)
- `notifications`: `read_at` only

## Indexes

Foreign-key columns used in filters have indexes (buyer/order date, supplier/status, product status/category, commission supplier/date, audit entity and date, notifications per profile).

## Extending the schema

Add a new file in `supabase/migrations/` with a later timestamp. Never edit an applied migration. Add a test in `tests/db/` for every new rule.
