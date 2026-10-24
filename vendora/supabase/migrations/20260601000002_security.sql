-- VENDORA: helper functions, Row Level Security policies and column-level grants.
--
-- Principles:
--   * Clients never write orders, order items, events, commissions or disputes directly.
--     All writes go through SECURITY DEFINER functions that check the caller (see functions migration).
--   * Column grants stop users from changing their own role, approval status, etc.
--   * Public catalog data is limited to approved suppliers and published products.
--   * Private business contact details are only visible to the owner, staff and order counterparties.

-- ---------------------------------------------------------------------------
-- Helper functions used inside policies.
-- SECURITY DEFINER + empty search_path avoids RLS recursion and search-path attacks.
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

-- The current user's id, but only while their profile is active. Owner-based policies use this,
-- so deactivating a user (admin_set_user_active) removes their access everywhere.
create or replace function public.active_uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

create or replace function public.my_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.businesses b where b.owner_id = public.active_uid() limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() in ('ops', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() = 'admin', false);
$$;

create or replace function public.is_approved_supplier(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.kind = 'supplier' and b.status = 'approved'
  );
$$;

revoke all on function public.app_role() from public;
revoke all on function public.active_uid() from public;
revoke all on function public.my_business_id() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_approved_supplier(uuid) from public;
grant execute on function public.app_role() to anon, authenticated;
grant execute on function public.active_uid() to anon, authenticated;
grant execute on function public.my_business_id() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_approved_supplier(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on every public table (deny by default).
-- ---------------------------------------------------------------------------
alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.supplier_coverage enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.addresses enable row level security;
alter table public.commission_rules enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.order_transitions enable row level security;
alter table public.commissions enable row level security;
alter table public.disputes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_hits enable row level security;

-- Start from zero privileges, then grant the minimum needed.
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- cities / categories: public reads of active rows, admin maintenance.
-- ---------------------------------------------------------------------------
grant select on public.cities to anon, authenticated;
create policy cities_public_read on public.cities
  for select to anon, authenticated using (true);
create policy cities_admin_insert on public.cities
  for insert to authenticated with check (public.is_admin());
create policy cities_admin_update on public.cities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update on public.cities to authenticated;

grant select on public.categories to anon, authenticated;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active or public.is_staff());
create policy categories_admin_insert on public.categories
  for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update on public.categories to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: users see their own row; staff see all. Users may change only
-- full_name and phone. Role and activation are changed by admin functions.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select public.active_uid()));
create policy profiles_select_staff on public.profiles
  for select to authenticated using (public.is_staff());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select public.active_uid())) with check (id = (select public.active_uid()));
grant update (full_name, phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- businesses: owner, staff and order counterparties can read the full row.
-- Owners can edit descriptive fields only (status is changed by admin function).
-- Public catalog uses the supplier_directory view below.
-- ---------------------------------------------------------------------------
grant select on public.businesses to authenticated;
create policy businesses_select_owner on public.businesses
  for select to authenticated using (owner_id = (select public.active_uid()));
create policy businesses_select_staff on public.businesses
  for select to authenticated using (public.is_staff());
create policy businesses_select_counterparty on public.businesses
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where (o.buyer_business_id = businesses.id and o.supplier_business_id = public.my_business_id())
         or (o.supplier_business_id = businesses.id and o.buyer_id = (select public.active_uid()))
    )
  );
create policy businesses_update_owner on public.businesses
  for update to authenticated
  using (owner_id = (select public.active_uid())) with check (owner_id = (select public.active_uid()));
grant update (name, description, city_code, address, phone) on public.businesses to authenticated;

-- Public, non-sensitive projection of approved suppliers (no phone or street address).
-- The view runs with the owner's privileges and filters rows explicitly.
create view public.supplier_directory as
  select b.id, b.name, b.description, b.city_code, b.created_at
  from public.businesses b
  where b.kind = 'supplier' and b.status = 'approved';
grant select on public.supplier_directory to anon, authenticated;

-- ---------------------------------------------------------------------------
-- supplier_coverage: public read for approved suppliers; owners manage their own.
-- ---------------------------------------------------------------------------
grant select on public.supplier_coverage to anon, authenticated;
create policy coverage_public_read on public.supplier_coverage
  for select to anon, authenticated using (
    public.is_approved_supplier(business_id)
    or business_id = public.my_business_id()
    or public.is_staff()
  );
