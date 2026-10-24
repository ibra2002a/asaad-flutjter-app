-- =============================================================================
-- VENDORA · 0400 · Row Level Security and column-level grants
--
-- Defence in depth:
--   1. Table privileges: clients get SELECT broadly, and INSERT/UPDATE only on
--      explicitly listed safe columns. Privileged columns (role, verification,
--      prices of orders, commission, dispute outcomes) are never granted.
--   2. RLS policies restrict rows to the caller's own records.
--   3. Privileged mutations go through SECURITY DEFINER functions that check
--      the caller's role and write an audit trail.
-- =============================================================================

alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.supplier_coverage enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commissions enable row level security;
alter table public.commission_adjustments enable row level security;
alter table public.disputes enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- ------------------------------------------------------------- base privileges --
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.cities, public.categories to anon, authenticated;
grant select on public.businesses, public.supplier_coverage, public.products, public.product_images to anon, authenticated;
grant select on public.profiles, public.addresses, public.orders, public.order_items, public.order_events to authenticated;
grant select on public.commission_rules, public.commissions, public.commission_adjustments, public.disputes to authenticated;
grant select on public.notifications, public.audit_logs to authenticated;

grant usage on schema public to anon, authenticated;

-- Column-level write grants. Anything not listed here cannot be written by clients.
grant update (full_name, phone) on public.profiles to authenticated;
grant update (legal_name, description_ar, tax_number, street_address, phone, city_code)
  on public.businesses to authenticated;
grant insert, delete on public.supplier_coverage to authenticated;
grant insert, update, delete on public.addresses to authenticated;
grant insert (supplier_id, category_id, name_ar, description_ar, unit, price_iqd, sale_price_iqd,
              min_order_qty, max_order_qty, stock_qty, status)
  on public.products to authenticated;
grant update (category_id, name_ar, description_ar, unit, price_iqd, sale_price_iqd,
              min_order_qty, max_order_qty, stock_qty, status)
  on public.products to authenticated;
grant delete on public.products to authenticated;
grant insert, delete on public.product_images to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ----------------------------------------------------------------- profiles --
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------- cities/categories --
create policy cities_read on public.cities for select to anon, authenticated
  using (true);

create policy categories_read on public.categories for select to anon, authenticated
  using (is_active or public.is_admin());

-- ----------------------------------------------------------------- businesses --
-- Approved suppliers are public storefronts. Everyone else is private to the
-- owner, admins, and suppliers/buyers that share an order.
-- Anonymous visitors: approved supplier storefronts only. Split from the
-- authenticated policy so anon never needs SELECT on orders.
create policy businesses_select_public on public.businesses for select to anon
  using (kind = 'supplier' and verification_status = 'approved');

create policy businesses_select_authenticated on public.businesses for select to authenticated
  using (
    (kind = 'supplier' and verification_status = 'approved')
    or owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.buyer_business_id = businesses.id
        and o.supplier_business_id = public.my_business_id()
    )
    or exists (
      select 1 from public.orders o
      where o.supplier_business_id = businesses.id
        and o.buyer_id = auth.uid()
    )
  );

create policy businesses_update_own on public.businesses for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy supplier_coverage_select on public.supplier_coverage for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = supplier_coverage.business_id
        and ((b.kind = 'supplier' and b.verification_status = 'approved') or b.owner_id = auth.uid())
    )
  );

create policy supplier_coverage_insert_own on public.supplier_coverage for insert to authenticated
  with check (business_id = public.my_business_id());

create policy supplier_coverage_delete_own on public.supplier_coverage for delete to authenticated
  using (business_id = public.my_business_id());

-- ------------------------------------------------------------------ addresses --
create policy addresses_select_own on public.addresses for select to authenticated
  using (profile_id = auth.uid());
create policy addresses_insert_own on public.addresses for insert to authenticated
  with check (profile_id = auth.uid());
create policy addresses_update_own on public.addresses for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy addresses_delete_own on public.addresses for delete to authenticated
  using (profile_id = auth.uid());

-- ------------------------------------------------------------------- products --
-- Public: only moderated, active products from approved suppliers in active categories.
create policy products_public_read on public.products for select to anon, authenticated
  using (
    (status = 'active'
      and public.is_approved_business(supplier_id)
      and exists (select 1 from public.categories c where c.id = products.category_id and c.is_active))
    or supplier_id = public.my_business_id()
    or public.is_admin()
  );

create policy products_insert_own on public.products for insert to authenticated
  with check (supplier_id = public.my_business_id() and public.is_approved_business(supplier_id));

create policy products_update_own on public.products for update to authenticated
  using (supplier_id = public.my_business_id())
  with check (supplier_id = public.my_business_id());

create policy products_delete_own on public.products for delete to authenticated
  using (supplier_id = public.my_business_id());

create policy product_images_read on public.product_images for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and ((p.status = 'active' and public.is_approved_business(p.supplier_id))
             or p.supplier_id = public.my_business_id()
             or public.is_admin())
    )
  );

create policy product_images_insert_own on public.product_images for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.supplier_id = public.my_business_id()
  ));

create policy product_images_delete_own on public.product_images for delete to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.supplier_id = public.my_business_id()
  ));

-- --------------------------------------------------------------------- orders --
-- Orders are created and changed ONLY through place_order / transition_order /
-- open_dispute (SECURITY DEFINER). Direct writes are not granted.
create policy orders_select on public.orders for select to authenticated
  using (buyer_id = auth.uid() or supplier_business_id = public.my_business_id() or public.is_admin());

create policy order_items_select on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.buyer_id = auth.uid() or o.supplier_business_id = public.my_business_id() or public.is_admin())
  ));

create policy order_events_select on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_events.order_id
      and (o.buyer_id = auth.uid() or o.supplier_business_id = public.my_business_id() or public.is_admin())
  ));

-- ----------------------------------------------------------------- commission --
create policy commission_rules_admin_read on public.commission_rules for select to authenticated
  using (public.is_admin());

create policy commissions_select on public.commissions for select to authenticated
  using (supplier_business_id = public.my_business_id() or public.is_admin());

create policy commission_adjustments_select on public.commission_adjustments for select to authenticated
  using (exists (
    select 1 from public.commissions c
    where c.id = commission_adjustments.commission_id
      and (c.supplier_business_id = public.my_business_id() or public.is_admin())
  ));

-- ------------------------------------------------------------------- disputes --
create policy disputes_select on public.disputes for select to authenticated
  using (
    opened_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = disputes.order_id and o.supplier_business_id = public.my_business_id()
    )
  );

-- -------------------------------------------------------------- notifications --
create policy notifications_select_own on public.notifications for select to authenticated
  using (profile_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ------------------------------------------------------------------ audit log --
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.is_admin());
