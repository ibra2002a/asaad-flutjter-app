-- =============================================================================
-- VENDORA · 0500 · Order workflow (atomic, server-validated)
--
-- Every error is raised with a stable message code (the part before the colon)
-- that the application maps to a user-facing Arabic message.
-- =============================================================================

-- ------------------------------------------------------------- place_order --
-- p_items: [{"product_id": "<uuid>", "quantity": <int>}, ...]
-- Prices, minimums, stock and status are read from the database, never trusted
-- from the client. One order is created per supplier. Re-submitting with the
-- same idempotency key returns the original orders instead of creating new ones.
create or replace function public.place_order(
  p_address_id uuid,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_buyer_biz public.businesses%rowtype;
  v_addr public.addresses%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_supplier public.businesses%rowtype;
  v_qty integer;
  v_order_key text;
  v_order_id uuid;
  v_order_map jsonb := '{}'::jsonb;
  v_seen_products uuid[] := '{}';
  v_product_id uuid;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.role <> 'buyer' then
    raise exception 'FORBIDDEN_ROLE: only buyers can place orders' using errcode = '42501';
  end if;
  if not v_profile.is_active then
    raise exception 'ACCOUNT_SUSPENDED' using errcode = '42501';
  end if;

  -- Serialize checkouts per buyer so two simultaneous submissions cannot race.
  perform 1 from public.profiles where id = v_uid for update;

  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  -- Duplicate submission: return the orders from the first attempt.
  if exists (select 1 from public.orders where buyer_id = v_uid and idempotency_key = p_idempotency_key) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'order_id', o.id,
             'order_number', o.order_number,
             'supplier_business_id', o.supplier_business_id,
             'total_iqd', o.total_iqd,
             'duplicate', true
           ) order by o.created_at), '[]'::jsonb)
      into v_result
      from public.orders o
     where o.buyer_id = v_uid and o.idempotency_key = p_idempotency_key;
    return v_result;
  end if;

  select * into v_buyer_biz from public.businesses where owner_id = v_uid;
  if not found or v_buyer_biz.verification_status <> 'approved' then
    raise exception 'BUSINESS_NOT_APPROVED' using errcode = '42501';
  end if;

  select * into v_addr from public.addresses where id = p_address_id and profile_id = v_uid;
  if not found then
    raise exception 'ADDRESS_NOT_FOUND';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'INVALID_CART: between 1 and 60 lines are required';
  end if;

  -- Lock every product in one deterministic order to avoid deadlocks.
  perform 1 from public.products p
   where p.id in (
     select (x ->> 'product_id')::uuid from jsonb_array_elements(p_items) x
     where (x ->> 'product_id') ~* '^[0-9a-f-]{36}$'
   )
   order by p.id
   for update;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or (v_item ->> 'product_id') !~* '^[0-9a-f-]{36}$'
       or (v_item ->> 'quantity') !~ '^[0-9]{1,7}$' then
      raise exception 'INVALID_CART_LINE';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty < 1 then
      raise exception 'INVALID_CART_LINE: quantity must be at least 1';
    end if;
    if v_product_id = any (v_seen_products) then
      raise exception 'DUPLICATE_PRODUCT_LINE';
    end if;
    v_seen_products := v_seen_products || v_product_id;

    select * into v_product from public.products where id = v_product_id;
    if not found or v_product.status <> 'active' then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;

    select * into v_supplier from public.businesses where id = v_product.supplier_id;
    if v_supplier.verification_status <> 'approved' then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;
    if not exists (select 1 from public.categories c where c.id = v_product.category_id and c.is_active) then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;

    if v_qty < v_product.min_order_qty then
      raise exception 'QUANTITY_BELOW_MINIMUM: % requires at least %', v_product.name_ar, v_product.min_order_qty;
    end if;
    if v_product.max_order_qty is not null and v_qty > v_product.max_order_qty then
      raise exception 'QUANTITY_ABOVE_MAXIMUM: % allows at most %', v_product.name_ar, v_product.max_order_qty;
    end if;
    if v_qty > v_product.stock_qty then
      raise exception 'INSUFFICIENT_STOCK: % has % available', v_product.name_ar, v_product.stock_qty;
    end if;

    v_order_key := v_product.supplier_id::text;
    if not (v_order_map ? v_order_key) then
      insert into public.orders (
        order_number, buyer_id, buyer_business_id, supplier_business_id,
        delivery_city_code, delivery_address, subtotal_iqd, delivery_fee_iqd, total_iqd, idempotency_key
      ) values (
        public.generate_order_number(), v_uid, v_buyer_biz.id, v_product.supplier_id,
        v_addr.city_code,
        jsonb_build_object(
          'label', v_addr.label,
          'city_code', v_addr.city_code,
          'district', v_addr.district,
          'address_line', v_addr.address_line,
          'phone', v_addr.phone
        ),
        0, 0, 0, p_idempotency_key
      ) returning id into v_order_id;

      insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, reason)
      values (v_order_id, null, 'submitted', v_uid, 'buyer', null);

      v_order_map := v_order_map || jsonb_build_object(v_order_key, v_order_id);
    end if;

    v_order_id := (v_order_map ->> v_order_key)::uuid;

    insert into public.order_items (
      order_id, product_id, category_id, product_name_snapshot, unit_snapshot,
      unit_price_iqd, quantity, commission_rate_bp
    ) values (
      v_order_id, v_product.id, v_product.category_id, v_product.name_ar, v_product.unit,
      coalesce(v_product.sale_price_iqd, v_product.price_iqd), v_qty,
      public.resolve_commission_rate(v_product.supplier_id, v_product.category_id)
    );

    update public.products set stock_qty = stock_qty - v_qty where id = v_product.id;
  end loop;

  -- Fill in order totals from the saved lines. Delivery fees are not configured
  -- for the MVP, so the total equals the product subtotal.
  update public.orders o
     set subtotal_iqd = t.subtotal,
         total_iqd = t.subtotal + o.delivery_fee_iqd
    from (
      select oi.order_id, sum(oi.line_total_iqd) as subtotal
        from public.order_items oi
       where oi.order_id in (select (value)::uuid from jsonb_each_text(v_order_map))
       group by oi.order_id
    ) t
   where o.id = t.order_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'order_id', o.id,
           'order_number', o.order_number,
           'supplier_business_id', o.supplier_business_id,
           'total_iqd', o.total_iqd,
           'duplicate', false
         ) order by o.created_at), '[]'::jsonb)
    into v_result
    from public.orders o
   where o.buyer_id = v_uid and o.idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

