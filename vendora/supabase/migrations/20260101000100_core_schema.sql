-- =============================================================================
-- VENDORA · 0100 · Core schema
-- Conventions:
--   * Money is stored as whole IQD integers (bigint). Never floating point.
--   * Every table has created_at; mutable tables also have updated_at.
--   * Privileged state (roles, verification, commission, dispute outcomes)
--     is changed only through SECURITY DEFINER functions that check the caller.
-- =============================================================================

create type public.app_role as enum ('buyer', 'supplier', 'admin');
create type public.business_kind as enum ('buyer', 'supplier');
create type public.verification_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.product_status as enum ('draft', 'pending_review', 'active', 'rejected', 'archived');
create type public.order_status as enum (
  'submitted', 'accepted', 'preparing', 'out_for_delivery',
  'delivered', 'completed', 'cancelled', 'disputed'
);
create type public.actor_role as enum ('buyer', 'supplier', 'admin', 'system');
create type public.commission_scope as enum ('global', 'category', 'supplier');
create type public.dispute_kind as enum ('return', 'quality', 'other');
create type public.dispute_status as enum ('open', 'resolved');
create type public.dispute_resolution as enum ('partial_return', 'refund_full', 'no_action');

-- ---------------------------------------------------------------- reference --
create table public.cities (
  code text primary key check (code ~ '^[a-z]+(-[a-z]+)*$'),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 60),
  is_active boolean not null default true
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 80),
  description_ar text check (description_ar is null or char_length(description_ar) <= 500),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- identity --
-- profiles.id mirrors auth.users.id. The role column is NEVER writable by
-- clients: see 0400_rls_grants.sql (column-level grants) and the trigger in
-- 0300_functions_triggers.sql.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'buyer',
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  kind public.business_kind not null,
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 160),
  description_ar text check (description_ar is null or char_length(description_ar) <= 2000),
  tax_number text check (tax_number is null or char_length(tax_number) <= 40),
  city_code text not null references public.cities (code),
  street_address text check (street_address is null or char_length(street_address) <= 300),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  verification_status public.verification_status not null default 'pending',
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_kind_status_idx on public.businesses (kind, verification_status);
create index businesses_city_idx on public.businesses (city_code);

create table public.supplier_coverage (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  city_code text not null references public.cities (code),
  created_at timestamptz not null default now(),
  unique (business_id, city_code)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 40),
  city_code text not null references public.cities (code),
  district text not null check (char_length(btrim(district)) between 2 and 80),
  address_line text not null check (char_length(btrim(address_line)) between 5 and 300),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_profile_idx on public.addresses (profile_id);

-- ----------------------------------------------------------------- catalogue --
create table public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.businesses (id) on delete restrict,
  category_id uuid not null references public.categories (id),
  name_ar text not null check (char_length(btrim(name_ar)) between 2 and 160),
  description_ar text check (description_ar is null or char_length(description_ar) <= 4000),
  unit text not null check (unit in ('piece', 'carton', 'pack', 'kg', 'liter', 'meter', 'bag', 'box', 'set')),
  price_iqd bigint not null check (price_iqd > 0 and price_iqd <= 1000000000),
  sale_price_iqd bigint check (sale_price_iqd is null or (sale_price_iqd > 0 and sale_price_iqd < price_iqd)),
  min_order_qty integer not null default 1 check (min_order_qty between 1 and 1000000),
  max_order_qty integer check (max_order_qty is null or max_order_qty >= min_order_qty),
  stock_qty integer not null default 0 check (stock_qty >= 0 and stock_qty <= 10000000),
  status public.product_status not null default 'draft',
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_category_idx on public.products (status, category_id);
create index products_supplier_idx on public.products (supplier_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 5 and 300),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, storage_path)
);
create index product_images_product_idx on public.product_images (product_id, position);

