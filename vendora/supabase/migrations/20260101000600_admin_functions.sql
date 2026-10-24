-- =============================================================================
-- VENDORA · 0600 · Administrator functions (every call is audited)
-- Each function checks public.is_admin() server-side. Clients cannot bypass it:
-- they have no direct write privileges on these tables.
-- =============================================================================

create or replace function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN_ROLE: administrator access required' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- ---------------------------------------------------------- business review --
create or replace function public.admin_review_business(
  p_business_id uuid,
  p_status public.verification_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_before public.businesses%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_before from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'BUSINESS_NOT_FOUND';
  end if;
  if p_status in ('rejected', 'suspended') and v_note is null then
    raise exception 'REASON_REQUIRED: a note is required when rejecting or suspending';
  end if;

  update public.businesses
     set verification_status = p_status,
         review_note = v_note,
         reviewed_by = v_admin,
         reviewed_at = now()
   where id = p_business_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_admin, 'business.review', 'business', p_business_id::text,
    jsonb_build_object('verification_status', v_before.verification_status),
    jsonb_build_object('verification_status', p_status),
    v_note
  );

  insert into public.notifications (profile_id, title, body, link)
  select b.owner_id,
         case p_status
           when 'approved' then 'تمت الموافقة على حسابك'
           when 'rejected' then 'لم تتم الموافقة على حسابك'
           when 'suspended' then 'تم تعليق حسابك التجاري'
           else 'تم تحديث حالة حسابك'
         end,
         v_note,
         case when b.kind = 'supplier' then '/supplier/onboarding' else '/buyer/profile' end
    from public.businesses b
   where b.id = p_business_id;
end;
$$;

-- --------------------------------------------------------- account suspension --
create or replace function public.admin_set_profile_active(
  p_profile_id uuid,
  p_active boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_was boolean;
begin
  if p_profile_id = v_admin then
    raise exception 'SELF_MODIFICATION_FORBIDDEN';
  end if;
  if v_reason is null then
    raise exception 'REASON_REQUIRED';
  end if;

  select is_active into v_was from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  update public.profiles set is_active = p_active where id = p_profile_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_admin, case when p_active then 'profile.reactivate' else 'profile.suspend' end,
    'profile', p_profile_id::text,
    jsonb_build_object('is_active', v_was),
    jsonb_build_object('is_active', p_active),
    v_reason
  );
end;
$$;

-- -------------------------------------------------------- product moderation --
create or replace function public.admin_review_product(
  p_product_id uuid,
  p_status public.product_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_before public.products%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_before from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if p_status = 'rejected' and v_note is null then
    raise exception 'REASON_REQUIRED: explain why the product was rejected';
  end if;

  update public.products
     set status = p_status,
         moderation_note = v_note
   where id = p_product_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_admin, 'product.moderate', 'product', p_product_id::text,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', p_status),
    v_note
  );

  insert into public.notifications (profile_id, title, body, link)
  select b.owner_id,
         case p_status
           when 'active' then 'تمت الموافقة على منتجك: ' || v_before.name_ar
           when 'rejected' then 'تم رفض المنتج: ' || v_before.name_ar
           else 'تم تحديث حالة المنتج: ' || v_before.name_ar
         end,
         v_note,
         '/supplier/products/' || p_product_id
    from public.businesses b
   where b.id = v_before.supplier_id;
end;
$$;

-- ------------------------------------------------------------- categories --
create or replace function public.admin_upsert_category(
  p_id uuid,
  p_slug text,
  p_name_ar text,
  p_description_ar text,
  p_sort_order integer,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id uuid;
  v_before jsonb;
begin
  if p_id is null then
    insert into public.categories (slug, name_ar, description_ar, sort_order, is_active)
    values (p_slug, p_name_ar, nullif(p_description_ar, ''), p_sort_order, p_is_active)
    returning id into v_id;
    v_before := null;
  else
    select to_jsonb(c) into v_before from public.categories c where c.id = p_id;
    if v_before is null then
      raise exception 'CATEGORY_NOT_FOUND';
    end if;
    update public.categories
       set slug = p_slug, name_ar = p_name_ar, description_ar = nullif(p_description_ar, ''),
           sort_order = p_sort_order, is_active = p_is_active
     where id = p_id
     returning id into v_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    v_admin, 'category.upsert', 'category', v_id::text, v_before,
    (select to_jsonb(c) from public.categories c where c.id = v_id)
  );

  return v_id;
end;
$$;