revoke execute on function public.place_order(uuid, jsonb, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, text) to authenticated;

-- ----------------------------------------------------- commission creation --
-- Creates the single commission record for an order when it completes.
-- Base = line subtotals after discounts (sale prices) for units not returned.
-- Delivery fees are excluded. Rates were frozen per line at checkout.
create or replace function public.accrue_commission(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.commissions (order_id, supplier_business_id, eligible_base_iqd, commission_iqd)
  select o.id,
         o.supplier_business_id,
         coalesce(sum(x.eligible), 0),
         coalesce(sum(public.commission_for_line(x.eligible, x.rate_bp)), 0)
    from public.orders o
    join lateral (
      select (oi.quantity - oi.returned_quantity)::bigint * oi.unit_price_iqd as eligible,
             oi.commission_rate_bp as rate_bp
        from public.order_items oi
       where oi.order_id = o.id
    ) x on true
   where o.id = p_order_id
   group by o.id, o.supplier_business_id
  on conflict (order_id) do nothing;
end;
$$;

-- Brings the net commission (record + adjustments) in line with the eligible
-- base after returns. Inserts a single adjustment for the difference.
create or replace function public.reconcile_commission(p_order_id uuid, p_dispute_id uuid, p_actor uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission public.commissions%rowtype;
  v_target bigint;
  v_current bigint;
begin
  select * into v_commission from public.commissions where order_id = p_order_id;
  if not found then
    return; -- not completed yet; accrue_commission will use the reduced base later
  end if;

  select coalesce(sum(public.commission_for_line(
           (oi.quantity - oi.returned_quantity)::bigint * oi.unit_price_iqd, oi.commission_rate_bp)), 0)
    into v_target
    from public.order_items oi
   where oi.order_id = p_order_id;

  select v_commission.commission_iqd
       + coalesce((select sum(a.amount_iqd) from public.commission_adjustments a where a.commission_id = v_commission.id), 0)
    into v_current;

  if v_target <> v_current then
    insert into public.commission_adjustments (commission_id, dispute_id, amount_iqd, reason, created_by)
    values (v_commission.id, p_dispute_id, v_target - v_current, coalesce(p_reason, 'تعديل بعد الإرجاع'), p_actor);
  end if;
end;
$$;

-- ------------------------------------------------------ transition_order --
create or replace function public.transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_reason text default null
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_order public.orders%rowtype;
  v_supplier_owner uuid;
  v_actor public.actor_role;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select owner_id into v_supplier_owner from public.businesses where id = v_order.supplier_business_id;
  v_is_admin := public.is_admin();

  v_actor := case
    when v_is_admin then 'admin'::public.actor_role
    when v_uid = v_order.buyer_id then 'buyer'::public.actor_role
    when v_uid = v_supplier_owner then 'supplier'::public.actor_role
    else null
  end;
  if v_actor is null then
    raise exception 'FORBIDDEN: not a party to this order' using errcode = '42501';
  end if;

  if not public.order_transition_allowed(v_order.status, p_to, v_actor) then
    raise exception 'INVALID_TRANSITION: % → %', v_order.status, p_to;
  end if;

  if p_to = 'cancelled' and v_actor <> 'buyer' and v_reason is null then
    raise exception 'REASON_REQUIRED: a reason is required for supplier or admin cancellations';
  end if;

  update public.orders
     set status = p_to,
         cancellation_reason = case when p_to = 'cancelled' then v_reason else cancellation_reason end
   where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, reason)
  values (p_order_id, v_order.status, p_to, v_uid, v_actor, v_reason);

  -- Cancelled orders return unshipped stock to the supplier's inventory.
  if p_to = 'cancelled' then
    update public.products p
       set stock_qty = p.stock_qty + (oi.quantity - oi.returned_quantity)
      from public.order_items oi
     where oi.order_id = p_order_id and oi.product_id = p.id;
  end if;

  if p_to = 'completed' then
    perform public.accrue_commission(p_order_id);
  end if;

  return p_to;
end;
$$;

revoke execute on function public.transition_order(uuid, public.order_status, text) from public, anon;
grant execute on function public.transition_order(uuid, public.order_status, text) to authenticated;

-- ----------------------------------------------------------- disputes --
-- Buyers can open a dispute on a delivered or completed order. Opening one
-- freezes the order in 'disputed' until an admin resolves it.
create or replace function public.open_dispute(
  p_order_id uuid,
  p_kind public.dispute_kind,
  p_order_item_id uuid,
  p_requested_quantity integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_dispute_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id <> v_uid then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('delivered', 'completed') then
    raise exception 'DISPUTE_NOT_ALLOWED: disputes open after delivery only';
  end if;
  if char_length(v_reason) not between 5 and 1000 then
    raise exception 'INVALID_REASON';
  end if;

  if p_kind = 'return' then
    select * into v_item from public.order_items where id = p_order_item_id and order_id = p_order_id;
    if not found then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if p_requested_quantity is null or p_requested_quantity < 1
       or p_requested_quantity > v_item.quantity - v_item.returned_quantity then
      raise exception 'QUANTITY_INVALID: return quantity must be between 1 and %', v_item.quantity - v_item.returned_quantity;
    end if;
  end if;

  insert into public.disputes (
    order_id, opened_by, kind, order_item_id, requested_quantity, reason, previous_status
  ) values (
    p_order_id, v_uid, p_kind,
    case when p_kind = 'return' then p_order_item_id else null end,
    case when p_kind = 'return' then p_requested_quantity else null end,
    v_reason, v_order.status
  ) returning id into v_dispute_id;

  update public.orders set status = 'disputed' where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, reason)
  values (p_order_id, v_order.status, 'disputed', v_uid, 'buyer', v_reason);

  return v_dispute_id;
end;
$$;

revoke execute on function public.open_dispute(uuid, public.dispute_kind, uuid, integer, text) from public, anon;
grant execute on function public.open_dispute(uuid, public.dispute_kind, uuid, integer, text) to authenticated;