-- -------------------------------------------------------------------- orders --
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^VND-[0-9]{6}-[A-Z0-9]{5}$'),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  buyer_business_id uuid not null references public.businesses (id) on delete restrict,
  supplier_business_id uuid not null references public.businesses (id) on delete restrict,
  status public.order_status not null default 'submitted',
  delivery_city_code text not null references public.cities (code),
  delivery_address jsonb not null,
  currency text not null default 'IQD' check (currency = 'IQD'),
  subtotal_iqd bigint not null check (subtotal_iqd >= 0),
  delivery_fee_iqd bigint not null default 0 check (delivery_fee_iqd >= 0),
  total_iqd bigint not null check (total_iqd >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One checkout (idempotency key) creates one order per supplier. A retried
  -- checkout can never create a second order for the same supplier.
  unique (buyer_id, idempotency_key, supplier_business_id),
  check (total_iqd = subtotal_iqd + delivery_fee_iqd)
);
create index orders_buyer_created_idx on public.orders (buyer_id, created_at desc);
create index orders_supplier_status_idx on public.orders (supplier_business_id, status);
create index orders_status_idx on public.orders (status);

-- Snapshot of the product as it was sold. Later product edits never change
-- historic orders, invoices or commissions.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  product_name_snapshot text not null check (char_length(product_name_snapshot) between 1 and 160),
  unit_snapshot text not null,
  unit_price_iqd bigint not null check (unit_price_iqd > 0),
  quantity integer not null check (quantity between 1 and 10000000),
  returned_quantity integer not null default 0 check (returned_quantity >= 0),
  line_total_iqd bigint generated always as (unit_price_iqd * quantity) stored,
  commission_rate_bp integer not null check (commission_rate_bp between 0 and 3000),
  created_at timestamptz not null default now(),
  check (returned_quantity <= quantity)
);
create index order_items_order_idx on public.order_items (order_id);

-- Append-only audit trail of every status change: who, when, from→to, why.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.actor_role not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------- commission --
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  scope public.commission_scope not null,
  category_id uuid references public.categories (id) on delete cascade,
  supplier_business_id uuid references public.businesses (id) on delete cascade,
  rate_bp integer not null check (rate_bp between 0 and 3000), -- basis points: 400 = 4%
  is_active boolean not null default true,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope = 'global' and category_id is null and supplier_business_id is null)
    or (scope = 'category' and category_id is not null and supplier_business_id is null)
    or (scope = 'supplier' and supplier_business_id is not null and category_id is null)
  )
);
-- At most one ACTIVE rule per target. Old rules remain as history.
create unique index commission_rules_one_active_global
  on public.commission_rules (scope) where scope = 'global' and is_active;
create unique index commission_rules_one_active_category
  on public.commission_rules (category_id) where scope = 'category' and is_active;
create unique index commission_rules_one_active_supplier
  on public.commission_rules (supplier_business_id) where scope = 'supplier' and is_active;

-- One commission record per order, created once when the order completes.
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  supplier_business_id uuid not null references public.businesses (id) on delete restrict,
  eligible_base_iqd bigint not null check (eligible_base_iqd >= 0),
  commission_iqd bigint not null check (commission_iqd >= 0),
  status text not null default 'accrued' check (status in ('accrued', 'settled')),
  settled_at timestamptz,
  settled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'settled') = (settled_at is not null))
);
create index commissions_supplier_idx on public.commissions (supplier_business_id, created_at);

-- Returns/disputes after completion adjust the commission (never edit it).
create table public.commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete restrict,
  dispute_id uuid,
  amount_iqd bigint not null check (amount_iqd <> 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index commission_adjustments_commission_idx on public.commission_adjustments (commission_id);

-- -------------------------------------------------------------------- disputes --
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete restrict,
  kind public.dispute_kind not null,
  order_item_id uuid references public.order_items (id) on delete set null,
  requested_quantity integer check (requested_quantity is null or requested_quantity > 0),
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  previous_status public.order_status not null,
  status public.dispute_status not null default 'open',
  resolution public.dispute_resolution,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'open') = (resolved_at is null)),
  check (kind <> 'return' or (order_item_id is not null and requested_quantity is not null))
);
create unique index disputes_one_open_per_order on public.disputes (order_id) where status = 'open';
create index disputes_order_idx on public.disputes (order_id);

alter table public.commission_adjustments
  add constraint commission_adjustments_dispute_fk
  foreign key (dispute_id) references public.disputes (id) on delete restrict;

-- -------------------------------------------------------------- notifications --
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 1000),
  link text check (link is null or link like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

-- ---------------------------------------------------------------- audit log --
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 3 and 80),
  entity_type text not null check (char_length(entity_type) between 3 and 60),
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
