-- VENDORA: business logic.
-- Every public function below is SECURITY DEFINER with an empty search_path and checks
-- the caller itself. Errors use stable codes (ERR_*) that the application maps to messages.

-- ---------------------------------------------------------------------------
-- Signup: create profile + business. Self-service signup can only create buyers or
-- suppliers; suppliers start as 'pending' and cannot publish or receive orders until approved.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'buyer');
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone text := btrim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
  v_business_name text := btrim(coalesce(new.raw_user_meta_data ->> 'business_name', ''));
  v_city text := coalesce(new.raw_user_meta_data ->> 'city_code', '');
  v_address text := btrim(coalesce(new.raw_user_meta_data ->> 'business_address', ''));
  v_business_id uuid;
begin
  if v_role not in ('buyer', 'supplier') then
    v_role := 'buyer';
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, v_phone);

  insert into public.businesses (owner_id, kind, name, city_code, address, phone, status)
  values (
    new.id,
    v_role,
    v_business_name,
    v_city,
    nullif(v_address, ''),
    v_phone,
    case when v_role = 'supplier' then 'pending' else 'approved' end
  )
  returning id into v_business_id;

  if v_role = 'supplier' then
    insert into public.supplier_coverage (business_id, city_code) values (v_business_id, v_city);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit logging for sensitive changes. Admin actions may set a note via
-- set_config('vendora.audit_note', ...) inside the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_note text := nullif(current_setting('vendora.audit_note', true), '');
begin
  insert into public.audit_logs (actor_id, actor_role, action, table_name, record_id, old_data, new_data, note)
  values (
    auth.uid(),
    public.app_role(),
    tg_op,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'code'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    v_note
  );
  return null;
end;
$$;

create trigger audit_profiles_role
  after update of role, is_active on public.profiles
  for each row when (old.role is distinct from new.role or old.is_active is distinct from new.is_active)
  execute function public.audit_row_change();

create trigger audit_businesses_status
  after update of status on public.businesses
  for each row when (old.status is distinct from new.status)
  execute function public.audit_row_change();

create trigger audit_categories
  after insert or update on public.categories
  for each row execute function public.audit_row_change();

create trigger audit_cities
  after insert or update on public.cities
  for each row execute function public.audit_row_change();

create trigger audit_commission_rules
  after insert on public.commission_rules
  for each row execute function public.audit_row_change();

create trigger audit_commissions
  after insert or update of status on public.commissions
  for each row execute function public.audit_row_change();

create trigger audit_disputes
  after insert or update of status on public.disputes
  for each row execute function public.audit_row_change();

