-- =============================================================================
-- VENDORA · 0300 · Helper functions, triggers, notifications
-- =============================================================================

-- ------------------------------------------------------------ generic helpers --
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();
create trigger addresses_touch before update on public.addresses
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger commissions_touch before update on public.commissions
  for each row execute function public.touch_updated_at();
create trigger disputes_touch before update on public.disputes
  for each row execute function public.touch_updated_at();

create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'APPEND_ONLY_TABLE: % cannot be changed or deleted', tg_table_name
    using errcode = 'P0001';
end;
$$;

create trigger order_events_append_only before update or delete on public.order_events
  for each row execute function public.forbid_mutation();
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- ------------------------------------------------------------- authorization --
-- SECURITY DEFINER helpers avoid recursive RLS lookups on profiles/businesses.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.my_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id from public.businesses b where b.owner_id = auth.uid()
$$;

create or replace function public.is_approved_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.verification_status = 'approved'
  )
$$;

-- --------------------------------------------------------- onboarding trigger --
-- Creates a profile and a business for every new auth user. The role comes from
-- sign-up metadata but is restricted to buyer/supplier. Admin rights can never
-- be granted this way; they are assigned by an operator (see docs/OPERATIONS.md).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'buyer');
  v_full_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone text := btrim(coalesce(new.raw_user_meta_data ->> 'phone', ''));
  v_legal_name text := btrim(coalesce(new.raw_user_meta_data ->> 'legal_name', ''));
  v_city text := coalesce(new.raw_user_meta_data ->> 'city_code', 'baghdad');
begin
  if v_role not in ('buyer', 'supplier') then
    raise exception 'INVALID_ROLE: only buyer or supplier can self-register' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role::public.app_role, v_full_name, nullif(v_phone, ''));

  insert into public.businesses (owner_id, kind, legal_name, city_code, phone, verification_status)
  values (
    new.id,
    v_role::public.business_kind,
    v_legal_name,
    v_city,
    v_phone,
    -- Buyers are trusted for the pilot; suppliers must be approved by an admin.
    case when v_role = 'buyer' then 'approved'::public.verification_status
         else 'pending'::public.verification_status end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------- product write guard --
-- Suppliers may create and edit their own products, but only admins can set
-- active/rejected status, moderation notes, or move a product between suppliers.
create or replace function public.guard_product_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.status not in ('draft', 'pending_review', 'archived')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'PRODUCT_STATUS_FORBIDDEN: suppliers cannot set status %', new.status
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.supplier_id is distinct from old.supplier_id then
      raise exception 'PRODUCT_OWNER_IMMUTABLE' using errcode = '42501';
    end if;
    if new.moderation_note is distinct from old.moderation_note then
      raise exception 'MODERATION_NOTE_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger products_guard_write
  before insert or update on public.products
  for each row execute function public.guard_product_write();

create or replace function public.limit_product_images()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id) >= 8 then
    raise exception 'PRODUCT_IMAGE_LIMIT: at most 8 images per product' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger product_images_limit before insert on public.product_images
  for each row execute function public.limit_product_images();

-- ------------------------------------------------------------ address default --
create or replace function public.enforce_single_default_address()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where profile_id = new.profile_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default before insert or update on public.addresses
  for each row execute function public.enforce_single_default_address();

-- ------------------------------------------------------------ order helpers --
create or replace function public.commission_for_line(p_eligible_iqd bigint, p_rate_bp integer)
returns bigint
language sql
immutable
as $$
  -- Integer arithmetic, rounded half-up to the nearest IQD.
  select ((p_eligible_iqd * p_rate_bp + 5000) / 10000)::bigint
$$;

create or replace function public.resolve_commission_rate(p_supplier_id uuid, p_category_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r.rate_bp from public.commission_rules r
      where r.scope = 'supplier' and r.is_active and r.supplier_business_id = p_supplier_id),
    (select r.rate_bp from public.commission_rules r
      where r.scope = 'category' and r.is_active and r.category_id = p_category_id),
    (select r.rate_bp from public.commission_rules r
      where r.scope = 'global' and r.is_active)
  )
$$;

create or replace function public.generate_order_number()
returns text
language sql
volatile
as $$
  select 'VND-' || to_char(now() at time zone 'UTC', 'YYMMDD') || '-' ||
         upper(substr(md5(gen_random_uuid()::text), 1, 5))
$$;

create or replace function public.order_status_label_ar(p_status public.order_status)
returns text
language sql
immutable
as $$
  select case p_status
    when 'submitted' then 'تم استلام الطلب'
    when 'accepted' then 'تم قبول الطلب'
    when 'preparing' then 'جاري تجهيز الطلب'
    when 'out_for_delivery' then 'الطلب في الطريق'
    when 'delivered' then 'تم تسليم الطلب'
    when 'completed' then 'اكتمل الطلب'
    when 'cancelled' then 'تم إلغاء الطلب'
    when 'disputed' then 'نزاع مفتوح على الطلب'
  end
$$;

-- Allowed transitions, enforced on the server. Keep in sync with
-- src/lib/domain/order-status.ts (covered by unit tests).
create or replace function public.order_transition_allowed(
  p_from public.order_status,
  p_to public.order_status,
  p_actor public.actor_role
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = 'submitted' and p_to = 'accepted' then p_actor in ('supplier', 'admin')
    when p_from = 'submitted' and p_to = 'cancelled' then p_actor in ('buyer', 'supplier', 'admin')
    when p_from = 'accepted' and p_to = 'preparing' then p_actor in ('supplier', 'admin')
    when p_from = 'accepted' and p_to = 'cancelled' then p_actor in ('buyer', 'admin')
    when p_from = 'preparing' and p_to = 'out_for_delivery' then p_actor in ('supplier', 'admin')
    when p_from = 'preparing' and p_to = 'cancelled' then p_actor = 'admin'
    when p_from = 'out_for_delivery' and p_to = 'delivered' then p_actor in ('supplier', 'admin')
    when p_from = 'delivered' and p_to = 'completed' then p_actor in ('buyer', 'admin')
    else false
  end
$$;

-- ----------------------------------------------------------- order event feed --
-- Every status change writes an order_events row (see transition_order). This
-- trigger turns each event into an in-app notification for the other party.
create or replace function public.notify_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_number text;
  v_buyer_id uuid;
  v_supplier_owner uuid;
  v_recipient uuid;
  v_link text;
begin
  select o.order_number, o.buyer_id, b.owner_id
    into v_order_number, v_buyer_id, v_supplier_owner
  from public.orders o
  join public.businesses b on b.id = o.supplier_business_id
  where o.id = new.order_id;

  -- Buyer actions notify the supplier; everything else notifies the buyer.
  v_recipient := case when new.actor_role = 'buyer' then v_supplier_owner else v_buyer_id end;
  if v_recipient is null or v_recipient = new.actor_id then
    return new;
  end if;

  v_link := case when v_recipient = v_buyer_id
    then '/buyer/orders/' || new.order_id
    else '/supplier/orders/' || new.order_id end;

  insert into public.notifications (profile_id, title, body, link)
  values (
    v_recipient,
    'طلب ' || v_order_number || ': ' || public.order_status_label_ar(new.to_status),
    nullif(btrim(coalesce(new.reason, '')), ''),
    v_link
  );

  return new;
end;
$$;

create trigger order_events_notify after insert on public.order_events
  for each row execute function public.notify_order_event();
