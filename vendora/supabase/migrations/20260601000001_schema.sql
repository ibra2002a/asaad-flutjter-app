-- VENDORA: core schema.
-- Conventions:
--   * Money is stored as whole IQD integers (bigint). Commission rates are basis points (400 = 4%).
--   * Status and role values are text with CHECK constraints (easy to evolve with a migration).
--   * Every table has created_at; mutable tables also have updated_at (maintained by trigger).

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference: cities (Iraqi governorates). Pilot launch = Baghdad.
-- ---------------------------------------------------------------------------
create table public.cities (
  code text primary key check (code ~ '^[a-z_]{2,30}$'),
  name_ar text not null check (char_length(name_ar) between 2 and 60),
  is_pilot boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users: one profile per auth user. Role is never chosen freely at signup.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'buyer' check (role in ('buyer', 'supplier', 'ops', 'admin')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{8,15}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Buyer and supplier business profiles. One business per user.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('buyer', 'supplier')),
  name text not null check (char_length(name) between 2 and 150),
  description text check (char_length(description) <= 1000),
  city_code text not null references public.cities (code),
  address text check (char_length(address) <= 300),
  phone text not null check (phone ~ '^\+?[0-9]{8,15}$'),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_kind_status_idx on public.businesses (kind, status);

-- Cities a supplier delivers to.
create table public.supplier_coverage (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  city_code text not null references public.cities (code),
  created_at timestamptz not null default now(),
  unique (business_id, city_code)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar text not null check (char_length(name_ar) between 2 and 100),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 150),
  description text check (char_length(description) <= 2000),
  unit text not null check (char_length(unit) between 1 and 40),
  price_iqd integer not null check (price_iqd between 1 and 100000000),
  min_quantity integer not null default 1 check (min_quantity between 1 and 100000),
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock', 'limited', 'out_of_stock')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_business_idx on public.products (business_id);
create index products_category_idx on public.products (category_id);
create index products_published_idx on public.products (is_published) where is_published;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 10 and 300),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- Buyer delivery addresses
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  city_code text not null references public.cities (code),
  address_line text not null check (char_length(address_line) between 5 and 300),
  landmark text check (char_length(landmark) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_owner_idx on public.addresses (owner_id);

-- ---------------------------------------------------------------------------
-- Commission rules (configurable; a rule is immutable once created, only its
-- active flag changes). Exactly one rule may be active at a time.
-- ---------------------------------------------------------------------------
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  rate_bps integer not null check (rate_bps between 0 and 3000),
  dispute_window_hours integer not null default 48 check (dispute_window_hours between 0 and 720),
  delivery_fee_commissionable boolean not null default false,
  is_active boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index commission_rules_single_active on public.commission_rules (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^VDR-[0-9]{6}-[A-Z0-9]{6}$'),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  buyer_business_id uuid not null references public.businesses (id) on delete restrict,
  supplier_business_id uuid not null references public.businesses (id) on delete restrict,
  status text not null default 'submitted' check (status in (
    'submitted', 'accepted', 'preparing', 'out_for_delivery',
    'delivered', 'completed', 'cancelled', 'disputed'
  )),
  subtotal_iqd bigint not null check (subtotal_iqd > 0),
  discount_iqd bigint not null default 0 check (discount_iqd >= 0 and discount_iqd <= subtotal_iqd),
  delivery_fee_iqd bigint not null default 0 check (delivery_fee_iqd >= 0),
  total_iqd bigint not null check (total_iqd >= 0),
  payment_method text not null check (payment_method in ('cash_on_delivery', 'bank_transfer', 'credit_agreement')),
  delivery_city_code text not null references public.cities (code),
  delivery_address text not null check (char_length(delivery_address) between 5 and 400),
  contact_phone text not null check (contact_phone ~ '^\+?[0-9]{8,15}$'),
  buyer_notes text check (char_length(buyer_notes) <= 1000),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_check check (total_iqd = subtotal_iqd - discount_iqd + delivery_fee_iqd),
  constraint orders_distinct_parties check (buyer_business_id <> supplier_business_id),
  constraint orders_completed_check check (status <> 'completed' or completed_at is not null),
  constraint orders_cancelled_check check (status <> 'cancelled' or cancelled_at is not null),
  constraint orders_idempotency_unique unique (buyer_id, idempotency_key)
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_supplier_idx on public.orders (supplier_business_id, status, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

-- Immutable snapshots of product name, unit and price at order time.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null check (char_length(product_name) between 2 and 150),
  product_unit text not null check (char_length(product_unit) between 1 and 40),
  unit_price_iqd integer not null check (unit_price_iqd between 1 and 100000000),
  quantity integer not null check (quantity between 1 and 100000),
  line_total_iqd bigint not null check (line_total_iqd = unit_price_iqd::bigint * quantity),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index order_items_order_idx on public.order_items (order_id);

-- Append-only status history: actor, timestamp and optional note for every transition.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in (
    'submitted', 'accepted', 'preparing', 'out_for_delivery',
    'delivered', 'completed', 'cancelled', 'disputed'
  )),
  actor_id uuid references public.profiles (id) on delete restrict,
  actor_role text not null check (actor_role in ('buyer', 'supplier', 'ops', 'admin')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- Allowed status transitions and who may perform them. Enforced by transition_order().
-- Mirrored in src/lib/orders/rules.ts and checked by tests.
create table public.order_transitions (
  from_status text not null,
  to_status text not null,
  allowed_roles text[] not null,
  primary key (from_status, to_status),
  check (from_status in (
    'submitted', 'accepted', 'preparing', 'out_for_delivery',
    'delivered', 'completed', 'cancelled', 'disputed'
  )),
  check (to_status in (
    'submitted', 'accepted', 'preparing', 'out_for_delivery',
    'delivered', 'completed', 'cancelled', 'disputed'
  ))
);

-- One commission per order (unique order_id). Values are computed in the database.
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  supplier_business_id uuid not null references public.businesses (id) on delete restrict,
  commission_rule_id uuid references public.commission_rules (id) on delete restrict,
  eligible_subtotal_iqd bigint not null check (eligible_subtotal_iqd >= 0),
  rate_bps integer not null check (rate_bps between 0 and 3000),
  -- Round half up: floor((eligible * rate_bps + 5000) / 10000)
  commission_iqd bigint not null check (commission_iqd >= 0),
  status text not null default 'pending' check (status in ('pending', 'on_hold', 'voided', 'paid')),
  completed_at timestamptz not null,
  payable_at timestamptz not null,
  voided_reason text check (char_length(voided_reason) <= 200),
  paid_at timestamptz,
  paid_reference text check (char_length(paid_reference) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commissions_formula_check check (commission_iqd = ((eligible_subtotal_iqd * rate_bps + 5000) / 10000)),
  constraint commissions_paid_check check ((status = 'paid') = (paid_at is not null)),
  constraint commissions_voided_check check ((status = 'voided') = (voided_reason is not null))
);
create index commissions_status_payable_idx on public.commissions (status, payable_at);
create index commissions_supplier_idx on public.commissions (supplier_business_id);

-- Disputes. At most one open dispute per order.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  opened_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved_completed', 'resolved_cancelled')),
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_resolution_check check ((status = 'open') = (resolved_at is null))
);
create unique index disputes_one_open_per_order on public.disputes (order_id) where status = 'open';
create index disputes_order_idx on public.disputes (order_id);

-- Audit trail for sensitive administrative actions. Written by triggers only.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null check (char_length(action) between 2 and 20),
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

-- Generic database-backed rate limiting for sensitive endpoints.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null check (char_length(bucket) between 3 and 200),
  hit_at timestamptz not null default now()
);
create index rate_limit_hits_bucket_idx on public.rate_limit_hits (bucket, hit_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger addresses_set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger commissions_set_updated_at before update on public.commissions
  for each row execute function public.set_updated_at();
create trigger disputes_set_updated_at before update on public.disputes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Transition matrix (documented business rules)
-- ---------------------------------------------------------------------------
insert into public.order_transitions (from_status, to_status, allowed_roles) values
  ('submitted',        'accepted',         array['supplier', 'ops', 'admin']),
  ('submitted',        'cancelled',        array['buyer', 'supplier', 'ops', 'admin']),
  ('accepted',         'preparing',        array['supplier', 'admin']),
  ('accepted',         'cancelled',        array['supplier', 'ops', 'admin']),
  ('preparing',        'out_for_delivery', array['supplier', 'admin']),
  ('preparing',        'cancelled',        array['supplier', 'ops', 'admin']),
  ('out_for_delivery', 'delivered',        array['supplier', 'admin']),
  ('delivered',        'completed',        array['ops', 'admin']),
  ('delivered',        'disputed',         array['buyer', 'ops', 'admin']),
  ('completed',        'disputed',         array['buyer', 'ops', 'admin']),
  ('disputed',         'completed',        array['ops', 'admin']),
  ('disputed',         'cancelled',        array['ops', 'admin']);
