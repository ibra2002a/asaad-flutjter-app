import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  asAnon,
  asOperator,
  asUser,
  createTestDatabase,
  errorOf,
  one,
  rows,
} from './harness';

/**
 * End-to-end database behaviour: authentication, roles, supplier approval,
 * product visibility, ordering, transitions, commissions, disputes, isolation
 * and admin permissions. Runs against real PostgreSQL 17 with RLS enabled.
 * Scenarios depend on each other, so the tests run in declaration order.
 */

const ID = {
  buyerA: '00000000-0000-4000-8000-00000000000a',
  buyerB: '00000000-0000-4000-8000-00000000000b',
  supplier1: '00000000-0000-4000-8000-000000000001',
  supplier2: '00000000-0000-4000-8000-000000000002',
  supplierPending: '00000000-0000-4000-8000-000000000003',
  admin: '00000000-0000-4000-8000-0000000000ad',
};

const KEY = (n: string) => `checkout-key-${n}-0001`;

describe('VENDORA database: security and workflows', () => {
  let db: PGlite;
  const state: Record<string, string> = {};

  beforeAll(async () => {
    db = await createTestDatabase();
    await asOperator(db);

    const users: Array<[string, string, string, string]> = [
      [ID.buyerA, 'buyer', 'متجر النور', '07701111111'],
      [ID.buyerB, 'buyer', 'مخزن الأمل', '07702222222'],
      [ID.supplier1, 'supplier', 'مورد الرافدين', '07703333333'],
      [ID.supplier2, 'supplier', 'شركة دجلة', '07704444444'],
      [ID.supplierPending, 'supplier', 'مورد جديد', '07705555555'],
      [ID.admin, 'buyer', 'الإدارة', '07706666666'],
    ];
    for (const [id, role, legal, phone] of users) {
      await db.query(
        `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
        [
          id,
          `${id.slice(-4)}@example.test`,
          JSON.stringify({ role, full_name: 'مستخدم اختبار', legal_name: legal, city_code: 'baghdad', phone }),
        ],
      );
    }
    // Operator promotes the admin account. Clients can never do this.
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [ID.admin]);
  });

  // ------------------------------------------------------------------ auth --
  describe('authentication and role escalation', () => {
    it('creates a profile and business on sign-up: buyers approved, suppliers pending', async () => {
      const buyer = await one<{ role: string; status: string }>(
        db,
        `select p.role::text, b.verification_status::text as status
           from public.profiles p join public.businesses b on b.owner_id = p.id where p.id = $1`,
        [ID.buyerA],
      );
      const supplier = await one<{ role: string; status: string }>(
        db,
        `select p.role::text, b.verification_status::text as status
           from public.profiles p join public.businesses b on b.owner_id = p.id where p.id = $1`,
        [ID.supplier1],
      );
      expect(buyer).toEqual({ role: 'buyer', status: 'approved' });
      expect(supplier).toEqual({ role: 'supplier', status: 'pending' });
    });

    it('refuses self-registration as admin through sign-up metadata', async () => {
      const error = await errorOf(() =>
        db.query(
          `insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@x.test', $1::jsonb)`,
          [JSON.stringify({ role: 'admin', full_name: 'Hacker', legal_name: 'x y', phone: '07700000000' })],
        ),
      );
      expect(error).toMatch(/INVALID_ROLE/);
    });

    it('prevents a buyer from changing their own role to admin', async () => {
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query(`update public.profiles set role = 'admin' where id = $1`, [ID.buyerA]));
      expect(error).toMatch(/permission denied/);
      await asOperator(db);
      const role = await one<{ role: string }>(db, `select role::text from public.profiles where id = $1`, [ID.buyerA]);
      expect(role.role).toBe('buyer');
    });

    it('prevents a supplier from approving their own business', async () => {
      await asUser(db, ID.supplierPending);
      const error = await errorOf(() =>
        db.query(`update public.businesses set verification_status = 'approved' where owner_id = $1`, [ID.supplierPending]),
      );
      expect(error).toMatch(/permission denied/);
    });

    it('blocks non-admins from privileged RPCs', async () => {
      await asUser(db, ID.buyerA);
      const error = await errorOf(() =>
        db.query(`select public.admin_review_business(
          (select id from public.businesses where owner_id = $1), 'approved', null)`, [ID.supplier1]),
      );
      expect(error).toMatch(/FORBIDDEN_ROLE/);
    });

    it('only lets each user read their own profile', async () => {
      await asUser(db, ID.buyerA);
      const visible = await rows<{ id: string }>(db, 'select id from public.profiles');
      expect(visible.map((r) => r.id)).toEqual([ID.buyerA]);
    });

    it('denies anonymous visitors access to private tables', async () => {
      await asAnon(db);
      expect(await errorOf(() => db.query('select * from public.orders'))).toMatch(/permission denied/);
      expect(await errorOf(() => db.query('select * from public.profiles'))).toMatch(/permission denied/);
      expect(await errorOf(() => db.query('select * from public.addresses'))).toMatch(/permission denied/);
    });
  });

  // ---------------------------------------------------- supplier approval --
  describe('supplier approval', () => {
    it('lets an admin approve suppliers and records who did it', async () => {
      await asUser(db, ID.admin);
      await db.query(`select public.admin_review_business(
        (select id from public.businesses where owner_id = $1), 'approved', null)`, [ID.supplier1]);
      await db.query(`select public.admin_review_business(
        (select id from public.businesses where owner_id = $1), 'approved', null)`, [ID.supplier2]);
      const row = await one<{ status: string; reviewed_by: string }>(
        db,
        `select verification_status::text as status, reviewed_by::text from public.businesses where owner_id = $1`,
        [ID.supplier1],
      );
      expect(row.status).toBe('approved');
      expect(row.reviewed_by).toBe(ID.admin);
    });

    it('requires a note when rejecting a supplier', async () => {
      await asUser(db, ID.admin);
      const error = await errorOf(() => db.query(`select public.admin_review_business(
        (select id from public.businesses where owner_id = $1), 'rejected', '')`, [ID.supplierPending]));
      expect(error).toMatch(/REASON_REQUIRED/);
    });

    it('stops a pending supplier from creating products', async () => {
      await asUser(db, ID.supplierPending);
      const error = await errorOf(() => db.query(
        `insert into public.products (supplier_id, category_id, name_ar, unit, price_iqd, stock_qty)
         values (public.my_business_id(), (select id from public.categories limit 1), 'منتج', 'piece', 1000, 5)`,
      ));
      expect(error).toMatch(/row-level security/);
    });
  });

  // ------------------------------------------------ products & visibility --
  describe('product visibility and moderation', () => {
    it('creates products for approved suppliers in review, invisible to the public', async () => {
      await asUser(db, ID.supplier1);
      const [p1] = await rows<{ id: string }>(
        db,
        `insert into public.products (supplier_id, category_id, name_ar, unit, price_iqd, min_order_qty, stock_qty, status)
         values (public.my_business_id(), (select id from public.categories where slug = 'food-beverages'),
                 'زيت دوار الشمس', 'carton', 300000, 1, 10, 'pending_review')
         returning id`,
      );
      const [p2] = await rows<{ id: string }>(
        db,
        `insert into public.products (supplier_id, category_id, name_ar, unit, price_iqd, sale_price_iqd, min_order_qty, max_order_qty, stock_qty, status)
         values (public.my_business_id(), (select id from public.categories where slug = 'food-beverages'),
                 'رز بسمتي', 'kg', 100000, 90000, 2, 5, 20, 'pending_review')
         returning id`,
      );
      state.p1 = p1!.id;
      state.p2 = p2!.id;

      await asAnon(db);
      const publicRows = await rows(db, 'select id from public.products');
      expect(publicRows).toEqual([]);
    });

    it('stops suppliers from publishing their own product', async () => {
      await asUser(db, ID.supplier1);
      const error = await errorOf(() =>
        db.query(`update public.products set status = 'active' where id = $1`, [state.p1]),
      );
      expect(error).toMatch(/PRODUCT_STATUS_FORBIDDEN/);
    });

    it('stops suppliers from writing moderation notes', async () => {
      await asUser(db, ID.supplier1);
      const error = await errorOf(() =>
        db.query(`update public.products set moderation_note = 'approved by me' where id = $1`, [state.p1]),
      );
      expect(error).toMatch(/permission denied/);
    });

    it('stops one supplier from editing another supplier\'s product', async () => {
      await asUser(db, ID.supplier2);
      await db.query(`update public.products set stock_qty = 9999 where id = $1`, [state.p1]);
      await asOperator(db);
      const row = await one<{ stock_qty: number }>(db, 'select stock_qty from public.products where id = $1', [state.p1]);
      expect(row.stock_qty).toBe(10);
    });

    it('requires a reason to reject a product', async () => {
      await asUser(db, ID.admin);
      const error = await errorOf(() => db.query(`select public.admin_review_product($1, 'rejected', null)`, [state.p2]));
      expect(error).toMatch(/REASON_REQUIRED/);
    });

    it('lets an admin approve products, which then appear on the storefront', async () => {
      await asUser(db, ID.admin);
      await db.query(`select public.admin_review_product($1, 'active', null)`, [state.p1]);
      await db.query(`select public.admin_review_product($1, 'active', null)`, [state.p2]);

      await asAnon(db);
      const publicRows = await rows<{ id: string }>(db, 'select id from public.products order by name_ar');
      expect(publicRows.map((r) => r.id).sort()).toEqual([state.p1, state.p2].sort());
    });

    it('hides an approved product as soon as its supplier is suspended', async () => {
      await asUser(db, ID.admin);
      await db.query(`select public.admin_review_business(
        (select id from public.businesses where owner_id = $1), 'suspended', 'اختبار التعليق')`, [ID.supplier1]);
      await asAnon(db);
      expect(await rows(db, 'select id from public.products where id = $1', [state.p1])).toEqual([]);
      await asUser(db, ID.admin);
      await db.query(`select public.admin_review_business(
        (select id from public.businesses where owner_id = $1), 'approved', null)`, [ID.supplier1]);
      await asAnon(db);
      expect(await rows(db, 'select id from public.products where id = $1', [state.p1])).toHaveLength(1);
    });
  });

  // ------------------------------------------------------ addresses & cart --
  describe('addresses, cart validation and order creation', () => {
    it('stores delivery addresses that only their owner can read', async () => {
      await asUser(db, ID.buyerA);
      const [addr] = await rows<{ id: string }>(
        db,
        `insert into public.addresses (profile_id, label, city_code, district, address_line, phone)
         values ($1, 'المخزن', 'baghdad', 'الكرادة', 'شارع 62، بناية 4', '07701111111') returning id`,
        [ID.buyerA],
      );
      state.addrA = addr!.id;

      await asUser(db, ID.buyerB);
      const other = await rows(db, 'select id from public.addresses');
      expect(other).toEqual([]);
    });

    it('places an order and snapshots prices from the database, not the client', async () => {
      await asUser(db, ID.buyerA);
      // The client tries to send a price of 1 IQD. The server must ignore it.
      const items = [
        { product_id: state.p1, quantity: 1, unit_price_iqd: 1 },
        { product_id: state.p2, quantity: 3 },
      ];
      const [result] = await rows<{ place_order: Array<{ order_id: string; order_number: string; total_iqd: number; duplicate: boolean }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify(items), KEY('a')],
      );
      const orders = result!.place_order;
      expect(orders).toHaveLength(1);
      // 1 × 300,000 + 3 × 90,000 (sale price) = 570,000
      expect(orders[0]!.total_iqd).toBe(570_000);
      expect(orders[0]!.duplicate).toBe(false);
      expect(orders[0]!.order_number).toMatch(/^VND-\d{6}-[A-Z0-9]{5}$/);
      state.orderA = orders[0]!.order_id;

      const lines = await rows<{ unit_price_iqd: string; product_name_snapshot: string }>(
        db,
        'select unit_price_iqd::text, product_name_snapshot from public.order_items where order_id = $1 order by product_name_snapshot',
        [state.orderA],
      );
      expect(lines.map((l) => Number(l.unit_price_iqd)).sort((a, b) => a - b)).toEqual([90_000, 300_000]);
    });

    it('decrements stock when an order is placed', async () => {
      await asOperator(db);
      const p1 = await one<{ stock_qty: number }>(db, 'select stock_qty from public.products where id = $1', [state.p1]);
      const p2 = await one<{ stock_qty: number }>(db, 'select stock_qty from public.products where id = $1', [state.p2]);
      expect(p1.stock_qty).toBe(9);
      expect(p2.stock_qty).toBe(17);
    });

    it('returns the original orders on a duplicate submission (no double processing)', async () => {
      await asUser(db, ID.buyerA);
      const items = [{ product_id: state.p1, quantity: 1 }];
      const [again] = await rows<{ place_order: Array<{ order_id: string; order_number: string; duplicate: boolean; total_iqd: number }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify(items), KEY('a')],
      );
      expect(again!.place_order).toHaveLength(1);
      expect(again!.place_order[0]!.total_iqd).toBe(570_000);
      expect(again!.place_order[0]!.duplicate).toBe(true);

      await asOperator(db);
      const count = await one<{ n: number }>(db, 'select count(*)::int as n from public.orders where buyer_id = $1', [ID.buyerA]);
      expect(count.n).toBe(1);
      const p1 = await one<{ stock_qty: number }>(db, 'select stock_qty from public.products where id = $1', [state.p1]);
      expect(p1.stock_qty).toBe(9);
    });

    it('rejects quantities below the minimum', async () => {
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: state.p2, quantity: 1 }]), KEY('min')]));
      expect(error).toMatch(/QUANTITY_BELOW_MINIMUM/);
    });

    it('rejects quantities above the maximum', async () => {
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: state.p2, quantity: 6 }]), KEY('max')]));
      expect(error).toMatch(/QUANTITY_ABOVE_MAXIMUM/);
    });

    it('rejects quantities above available stock', async () => {
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 50 }]), KEY('stock')]));
      expect(error).toMatch(/INSUFFICIENT_STOCK/);
    });

    it('rejects fractional, negative and zero quantities', async () => {
      for (const quantity of ['2.5', '-1', '0']) {
        const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
          [state.addrA, JSON.stringify([{ product_id: state.p1, quantity }]), KEY(`bad${quantity}`)]));
        expect(error).toMatch(/INVALID_CART_LINE/);
      }
    });

    it('rejects a product listed twice in one cart', async () => {
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: state.p2, quantity: 2 }, { product_id: state.p2, quantity: 2 }]), KEY('dup')]));
      expect(error).toMatch(/DUPLICATE_PRODUCT_LINE/);
    });

    it('rejects products that are not active', async () => {
      await asUser(db, ID.supplier1);
      const [draft] = await rows<{ id: string }>(
        db,
        `insert into public.products (supplier_id, category_id, name_ar, unit, price_iqd, stock_qty, status)
         values (public.my_business_id(), (select id from public.categories limit 1), 'منتج مسودة', 'piece', 5000, 5, 'draft')
         returning id`,
      );
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: draft!.id, quantity: 1 }]), KEY('draft')]));
      expect(error).toMatch(/PRODUCT_UNAVAILABLE/);
    });

    it('refuses to ship to another buyer\'s address', async () => {
      await asUser(db, ID.buyerB);
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 1 }]), KEY('steal')]));
      expect(error).toMatch(/ADDRESS_NOT_FOUND/);
    });

    it('creates one order per supplier for a mixed cart', async () => {
      await asUser(db, ID.supplier2);
      const [p3] = await rows<{ id: string }>(
        db,
        `insert into public.products (supplier_id, category_id, name_ar, unit, price_iqd, stock_qty, status)
         values (public.my_business_id(), (select id from public.categories where slug = 'cleaning'), 'منظف أرضيات', 'liter', 50000, 100, 'draft')
         returning id`,
      );
      state.p3 = p3!.id;
      await asUser(db, ID.admin);
      await db.query(`select public.admin_review_product($1, 'active', null)`, [state.p3]);

      await asUser(db, ID.buyerA);
      const [result] = await rows<{ place_order: Array<{ total_iqd: number }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 1 }, { product_id: state.p3, quantity: 2 }]), KEY('mixed')],
      );
      expect(result!.place_order).toHaveLength(2);
    });

    it('blocks checkout for suspended buyers', async () => {
      await asUser(db, ID.admin);
      await db.query(`select public.admin_set_profile_active($1, false, 'اختبار التعليق')`, [ID.buyerB]);
      await asUser(db, ID.buyerB);
      const error = await errorOf(() => db.query('select public.place_order($1, $2::jsonb, $3)',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 1 }]), KEY('susp')]));
      expect(error).toMatch(/ACCOUNT_SUSPENDED|ADDRESS_NOT_FOUND/);
      await asUser(db, ID.admin);
      await db.query(`select public.admin_set_profile_active($1, true, 'إعادة التفعيل للاختبار')`, [ID.buyerB]);
    });
  });

  // -------------------------------------------- transitions & cancellation --
  describe('order status transitions and cancellation', () => {
    it('stops buyers from accepting their own order', async () => {
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query(`select public.transition_order($1, 'accepted', null)`, [state.orderA]));
      expect(error).toMatch(/INVALID_TRANSITION/);
    });

    it('stops a supplier who does not own the order from changing it', async () => {
      await asUser(db, ID.supplier2);
      const error = await errorOf(() => db.query(`select public.transition_order($1, 'accepted', null)`, [state.orderA]));
      expect(error).toMatch(/FORBIDDEN: not a party/);
    });

    it('lets the owning supplier accept, and records who changed it, when, and why', async () => {
      await asUser(db, ID.supplier1);
      await db.query(`select public.transition_order($1, 'accepted', null)`, [state.orderA]);
      await asOperator(db);
      const event = await one<{ actor_role: string; from_status: string; to_status: string; actor_id: string }>(
        db,
        `select actor_role::text, from_status::text, to_status::text, actor_id::text from public.order_events
          where order_id = $1 order by id desc limit 1`,
        [state.orderA],
      );
      expect(event).toMatchObject({ actor_role: 'supplier', from_status: 'submitted', to_status: 'accepted' });
      expect(event.actor_id).toBe(ID.supplier1);
    });

    it('rejects skipped steps', async () => {
      await asUser(db, ID.supplier1);
      const error = await errorOf(() => db.query(`select public.transition_order($1, 'delivered', null)`, [state.orderA]));
      expect(error).toMatch(/INVALID_TRANSITION/);
    });

    it('makes the order event log append-only', async () => {
      await asOperator(db);
      const error = await errorOf(() => db.query(`update public.order_events set reason = 'tampered'`));
      expect(error).toMatch(/APPEND_ONLY_TABLE/);
    });

    it('notifies the buyer when the supplier changes the status', async () => {
      await asUser(db, ID.buyerA);
      const [note] = await rows<{ title: string; link: string }>(
        db,
        'select title, link from public.notifications order by created_at desc limit 1',
      );
      expect(note!.title).toContain('تم قبول الطلب');
      expect(note!.link).toMatch(/^\/buyer\/orders\//);
    });

    it('restores stock when a buyer cancels an accepted order before preparation', async () => {
      // Buyer places a fresh order, which the supplier accepts, then the buyer cancels.
      await asOperator(db);
      const stockBefore = await one<{ stock_qty: number }>(db, 'select stock_qty from public.products where id = $1', [state.p1]);

      await asUser(db, ID.buyerA);
      const [res] = await rows<{ place_order: Array<{ order_id: string }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 2 }]), KEY('cancel-me')],
      );
      const orderId = res!.place_order[0]!.order_id;

      await asUser(db, ID.supplier1);
      await db.query(`select public.transition_order($1, 'accepted', null)`, [orderId]);
      await asUser(db, ID.buyerA);
      await db.query(`select public.transition_order($1, 'cancelled', null)`, [orderId]);

      await asOperator(db);
      const after = await one<{ stock_qty: number }>(db, 'select stock_qty from public.products where id = $1', [state.p1]);
      expect(after.stock_qty).toBe(stockBefore.stock_qty);
    });

    it('does not let a buyer cancel once preparation has started', async () => {
      await asUser(db, ID.supplier1);
      await db.query(`select public.transition_order($1, 'preparing', null)`, [state.orderA]);
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query(`select public.transition_order($1, 'cancelled', null)`, [state.orderA]));
      expect(error).toMatch(/INVALID_TRANSITION/);
    });

    it('requires a reason when a supplier rejects a new order', async () => {
      await asUser(db, ID.buyerA);
      const [res] = await rows<{ place_order: Array<{ order_id: string }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 1 }]), KEY('reject-me')],
      );
      state.orderReject = res!.place_order[0]!.order_id;
      await asUser(db, ID.supplier1);
      expect(await errorOf(() => db.query(`select public.transition_order($1, 'cancelled', '')`, [state.orderReject])))
        .toMatch(/REASON_REQUIRED/);
      await db.query(`select public.transition_order($1, 'cancelled', 'المنتج غير متوفر في المستودع')`, [state.orderReject]);
    });

    it('lets a supplier fulfil the order to delivery', async () => {
      await asUser(db, ID.supplier1);
      await db.query(`select public.transition_order($1, 'out_for_delivery', null)`, [state.orderA]);
      await db.query(`select public.transition_order($1, 'delivered', null)`, [state.orderA]);
      await asOperator(db);
      const row = await one<{ status: string }>(db, 'select status::text from public.orders where id = $1', [state.orderA]);
      expect(row.status).toBe('delivered');
    });
  });

  // ------------------------------------------------------------ commission --
  describe('commission', () => {
    it('creates exactly IQD 12,000 for an eligible IQD 300,000 order at 4% when completed', async () => {
      // Dedicated order: one unit of the IQD 300,000 product, at the global 4% default.
      await asUser(db, ID.buyerA);
      const [res] = await rows<{ place_order: Array<{ order_id: string }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 1 }]), KEY('commission-300k')],
      );
      state.orderCommission = res!.place_order[0]!.order_id;
      await asUser(db, ID.supplier1);
      await db.query(`select public.transition_order($1, 'accepted', null)`, [state.orderCommission]);
      await db.query(`select public.transition_order($1, 'preparing', null)`, [state.orderCommission]);
      await db.query(`select public.transition_order($1, 'out_for_delivery', null)`, [state.orderCommission]);
      await db.query(`select public.transition_order($1, 'delivered', null)`, [state.orderCommission]);
      await asUser(db, ID.buyerA);
      await db.query(`select public.transition_order($1, 'completed', null)`, [state.orderCommission]);

      await asOperator(db);
      const c = await one<{ eligible_base_iqd: string; commission_iqd: string; n: number }>(
        db,
        `select eligible_base_iqd::text, commission_iqd::text,
                (select count(*)::int from public.commissions where order_id = $1) as n
           from public.commissions where order_id = $1`,
        [state.orderCommission],
      );
      expect(Number(c.eligible_base_iqd)).toBe(300_000);
      expect(Number(c.commission_iqd)).toBe(12_000);
      expect(c.n).toBe(1);
    });

    it('never creates a second commission record for the same order', async () => {
      await asOperator(db);
      await db.query('select public.accrue_commission($1)', [state.orderCommission]);
      await db.query('select public.accrue_commission($1)', [state.orderCommission]);
      const count = await one<{ n: number }>(db, 'select count(*)::int as n from public.commissions where order_id = $1', [state.orderCommission]);
      expect(count.n).toBe(1);
    });

    it('freezes the agreed rate at checkout: later rule changes do not alter existing orders', async () => {
      await asUser(db, ID.admin);
      await db.query(
        `select public.admin_set_commission_rule('supplier', null, (select id from public.businesses where owner_id = $1), 1000, 'اتفاق تجاري مع المورد')`,
        [ID.supplier1],
      );
      await asOperator(db);
      const frozen = await one<{ commission_rate_bp: number }>(
        db,
        'select commission_rate_bp from public.order_items where order_id = $1',
        [state.orderCommission],
      );
      expect(frozen.commission_rate_bp).toBe(400);
    });

    it('applies a supplier-specific rate to orders placed after the rule', async () => {
      await asUser(db, ID.buyerA);
      const [res] = await rows<{ place_order: Array<{ order_id: string }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify([{ product_id: state.p1, quantity: 1 }]), KEY('override-rate')],
      );
      await asOperator(db);
      const rate = await one<{ commission_rate_bp: number }>(
        db,
        'select commission_rate_bp from public.order_items where order_id = $1',
        [res!.place_order[0]!.order_id],
      );
      expect(rate.commission_rate_bp).toBe(1000);
    });

    it('lets only admins change commission rules, and audits every change', async () => {
      await asUser(db, ID.supplier1);
      expect(await errorOf(() => db.query(`select public.admin_set_commission_rule('global', null, null, 500, 'محاولة')`)))
        .toMatch(/FORBIDDEN_ROLE/);
      await asUser(db, ID.admin);
      expect(await errorOf(() => db.query(`select public.admin_set_commission_rule('global', null, null, 3001, 'x')`)))
        .toMatch(/INVALID_RATE/);

      await asOperator(db);
      const audit = await one<{ n: number }>(
        db,
        `select count(*)::int as n from public.audit_logs where action = 'commission_rule.set' and actor_id = $1`,
        [ID.admin],
      );
      expect(audit.n).toBeGreaterThanOrEqual(1);
    });

    it('lets the supplier see its own commission and nobody else\'s', async () => {
      await asUser(db, ID.supplier1);
      const mine = await rows(db, 'select id from public.commissions');
      expect(mine.length).toBeGreaterThanOrEqual(1);
      await asUser(db, ID.supplier2);
      expect(await rows(db, 'select id from public.commissions')).toEqual([]);
      await asUser(db, ID.buyerA);
      expect(await rows(db, 'select id from public.commissions')).toEqual([]);
    });

    it('lets only admins mark commissions as settled', async () => {
      await asUser(db, ID.supplier1);
      const [c] = await rows<{ id: string }>(db, 'select id from public.commissions limit 1');
      expect(await errorOf(() => db.query('select public.admin_mark_commission_settled($1)', [c!.id])))
        .toMatch(/FORBIDDEN_ROLE/);
      await asUser(db, ID.admin);
      await db.query('select public.admin_mark_commission_settled($1)', [c!.id]);
      await asOperator(db);
      const row = await one<{ status: string }>(db, 'select status from public.commissions where id = $1', [c!.id]);
      expect(row.status).toBe('settled');
    });
  });

  // ---------------------------------------------- disputes, returns, adjust --
  describe('disputes, partial returns and commission adjustments', () => {
    it('blocks disputes before delivery', async () => {
      await asUser(db, ID.buyerA);
      const [res] = await rows<{ place_order: Array<{ order_id: string }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [state.addrA, JSON.stringify([{ product_id: state.p3, quantity: 4 }]), KEY('dispute-flow')],
      );
      state.orderDispute = res!.place_order[0]!.order_id;
      const [item] = await rows<{ id: string }>(db, 'select id from public.order_items where order_id = $1', [state.orderDispute]);
      state.itemDispute = item!.id;
      expect(await errorOf(() => db.query(
        `select public.open_dispute($1, 'return', $2, 1, 'بضاعة تالفة')`, [state.orderDispute, state.itemDispute])))
        .toMatch(/DISPUTE_NOT_ALLOWED/);
    });

    it('lets a buyer open a return dispute on a delivered order, which freezes it', async () => {
      await asUser(db, ID.supplier2);
      await db.query(`select public.transition_order($1, 'accepted', null)`, [state.orderDispute]);
      await db.query(`select public.transition_order($1, 'preparing', null)`, [state.orderDispute]);
      await db.query(`select public.transition_order($1, 'out_for_delivery', null)`, [state.orderDispute]);
      await db.query(`select public.transition_order($1, 'delivered', null)`, [state.orderDispute]);

      await asUser(db, ID.buyerA);
      const [d] = await rows<{ id: string }>(
        db,
        `select public.open_dispute($1, 'return', $2, 1, 'وصلت ٣ كراتين تالفة') as id`,
        [state.orderDispute, state.itemDispute],
      );
      state.dispute = (d as unknown as { id: string }).id;

      await asOperator(db);
      const status = await one<{ status: string }>(db, 'select status::text from public.orders where id = $1', [state.orderDispute]);
      expect(status.status).toBe('disputed');
    });

    it('allows only one open dispute per order', async () => {
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query(
        `select public.open_dispute($1, 'other', null, null, 'مشكلة أخرى مختلفة')`, [state.orderDispute]));
      expect(error).toMatch(/duplicate key|disputes_one_open_per_order|DISPUTE_NOT_ALLOWED/);
    });

    it('hides disputes from other buyers', async () => {
      await asUser(db, ID.buyerB);
      expect(await rows(db, 'select id from public.disputes')).toEqual([]);
    });

    it('lets the supplier see the dispute on its order', async () => {
      await asUser(db, ID.supplier2);
      const visible = await rows(db, 'select id from public.disputes where id = $1', [state.dispute]);
      expect(visible).toHaveLength(1);
    });

    it('resolves a partial return: restores quantity and returns the order to delivered', async () => {
      await asUser(db, ID.buyerB);
      expect(await errorOf(() => db.query(`select public.admin_resolve_dispute($1, 'no_action', 'x', null)`, [state.dispute])))
        .toMatch(/FORBIDDEN_ROLE/);

      await asUser(db, ID.admin);
      await db.query(
        `select public.admin_resolve_dispute($1, 'partial_return', 'تم قبول إرجاع كرتون واحد', null)`,
        [state.dispute],
      );
      await asOperator(db);
      const order = await one<{ status: string }>(db, 'select status::text from public.orders where id = $1', [state.orderDispute]);
      expect(order.status).toBe('delivered');
      const item = await one<{ returned_quantity: number }>(db, 'select returned_quantity from public.order_items where id = $1', [state.itemDispute]);
      expect(item.returned_quantity).toBe(1);
    });

    it('completes the order on the reduced base: commission reflects the 3 units kept', async () => {
      await asUser(db, ID.buyerA);
      await db.query(`select public.transition_order($1, 'completed', null)`, [state.orderDispute]);
      await asOperator(db);
      const c = await one<{ eligible_base_iqd: string; commission_iqd: string }>(
        db,
        'select eligible_base_iqd::text, commission_iqd::text from public.commissions where order_id = $1',
        [state.orderDispute],
      );
      // 3 units × 50,000 = 150,000 at 4% = 6,000
      expect(Number(c.eligible_base_iqd)).toBe(150_000);
      expect(Number(c.commission_iqd)).toBe(6_000);
    });

    it('reconciles a full refund on a completed order to zero net commission', async () => {
      await asUser(db, ID.buyerB);
      const [addr] = await rows<{ id: string }>(
        db,
        `insert into public.addresses (profile_id, label, city_code, district, address_line, phone)
         values ($1, 'مخزن الأمل', 'baghdad', 'المنصور', 'شارع الأميرات، محل ٧', '07702222222') returning id`,
        [ID.buyerB],
      );
      const [res] = await rows<{ place_order: Array<{ order_id: string }> }>(
        db,
        'select public.place_order($1, $2::jsonb, $3) as place_order',
        [addr!.id, JSON.stringify([{ product_id: state.p3, quantity: 2 }]), KEY('refund-flow')],
      );
      state.orderRefund = res!.place_order[0]!.order_id;
      const [item] = await rows<{ id: string }>(db, 'select id from public.order_items where order_id = $1', [state.orderRefund]);

      await asUser(db, ID.supplier2);
      await db.query(`select public.transition_order($1, 'accepted', null)`, [state.orderRefund]);
      await db.query(`select public.transition_order($1, 'preparing', null)`, [state.orderRefund]);
      await db.query(`select public.transition_order($1, 'out_for_delivery', null)`, [state.orderRefund]);
      await db.query(`select public.transition_order($1, 'delivered', null)`, [state.orderRefund]);
      await asUser(db, ID.buyerB);
      await db.query(`select public.transition_order($1, 'completed', null)`, [state.orderRefund]);

      // 2 × 50,000 = 100,000 eligible, 4% = 4,000 commission.
      await asOperator(db);
      const before = await one<{ net: string }>(
        db,
        `select (c.commission_iqd + coalesce((select sum(a.amount_iqd) from public.commission_adjustments a where a.commission_id = c.id), 0))::text as net
           from public.commissions c where c.order_id = $1`,
        [state.orderRefund],
      );
      expect(Number(before.net)).toBe(4_000);

      await asUser(db, ID.buyerB);
      const [d] = await rows<{ id: string }>(
        db,
        `select public.open_dispute($1, 'return', $2, 2, 'البضاعة لم تطابق الفاتورة') as id`,
        [state.orderRefund, item!.id],
      );
      await asUser(db, ID.admin);
      await db.query(`select public.admin_resolve_dispute($1, 'refund_full', 'استرداد كامل للمبلغ', null)`, [d!.id]);

      await asOperator(db);
      const order = await one<{ status: string }>(db, 'select status::text from public.orders where id = $1', [state.orderRefund]);
      expect(order.status).toBe('cancelled');
      const after = await one<{ net: string; adjustments: string }>(
        db,
        `select (c.commission_iqd + coalesce((select sum(a.amount_iqd) from public.commission_adjustments a where a.commission_id = c.id), 0))::text as net,
                coalesce((select sum(a.amount_iqd) from public.commission_adjustments a where a.commission_id = c.id), 0)::text as adjustments
           from public.commissions c where c.order_id = $1`,
        [state.orderRefund],
      );
      expect(Number(after.adjustments)).toBe(-4_000);
      expect(Number(after.net)).toBe(0);
    });

    it('rejects return quantities that exceed what remains on the line', async () => {
      await asUser(db, ID.buyerA);
      const error = await errorOf(() => db.query(
        `select public.open_dispute($1, 'return', $2, 99, 'كمية غير منطقية')`, [state.orderDispute, state.itemDispute]));
      expect(error).toMatch(/DISPUTE_NOT_ALLOWED|QUANTITY_INVALID/);
    });
  });

  // ----------------------------------------------------------- isolation --
  describe('data isolation between buyers, suppliers and the public', () => {
    it('stops buyers from reading each other\'s orders, items and events', async () => {
      await asUser(db, ID.buyerB);
      expect(await rows(db, 'select id from public.orders where id = $1', [state.orderA])).toEqual([]);
      expect(await rows(db, 'select id from public.order_items where order_id = $1', [state.orderA])).toEqual([]);
      expect(await rows(db, 'select id from public.order_events where order_id = $1', [state.orderA])).toEqual([]);
    });

    it('lets the buyer read their own order, items and event timeline', async () => {
      await asUser(db, ID.buyerA);
      expect(await rows(db, 'select id from public.orders where id = $1', [state.orderA])).toHaveLength(1);
      expect((await rows(db, 'select id from public.order_items where order_id = $1', [state.orderA])).length).toBeGreaterThan(0);
      expect((await rows(db, 'select id from public.order_events where order_id = $1', [state.orderA])).length).toBeGreaterThan(0);
    });

    it('stops one supplier from reading another supplier\'s orders', async () => {
      await asUser(db, ID.supplier2);
      expect(await rows(db, 'select id from public.orders where id = $1', [state.orderA])).toEqual([]);
      await asUser(db, ID.supplier1);
      expect(await rows(db, 'select id from public.orders where id = $1', [state.orderA])).toHaveLength(1);
    });

    it('keeps order data away from anonymous visitors', async () => {
      await asAnon(db);
      expect(await errorOf(() => db.query('select * from public.orders'))).toMatch(/permission denied/);
    });

    it('keeps the audit log admin-only', async () => {
      await asUser(db, ID.buyerA);
      expect(await rows(db, 'select id from public.audit_logs')).toEqual([]);
      await asUser(db, ID.admin);
      expect((await rows(db, 'select id from public.audit_logs')).length).toBeGreaterThan(0);
    });

    it('keeps notifications private to their recipient', async () => {
      await asUser(db, ID.buyerB);
      const visible = await rows<{ profile_id: string }>(db, 'select profile_id from public.notifications');
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.every((n) => n.profile_id === ID.buyerB)).toBe(true);
    });

    it('blocks anonymous callers from order RPCs entirely', async () => {
      await asAnon(db);
      expect(await errorOf(() => db.query('select public.place_order(null, $1::jsonb, $2)', ['[]', 'k'.repeat(10)])))
        .toMatch(/permission denied/);
    });
  });

  // -------------------------------------------------------- admin controls --
  describe('administrator controls', () => {
    it('requires a reason to suspend an account and forbids self-suspension', async () => {
      await asUser(db, ID.admin);
      expect(await errorOf(() => db.query(`select public.admin_set_profile_active($1, false, '')`, [ID.buyerB])))
        .toMatch(/REASON_REQUIRED/);
      expect(await errorOf(() => db.query(`select public.admin_set_profile_active($1, false, 'x')`, [ID.admin])))
        .toMatch(/SELF_MODIFICATION_FORBIDDEN/);
    });

    it('writes an audit entry for supplier approval and product moderation', async () => {
      await asOperator(db);
      const actions = await rows<{ action: string }>(
        db,
        'select distinct action from public.audit_logs where actor_id = $1',
        [ID.admin],
      );
      const names = actions.map((a) => a.action);
      expect(names).toEqual(expect.arrayContaining(['business.review', 'product.moderate', 'commission_rule.set', 'profile.suspend', 'dispute.resolve']));
    });

    it('notifies a supplier when a dispute is resolved', async () => {
      await asUser(db, ID.supplier2);
      const notes = await rows<{ title: string }>(db, 'select title from public.notifications');
      expect(notes.some((n) => n.title.includes('حل النزاع'))).toBe(true);
    });

    it('lets the admin add a category and records it in the audit log', async () => {
      await asUser(db, ID.admin);
      await db.query(
        `select public.admin_upsert_category(null, 'test-category', 'فئة اختبار', null, 999, true)`,
      );
      await asOperator(db);
      const row = await one<{ n: number }>(db, `select count(*)::int as n from public.audit_logs where action = 'category.upsert'`);
      expect(row.n).toBeGreaterThanOrEqual(1);
    });
  });
});