-- Max 5 images per product.
create or replace function public.enforce_product_image_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id) >= 5 then
    raise exception 'ERR_IMAGE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger product_images_limit
  before insert on public.product_images
  for each row execute function public.enforce_product_image_limit();

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, per user and action). Runs in its own transaction
-- when called from the app, so counted attempts are not rolled back.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bucket text;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'ERR_UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_action !~ '^[a-z_]{3,40}$' or p_max < 1 or p_window_seconds < 1 then
    raise exception 'ERR_INVALID_INPUT';
  end if;

  v_bucket := v_uid::text || ':' || p_action;
  perform pg_advisory_xact_lock(hashtextextended(v_bucket, 0));

  select count(*) into v_count
  from public.rate_limit_hits h
  where h.bucket = v_bucket and h.hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket) values (v_bucket);
  delete from public.rate_limit_hits h
  where h.bucket = v_bucket and h.hit_at < now() - make_interval(secs => p_window_seconds);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: supplier approval, user roles, activation, commission rules.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_business_status(p_business_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'ERR_INVALID_STATUS';
  end if;

  perform set_config('vendora.audit_note', coalesce(p_note, ''), true);
  update public.businesses
  set status = p_status, reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_business_id and kind = 'supplier';
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_role text;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'ERR_SELF_CHANGE';
  end if;
  if p_role not in ('buyer', 'ops', 'admin') then
    raise exception 'ERR_INVALID_ROLE';
  end if;

  select role into v_old_role from public.profiles where id = p_user_id;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;
  -- Supplier accounts are tied to a business and approval record; changing them is a manual review.
  if v_old_role = 'supplier' then
    raise exception 'ERR_SUPPLIER_ROLE_LOCKED';
  end if;

  perform set_config('vendora.audit_note', coalesce(p_note, ''), true);
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'ERR_SELF_CHANGE';
  end if;

  perform set_config('vendora.audit_note', coalesce(p_note, ''), true);
  update public.profiles set is_active = p_active where id = p_user_id;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;
end;
$$;

-- Creates a commission rule. A rule is immutable; activating a new one deactivates the previous one.
create or replace function public.admin_create_commission_rule(
  p_name text,
  p_rate_bps integer,
  p_dispute_window_hours integer,
  p_delivery_fee_commissionable boolean,
  p_activate boolean,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'ERR_INVALID_INPUT';
  end if;

  perform set_config('vendora.audit_note', coalesce(p_note, ''), true);
  if p_activate then
    update public.commission_rules set is_active = false where is_active;
  end if;

  insert into public.commission_rules (name, rate_bps, dispute_window_hours, delivery_fee_commissionable, is_active, created_by)
  values (btrim(p_name), p_rate_bps, p_dispute_window_hours, p_delivery_fee_commissionable, p_activate, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- Manual reconciliation: marks payable commissions as paid after the admin transfers funds.
create or replace function public.admin_mark_commissions_paid(p_commission_ids uuid[], p_reference text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reference, ''))) < 3 then
    raise exception 'ERR_NOTE_REQUIRED';
  end if;

  update public.commissions c
  set status = 'paid', paid_at = now(), paid_reference = btrim(p_reference)
  where c.id = any (p_commission_ids)
    and c.status = 'pending'
    and c.payable_at <= now();
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- Commission report for manual reconciliation, grouped by supplier, for completion dates in [p_from, p_to).
create or replace function public.commission_summary(p_from timestamptz, p_to timestamptz)
returns table (
  supplier_business_id uuid,
  supplier_name text,
  orders_count bigint,
  eligible_subtotal_iqd bigint,
  awaiting_window_iqd bigint,
  payable_iqd bigint,
  on_hold_iqd bigint,
  paid_iqd bigint,
  voided_iqd bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    c.supplier_business_id,
    b.name,
    count(*) filter (where c.status <> 'voided'),
    coalesce(sum(c.eligible_subtotal_iqd) filter (where c.status <> 'voided'), 0)::bigint,
    coalesce(sum(c.commission_iqd) filter (where c.status = 'pending' and c.payable_at > now()), 0)::bigint,
    coalesce(sum(c.commission_iqd) filter (where c.status = 'pending' and c.payable_at <= now()), 0)::bigint,
    coalesce(sum(c.commission_iqd) filter (where c.status = 'on_hold'), 0)::bigint,
    coalesce(sum(c.commission_iqd) filter (where c.status = 'paid'), 0)::bigint,
    coalesce(sum(c.commission_iqd) filter (where c.status = 'voided'), 0)::bigint
  from public.commissions c
  join public.businesses b on b.id = c.supplier_business_id
  where c.completed_at >= p_from and c.completed_at < p_to
  group by c.supplier_business_id, b.name
  order by b.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Placing orders. Prices, names and availability are read from the database,
-- never from the browser. Idempotent per (buyer, idempotency key).
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_contact_phone text,
  p_buyer_notes text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer_business uuid;
  v_existing uuid;
  v_address public.addresses%rowtype;
  v_product public.products%rowtype;
  v_supplier uuid;
  v_subtotal bigint := 0;
  v_order_id uuid;
  v_line record;
begin
  if v_uid is null then
    raise exception 'ERR_UNAUTHENTICATED' using errcode = '28000';
  end if;
  if public.app_role() is distinct from 'buyer' then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'ERR_INVALID_INPUT';
  end if;
  if p_payment_method not in ('cash_on_delivery', 'bank_transfer', 'credit_agreement') then
    raise exception 'ERR_INVALID_PAYMENT_METHOD';
  end if;
  if coalesce(p_contact_phone, '') !~ '^\+?[0-9]{8,15}$' then
    raise exception 'ERR_INVALID_PHONE';
  end if;
  if char_length(coalesce(p_buyer_notes, '')) > 1000 then
    raise exception 'ERR_INVALID_INPUT';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'ERR_INVALID_ITEMS';
  end if;
  -- Every entry must be {product_id: uuid, quantity: 1..100000}.
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,6}$'
       or (case when coalesce(e ->> 'quantity', '') ~ '^[0-9]{1,6}$' then (e ->> 'quantity')::integer else 0 end)
          not between 1 and 100000
  ) then
    raise exception 'ERR_INVALID_ITEMS';
  end if;

  -- Serialise concurrent submissions of the same request.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_idempotency_key, 0));
  select o.id into v_existing from public.orders o
  where o.buyer_id = v_uid and o.idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select b.id into v_buyer_business from public.businesses b
  where b.owner_id = v_uid and b.kind = 'buyer' and b.status = 'approved';
  if v_buyer_business is null then
    raise exception 'ERR_BUSINESS_NOT_APPROVED';
  end if;

  select a.* into v_address from public.addresses a
  where a.id = p_address_id and a.owner_id = v_uid;
  if not found then
    raise exception 'ERR_ADDRESS_NOT_FOUND';
  end if;

  -- Validate every product (duplicates in the request are merged).
  for v_line in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_line.quantity > 100000 then
      raise exception 'ERR_INVALID_ITEMS';
    end if;

    select * into v_product from public.products p where p.id = v_line.product_id for share;
    if not found or not v_product.is_published then
      raise exception 'ERR_PRODUCT_UNAVAILABLE' using detail = v_line.product_id::text;
    end if;
    if not public.is_approved_supplier(v_product.business_id) then
      raise exception 'ERR_SUPPLIER_NOT_APPROVED' using detail = v_line.product_id::text;
    end if;
    if v_product.stock_status = 'out_of_stock' then
      raise exception 'ERR_OUT_OF_STOCK' using detail = v_line.product_id::text;
    end if;
    if v_line.quantity < v_product.min_quantity then
      raise exception 'ERR_MIN_QUANTITY' using detail = v_line.product_id::text;
    end if;
    if not exists (
      select 1 from public.supplier_coverage sc
      where sc.business_id = v_product.business_id and sc.city_code = v_address.city_code
    ) then
      raise exception 'ERR_NOT_COVERED' using detail = v_line.product_id::text;
    end if;
    if v_supplier is null then
      v_supplier := v_product.business_id;
    elsif v_supplier <> v_product.business_id then
      raise exception 'ERR_MULTIPLE_SUPPLIERS';
    end if;

    v_subtotal := v_subtotal + v_product.price_iqd::bigint * v_line.quantity;
  end loop;

  if v_supplier is null then
    raise exception 'ERR_INVALID_ITEMS';
  end if;

  insert into public.orders (
    order_number, buyer_id, buyer_business_id, supplier_business_id, status,
    subtotal_iqd, discount_iqd, delivery_fee_iqd, total_iqd,
    payment_method, delivery_city_code, delivery_address, contact_phone, buyer_notes, idempotency_key
  )
  values (
    'VDR-' || to_char(now() at time zone 'Asia/Baghdad', 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)),
    v_uid, v_buyer_business, v_supplier, 'submitted',
    v_subtotal, 0, 0, v_subtotal,
    p_payment_method, v_address.city_code,
    v_address.address_line || coalesce(' - ' || v_address.landmark, ''),
    p_contact_phone, nullif(btrim(coalesce(p_buyer_notes, '')), ''), p_idempotency_key
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, product_unit, unit_price_iqd, quantity, line_total_iqd)
  select v_order_id, p.id, p.name, p.unit, p.price_iqd, g.quantity, p.price_iqd::bigint * g.quantity
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) g
  join public.products p on p.id = g.product_id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role)
  values (v_order_id, null, 'submitted', v_uid, 'buyer');

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status transitions.
-- ---------------------------------------------------------------------------