create policy coverage_owner_insert on public.supplier_coverage
  for insert to authenticated with check (
    business_id = public.my_business_id() and public.app_role() = 'supplier'
  );
create policy coverage_owner_delete on public.supplier_coverage
  for delete to authenticated using (
    business_id = public.my_business_id() and public.app_role() = 'supplier'
  );
grant insert, delete on public.supplier_coverage to authenticated;

-- ---------------------------------------------------------------------------
-- products: public sees published products of approved suppliers only.
-- Suppliers manage their own products; publishing requires an approved business.
-- ---------------------------------------------------------------------------
grant select on public.products to anon, authenticated;
create policy products_public_read on public.products
  for select to anon, authenticated using (
    (is_published and public.is_approved_supplier(business_id))
    or (business_id = public.my_business_id() and public.app_role() = 'supplier')
    or public.is_staff()
  );
create policy products_supplier_insert on public.products
  for insert to authenticated with check (
    business_id = public.my_business_id()
    and public.app_role() = 'supplier'
    and (not is_published or public.is_approved_supplier(business_id))
  );
create policy products_supplier_update on public.products
  for update to authenticated
  using (business_id = public.my_business_id() and public.app_role() = 'supplier')
  with check (
    business_id = public.my_business_id()
    and public.app_role() = 'supplier'
    and (not is_published or public.is_approved_supplier(business_id))
  );
create policy products_supplier_delete on public.products
  for delete to authenticated using (
    business_id = public.my_business_id() and public.app_role() = 'supplier'
  );
create policy products_admin_all on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.products to authenticated;

grant select on public.product_images to anon, authenticated;
create policy product_images_read on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_images.product_id)
  );
create policy product_images_supplier_insert on public.product_images
  for insert to authenticated with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.business_id = public.my_business_id() and public.app_role() = 'supplier'
    )
  );
create policy product_images_supplier_delete on public.product_images
  for delete to authenticated using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.business_id = public.my_business_id() and public.app_role() = 'supplier'
    )
  );
grant insert, delete on public.product_images to authenticated;

-- ---------------------------------------------------------------------------
-- addresses: owner only.
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.addresses to authenticated;
grant update (label, city_code, address_line, landmark) on public.addresses to authenticated;
create policy addresses_owner_select on public.addresses
  for select to authenticated using (owner_id = (select public.active_uid()));
create policy addresses_owner_insert on public.addresses
  for insert to authenticated with check (owner_id = (select public.active_uid()) and public.app_role() = 'buyer');
create policy addresses_owner_update on public.addresses
  for update to authenticated
  using (owner_id = (select public.active_uid())) with check (owner_id = (select public.active_uid()));
create policy addresses_owner_delete on public.addresses
  for delete to authenticated using (owner_id = (select public.active_uid()));

-- ---------------------------------------------------------------------------
-- orders: buyers see their own orders, suppliers see orders assigned to them,
-- staff see all. Clients have no write privileges on orders at all.
-- ---------------------------------------------------------------------------
grant select on public.orders to authenticated;
create policy orders_select_buyer on public.orders
  for select to authenticated using (buyer_id = (select public.active_uid()));
create policy orders_select_supplier on public.orders
  for select to authenticated using (
    supplier_business_id = public.my_business_id() and public.app_role() = 'supplier'
  );
create policy orders_select_staff on public.orders
  for select to authenticated using (public.is_staff());

grant select on public.order_items to authenticated;
create policy order_items_select on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_items.order_id)
  );

grant select on public.order_events to authenticated;
create policy order_events_select on public.order_events
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_events.order_id)
  );

grant select on public.order_transitions to authenticated;
create policy order_transitions_read on public.order_transitions
  for select to authenticated using (true);

-- Disputes follow the visibility of their order.
grant select on public.disputes to authenticated;
create policy disputes_select on public.disputes
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = disputes.order_id)
  );

-- ---------------------------------------------------------------------------
-- Commissions, commission rules, audit logs: admin only.
-- ---------------------------------------------------------------------------
grant select on public.commissions to authenticated;
create policy commissions_admin_select on public.commissions
  for select to authenticated using (public.is_admin());

grant select on public.commission_rules to authenticated;
create policy commission_rules_admin_select on public.commission_rules
  for select to authenticated using (public.is_admin());

grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated using (public.is_admin());

-- rate_limit_hits: no client privileges at all (used only by consume_rate_limit()).
-- No policies are created, so RLS denies everything.