-- ------------------------------------------------------ commission rule rates --
-- Sets a new active rate for a scope target. The previous active rule for the
-- same target is retired (kept as history), so rate changes are traceable.
create or replace function public.admin_set_commission_rule(
  p_scope public.commission_scope,
  p_category_id uuid,
  p_supplier_business_id uuid,
  p_rate_bp integer,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_rate_bp is null or p_rate_bp < 0 or p_rate_bp > 3000 then
    raise exception 'INVALID_RATE: basis points must be between 0 and 3000 (30%%)';
  end if;
  if v_note is null then
    raise exception 'REASON_REQUIRED: explain the commission change';
  end if;
  if (p_scope = 'global' and (p_category_id is not null or p_supplier_business_id is not null))
     or (p_scope = 'category' and (p_category_id is null or p_supplier_business_id is not null))
     or (p_scope = 'supplier' and (p_supplier_business_id is null or p_category_id is not null)) then
    raise exception 'INVALID_RULE_TARGET';
  end if;

  update public.commission_rules
     set is_active = false
   where is_active
     and scope = p_scope
     and coalesce(category_id, '00000000-0000-0000-0000-000000000000') = coalesce(p_category_id, '00000000-0000-0000-0000-000000000000')
     and coalesce(supplier_business_id, '00000000-0000-0000-0000-000000000000') = coalesce(p_supplier_business_id, '00000000-0000-0000-0000-000000000000');

  insert into public.commission_rules (scope, category_id, supplier_business_id, rate_bp, note, created_by)
  values (p_scope, p_category_id, p_supplier_business_id, p_rate_bp, v_note, v_admin)
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data, reason)
  values (
    v_admin, 'commission_rule.set', 'commission_rule', v_id::text,
    jsonb_build_object('scope', p_scope, 'rate_bp', p_rate_bp,
                       'category_id', p_category_id, 'supplier_business_id', p_supplier_business_id),
    v_note
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------- reconciliation --
create or replace function public.admin_mark_commission_settled(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  update public.commissions
     set status = 'settled', settled_at = now(), settled_by = v_admin
   where id = p_commission_id and status = 'accrued';

  if not found then
    raise exception 'COMMISSION_NOT_SETTLEABLE';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data)
  values (v_admin, 'commission.settle', 'commission', p_commission_id::text,
          jsonb_build_object('status', 'settled'));
end;
$$;

-- ---------------------------------------------------------- dispute outcome --
-- partial_return: restores p_returned_quantity (defaults to the requested quantity).
-- refund_full:    all items are returned and the order is cancelled.
-- no_action:      the order returns to its previous status.
-- In every case the commission is reconciled against the remaining eligible base.
create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_resolution public.dispute_resolution,
  p_note text,
  p_returned_quantity integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_dispute public.disputes%rowtype;
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_qty integer;
  v_new_status public.order_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_supplier_owner uuid;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found or v_dispute.status <> 'open' then
    raise exception 'DISPUTE_NOT_OPEN';
  end if;
  if v_note is null then
    raise exception 'REASON_REQUIRED: a resolution note is required';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id for update;
  select owner_id into v_supplier_owner from public.businesses where id = v_order.supplier_business_id;

  if p_resolution = 'partial_return' then
    if v_dispute.kind <> 'return' or v_dispute.order_item_id is null then
      raise exception 'RESOLUTION_INVALID: partial returns need a return dispute with an item';
    end if;
    select * into v_item from public.order_items where id = v_dispute.order_item_id for update;
    v_qty := coalesce(p_returned_quantity, v_dispute.requested_quantity);
    if v_qty < 1 or v_qty > v_item.quantity - v_item.returned_quantity then
      raise exception 'QUANTITY_INVALID: returned quantity must be between 1 and %', v_item.quantity - v_item.returned_quantity;
    end if;
    update public.order_items set returned_quantity = returned_quantity + v_qty where id = v_item.id;
    v_new_status := v_dispute.previous_status;
  elsif p_resolution = 'refund_full' then
    update public.order_items set returned_quantity = quantity where order_id = v_order.id;
    v_new_status := 'cancelled';
  else
    v_new_status := v_dispute.previous_status;
  end if;

  update public.orders
     set status = v_new_status,
         cancellation_reason = case when v_new_status = 'cancelled' then 'استرداد كامل بعد نزاع' else cancellation_reason end
   where id = v_order.id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, reason)
  values (v_order.id, 'disputed', v_new_status, v_admin, 'admin', v_note);

  perform public.reconcile_commission(v_order.id, v_dispute.id, v_admin, 'تعديل بعد حل النزاع');

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         resolution_note = v_note,
         resolved_by = v_admin,
         resolved_at = now()
   where id = v_dispute.id;

  insert into public.notifications (profile_id, title, body, link)
  values
    (v_order.buyer_id, 'تم حل النزاع على الطلب ' || v_order.order_number, v_note, '/buyer/orders/' || v_order.id),
    (v_supplier_owner, 'تم حل النزاع على الطلب ' || v_order.order_number, v_note, '/supplier/orders/' || v_order.id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_admin, 'dispute.resolve', 'dispute', v_dispute.id::text,
    jsonb_build_object('status', 'open', 'order_status', 'disputed'),
    jsonb_build_object('status', 'resolved', 'resolution', p_resolution, 'order_status', v_new_status),
    v_note
  );
end;
$$;

-- Lock the admin RPCs down to signed-in users; the check above does the rest.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.place_order(uuid, jsonb, text) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text) to authenticated;
grant execute on function public.open_dispute(uuid, public.dispute_kind, uuid, integer, text) to authenticated;
grant execute on function public.admin_review_business(uuid, public.verification_status, text) to authenticated;
grant execute on function public.admin_set_profile_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_review_product(uuid, public.product_status, text) to authenticated;
grant execute on function public.admin_upsert_category(uuid, text, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_set_commission_rule(public.commission_scope, uuid, uuid, integer, text) to authenticated;
grant execute on function public.admin_mark_commission_settled(uuid) to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, public.dispute_resolution, text, integer) to authenticated;
-- Helpers referenced by RLS policies must be executable by every role that
-- evaluates those policies. They only ever return the caller's own information.
grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_business_id() to anon, authenticated;
grant execute on function public.is_approved_business(uuid) to anon, authenticated;
grant execute on function public.resolve_commission_rate(uuid, uuid) to authenticated;