-- Internal: applies a transition that has already been authorised by the caller.
-- Also keeps commissions in step with the order (see business rules in docs/PLAN.md).
create or replace function public._apply_order_transition(
  p_order_id uuid,
  p_from text,
  p_to text,
  p_actor uuid,
  p_role text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set status = p_to,
      completed_at = case when p_to = 'completed' then coalesce(completed_at, now()) else completed_at end,
      cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end
  where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order_id, p_from, p_to, p_actor, p_role, nullif(btrim(coalesce(p_note, '')), ''));

  if p_to = 'disputed' then
    update public.commissions set status = 'on_hold', updated_at = now()
    where order_id = p_order_id and status = 'pending';
  elsif p_to = 'completed' then
    perform public._create_commission(p_order_id);
    update public.commissions set status = 'pending', updated_at = now()
    where order_id = p_order_id and status = 'on_hold';
  elsif p_to = 'cancelled' then
    update public.commissions set status = 'voided', voided_reason = 'order_cancelled', updated_at = now()
    where order_id = p_order_id and status in ('pending', 'on_hold');
  end if;
end;
$$;

-- Creates the single commission record for an order using the active rule.
-- Idempotent: a second call for the same order does nothing.
create or replace function public._create_commission(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_rule public.commission_rules%rowtype;
  v_eligible bigint;
begin
  if exists (select 1 from public.commissions where order_id = p_order_id) then
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  select * into v_rule from public.commission_rules where is_active;
  if not found then
    raise exception 'ERR_NO_ACTIVE_COMMISSION_RULE';
  end if;

  -- Eligible = product subtotal after discounts. Delivery fee only if the rule says so.
  v_eligible := v_order.subtotal_iqd - v_order.discount_iqd
    + case when v_rule.delivery_fee_commissionable then v_order.delivery_fee_iqd else 0 end;

  insert into public.commissions (
    order_id, supplier_business_id, commission_rule_id, eligible_subtotal_iqd,
    rate_bps, commission_iqd, status, completed_at, payable_at
  )
  values (
    p_order_id, v_order.supplier_business_id, v_rule.id, v_eligible,
    v_rule.rate_bps, (v_eligible * v_rule.rate_bps + 5000) / 10000, 'pending',
    v_order.completed_at,
    v_order.completed_at + make_interval(hours => v_rule.dispute_window_hours)
  )
  on conflict (order_id) do nothing;
end;
$$;

-- Public: generic transition for supplier, buyer (cancel before acceptance), ops and admin.
-- Disputes use open_dispute()/resolve_dispute() instead.
create or replace function public.transition_order(p_order_id uuid, p_to_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.app_role();
  v_order public.orders%rowtype;
  v_allowed text[];
begin
  if v_uid is null or v_role is null then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_to_status = 'disputed' then
    raise exception 'ERR_USE_DISPUTE_FLOW';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;

  -- Hide orders the caller cannot see, rather than revealing that they exist.
  if (v_role = 'buyer' and v_order.buyer_id <> v_uid)
     or (v_role = 'supplier' and v_order.supplier_business_id <> public.my_business_id()) then
    raise exception 'ERR_NOT_FOUND';
  end if;
  if v_role = 'supplier' and not public.is_approved_supplier(v_order.supplier_business_id) then
    raise exception 'ERR_SUPPLIER_NOT_APPROVED';
  end if;

  select t.allowed_roles into v_allowed
  from public.order_transitions t
  where t.from_status = v_order.status and t.to_status = p_to_status;
  if v_allowed is null or not (v_role = any (v_allowed)) then
    raise exception 'ERR_INVALID_TRANSITION';
  end if;

  if p_to_status = 'cancelled' and v_role in ('ops', 'admin')
     and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'ERR_NOTE_REQUIRED';
  end if;

  perform public._apply_order_transition(v_order.id, v_order.status, p_to_status, v_uid, v_role, p_note);
end;
$$;

-- Buyer opens a dispute on a delivered order, or on a completed order while the dispute
-- window is still open (commission not yet payable). Ops/admin may open on behalf of a buyer.
create or replace function public.open_dispute(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.app_role();
  v_order public.orders%rowtype;
  v_commission public.commissions%rowtype;
  v_dispute_id uuid;
begin
  if v_uid is null or v_role not in ('buyer', 'ops', 'admin') then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'ERR_INVALID_INPUT';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or (v_role = 'buyer' and v_order.buyer_id <> v_uid) then
    raise exception 'ERR_NOT_FOUND';
  end if;

  if v_order.status = 'completed' then
    select * into v_commission from public.commissions where order_id = p_order_id;
    if not found or v_commission.status <> 'pending' or now() >= v_commission.payable_at then
      raise exception 'ERR_DISPUTE_WINDOW_CLOSED';
    end if;
  end if;

  if not exists (
    select 1 from public.order_transitions t
    where t.from_status = v_order.status and t.to_status = 'disputed' and v_role = any (t.allowed_roles)
  ) then
    raise exception 'ERR_INVALID_TRANSITION';
  end if;

  if exists (select 1 from public.disputes d where d.order_id = p_order_id and d.status = 'open') then
    raise exception 'ERR_DISPUTE_EXISTS';
  end if;

  insert into public.disputes (order_id, opened_by, reason)
  values (p_order_id, v_uid, btrim(p_reason))
  returning id into v_dispute_id;

  perform public._apply_order_transition(p_order_id, v_order.status, 'disputed', v_uid, v_role, p_reason);
  return v_dispute_id;
end;
$$;

-- Ops/admin resolve a dispute: 'completed' (order stands, commission payable after window)
-- or 'cancelled' (order cancelled, commission voided; any refund is handled manually).
create or replace function public.resolve_dispute(p_dispute_id uuid, p_outcome text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.app_role();
  v_dispute public.disputes%rowtype;
  v_order public.orders%rowtype;
begin
  if v_role not in ('ops', 'admin') then
    raise exception 'ERR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_outcome not in ('completed', 'cancelled') then
    raise exception 'ERR_INVALID_INPUT';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'ERR_NOTE_REQUIRED';
  end if;

  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'ERR_NOT_FOUND';
  end if;
  if v_dispute.status <> 'open' then
    raise exception 'ERR_DISPUTE_NOT_OPEN';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id for update;
  if not exists (
    select 1 from public.order_transitions t
    where t.from_status = 'disputed' and t.to_status = p_outcome and v_role = any (t.allowed_roles)
  ) then
    raise exception 'ERR_INVALID_TRANSITION';
  end if;

  update public.disputes
  set status = case when p_outcome = 'completed' then 'resolved_completed' else 'resolved_cancelled' end,
      resolution_note = btrim(p_note),
      resolved_by = v_uid,
      resolved_at = now()
  where id = p_dispute_id;

  perform public._apply_order_transition(v_order.id, 'disputed', p_outcome, v_uid, v_role, p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges for functions: nothing is callable by PUBLIC; only the intended roles.
-- Internal helpers are not callable by clients at all.
-- ---------------------------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.enforce_product_image_limit() from public, anon, authenticated;
revoke all on function public._apply_order_transition(uuid, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public._create_commission(uuid) from public, anon, authenticated;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
revoke all on function public.admin_set_business_status(uuid, text, text) from public, anon;
revoke all on function public.admin_set_user_role(uuid, text, text) from public, anon;
revoke all on function public.admin_set_user_active(uuid, boolean, text) from public, anon;
revoke all on function public.admin_create_commission_rule(text, integer, integer, boolean, boolean, text) from public, anon;
revoke all on function public.admin_mark_commissions_paid(uuid[], text) from public, anon;
revoke all on function public.commission_summary(timestamptz, timestamptz) from public, anon;
revoke all on function public.place_order(jsonb, uuid, text, text, text, text) from public, anon;
revoke all on function public.transition_order(uuid, text, text) from public, anon;
revoke all on function public.open_dispute(uuid, text) from public, anon;
revoke all on function public.resolve_dispute(uuid, text, text) from public, anon;

grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.admin_set_business_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_create_commission_rule(text, integer, integer, boolean, boolean, text) to authenticated;
grant execute on function public.admin_mark_commissions_paid(uuid[], text) to authenticated;
grant execute on function public.commission_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.place_order(jsonb, uuid, text, text, text, text) to authenticated;
grant execute on function public.transition_order(uuid, text, text) to authenticated;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.resolve_dispute(uuid, text, text) to authenticated;
