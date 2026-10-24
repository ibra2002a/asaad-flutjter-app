// Database security and business-rule tests for VENDORA.
//
// Runs the migrations against a DISPOSABLE local PostgreSQL database and then exercises
// RLS policies, grants and SECURITY DEFINER functions as different users (buyer, supplier,
// ops, admin, anonymous). It never runs against Supabase.
//
// Usage (local PostgreSQL only):
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/vendora_test \
//   VENDORA_DB_TEST_CONFIRM=yes npm run test:db

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error('TEST_DATABASE_URL is not set.');
  process.exit(1);
}
if (process.env.VENDORA_DB_TEST_CONFIRM !== 'yes') {
  console.error(
    'Refusing to run: this script drops and recreates the public, auth and storage schemas.\n' +
      'Point TEST_DATABASE_URL at a disposable LOCAL database and set VENDORA_DB_TEST_CONFIRM=yes.',
  );
  process.exit(1);
}

const db = new pg.Client({ connectionString: url });
await db.connect();

// ---------------------------------------------------------------------------
// Fresh schema + shim + migrations
// ---------------------------------------------------------------------------
await db.query(`
  drop schema if exists public cascade;
  drop schema if exists auth cascade;
  drop schema if exists storage cascade;
  create schema public;
  grant usage on schema public to public;
`);
await db.query(readFileSync(join(root, 'supabase/test/local-shim.sql'), 'utf8'));
const migrationsDir = join(root, 'supabase/migrations');
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.query(readFileSync(join(migrationsDir, file), 'utf8'));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Runs SQL as an authenticated user (ctx = { uid }), as anon (ctx = null) or as the DB owner (ctx = 'root'). */
async function run(ctx, sql, params = []) {
  await db.query('begin');
  try {
    if (ctx === 'root') {
      // Owner connection: no RLS, used only for fixtures and clock manipulation.
    } else if (ctx) {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ctx.uid, role: 'authenticated' })]);
      await db.query(`set local role authenticated`);
    } else {
      await db.query(`set local role anon`);
    }
    const result = await db.query(sql, params);
    await db.query('commit');
    return result;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

const root_ = 'root';
const as = (uid) => ({ uid });

async function expectFail(ctx, sql, params, pattern) {
  let message = null;
  try {
    await run(ctx, sql, params);
  } catch (error) {
    message = error.message;
  }
  assert.ok(message, `expected failure but statement succeeded: ${sql.slice(0, 90)}`);
  if (pattern) {
    assert.match(message, pattern);
  }
  return message;
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✘ ${name}\n      ${error.message.split('\n').join('\n      ')}`);
  }
}

async function createUser(id, meta) {
  await run(root_, `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${id}@test.vendora.local`,
    JSON.stringify(meta),
  ]);
}

const phone = (n) => `0770000${String(n).padStart(4, '0')}`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const U = {
  admin: '00000000-0000-4000-8000-000000000001',
  ops: '00000000-0000-4000-8000-000000000002',
  buyer1: '00000000-0000-4000-8000-000000000011',
  buyer2: '00000000-0000-4000-8000-000000000012',
  sup1: '00000000-0000-4000-8000-000000000021',
  sup2: '00000000-0000-4000-8000-000000000022',
  sup3: '00000000-0000-4000-8000-000000000023',
};

await createUser(U.admin, { role: 'buyer', full_name: 'Admin Test', phone: phone(1), business_name: 'Admin Co', city_code: 'baghdad' });
await createUser(U.ops, { role: 'buyer', full_name: 'Ops Test', phone: phone(2), business_name: 'Ops Co', city_code: 'baghdad' });
await run(root_, `update public.profiles set role = 'admin' where id = $1`, [U.admin]);
await run(root_, `update public.profiles set role = 'ops' where id = $1`, [U.ops]);

await createUser(U.buyer1, { role: 'buyer', full_name: 'Buyer One', phone: phone(11), business_name: 'Buyer One Shop', city_code: 'baghdad' });
await createUser(U.buyer2, { role: 'buyer', full_name: 'Buyer Two', phone: phone(12), business_name: 'Buyer Two Cafe', city_code: 'basra' });
await createUser(U.sup1, { role: 'supplier', full_name: 'Supplier One', phone: phone(21), business_name: 'Supplier One Trading', city_code: 'baghdad', business_address: 'Baghdad, Karrada' });
await createUser(U.sup2, { role: 'supplier', full_name: 'Supplier Two', phone: phone(22), business_name: 'Supplier Two Foods', city_code: 'baghdad' });
await createUser(U.sup3, { role: 'supplier', full_name: 'Supplier Three', phone: phone(23), business_name: 'Supplier Three Wholesale', city_code: 'baghdad' });

const bizOf = async (uid) => (await run(root_, `select id from public.businesses where owner_id = $1`, [uid])).rows[0].id;
const B = {};
for (const key of ['buyer1', 'buyer2', 'sup1', 'sup2', 'sup3']) B[key] = await bizOf(U[key]);

const groceriesId = (await run(root_, `select id from public.categories where slug = 'groceries'`)).rows[0].id;

// Approve only sup1 and sup3 (through the admin function). sup2 stays pending.
await run(as(U.admin), `select public.admin_set_business_status($1, 'approved', 'اختبار: اعتماد المورد')`, [B.sup1]);
await run(as(U.admin), `select public.admin_set_business_status($1, 'approved', 'اختبار: اعتماد المورد')`, [B.sup3]);

// Addresses (created by the buyers themselves).
const addr1 = (await run(as(U.buyer1), `insert into public.addresses (owner_id, label, city_code, address_line) values ($1, 'المكتب', 'baghdad', 'الكرادة، شارع 62') returning id`, [U.buyer1])).rows[0].id;
const addr2 = (await run(as(U.buyer2), `insert into public.addresses (owner_id, label, city_code, address_line) values ($1, 'المقهى', 'basra', 'البصرة، العشار') returning id`, [U.buyer2])).rows[0].id;

// Products. p1: normal, p2: high minimum, p3: out of stock, pDraft: unpublished.
async function insertProduct(ctx, businessId, fields) {
  const r = await run(ctx, `
    insert into public.products (business_id, category_id, name, unit, price_iqd, min_quantity, stock_status, is_published)
    values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [businessId, groceriesId, fields.name, fields.unit ?? 'كرتون', fields.price, fields.min ?? 1, fields.stock ?? 'in_stock', fields.published ?? true]);
  return r.rows[0].id;
}
const p1 = await insertProduct(as(U.sup1), B.sup1, { name: 'رز بسمتي 10 كغم', price: 45000, min: 2 });
const p2 = await insertProduct(as(U.sup1), B.sup1, { name: 'زيت دوار الشمس', price: 30000, min: 10 });
const p3 = await insertProduct(as(U.sup1), B.sup1, { name: 'سكر أبيض', price: 35000, stock: 'out_of_stock' });
const p4 = await insertProduct(as(U.sup3), B.sup3, { name: 'شاي أحمر', price: 12000, min: 1 });
const pDraft = await insertProduct(as(U.sup1), B.sup1, { name: 'منتج مسودة', price: 5000, published: false });

let orderA; // placed by buyer1 for sup1 (will be delivered & completed)
let orderB; // placed by buyer1 for sup1 (cancelled by buyer)
let orderC; // placed by buyer1 for sup1 (completed, disputed, dispute resolved to completed)
let orderD; // placed by buyer1 for sup1 (delivered, dispute resolved to cancelled)
let orderE; // placed by buyer1 for sup1 (completed, dispute resolved to cancelled -> commission voided)

const orderKey = (n) => `test-key-order-${n}`;
const items = (list) => JSON.stringify(list.map(([productId, quantity]) => ({ product_id: productId, quantity })));
const place = (ctx, list, addressId, key) =>
  run(ctx, `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, $4, $5) as id`, [
    items(list), addressId, phone(11), 'يرجى التوصيل صباحاً', key,
  ]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
console.log('\nVENDORA database tests\n');

await test('signup creates profile and business; spoofed admin role is downgraded', async () => {
  const spoof = '00000000-0000-4000-8000-0000000000ff';
  await createUser(spoof, { role: 'admin', full_name: 'Spoofer', phone: phone(99), business_name: 'Spoof Co', city_code: 'baghdad' });
  const p = await run(root_, `select role from public.profiles where id = $1`, [spoof]);
  assert.equal(p.rows[0].role, 'buyer');
  const sup = await run(root_, `select status from public.businesses where owner_id = $1`, [U.sup2]);
  assert.equal(sup.rows[0].status, 'pending', 'new suppliers start pending');
  const buyer = await run(root_, `select status from public.businesses where owner_id = $1`, [U.buyer1]);
  assert.equal(buyer.rows[0].status, 'approved', 'buyers are approved at signup');
});

await test('users cannot change their own role, status or business approval', async () => {
  await expectFail(as(U.buyer1), `update public.profiles set role = 'admin' where id = $1`, [U.buyer1], /permission denied/);
  await expectFail(as(U.buyer1), `update public.profiles set is_active = false where id = $1`, [U.buyer1], /permission denied/);
  await expectFail(as(U.sup2), `update public.businesses set status = 'approved' where owner_id = $1`, [U.sup2], /permission denied/);
});

await test('pending supplier cannot publish products, but can keep drafts', async () => {
  await expectFail(as(U.sup2), `
    insert into public.products (business_id, category_id, name, unit, price_iqd, is_published)
    values ($1, $2, 'منتج غير مسموح', 'كيس', 1000, true)`, [B.sup2, groceriesId], /row-level security/);
  const draft = await run(as(U.sup2), `
    insert into public.products (business_id, category_id, name, unit, price_iqd, is_published)
    values ($1, $2, 'مسودة مورد معلّق', 'كيس', 1000, false) returning id`, [B.sup2, groceriesId]);
  assert.equal(draft.rows.length, 1);
  const anonSees = await run(null, `select count(*)::int as n from public.products where id = $1`, [draft.rows[0].id]);
  assert.equal(anonSees.rows[0].n, 0, 'drafts are not public');
});

await test('pending supplier cannot publish via update either', async () => {
  const draftId = (await run(as(U.sup2), `select id from public.products where business_id = $1 limit 1`, [B.sup2])).rows[0].id;
  await expectFail(as(U.sup2), `update public.products set is_published = true where id = $1`, [draftId], /row-level security/);
});

await test('suppliers cannot modify or insert products of other suppliers', async () => {
  const upd = await run(as(U.sup2), `update public.products set price_iqd = 1 where id = $1 returning id`, [p1]);
  assert.equal(upd.rows.length, 0, 'update of another supplier product affects no rows');
  await expectFail(as(U.sup3), `
    insert into public.products (business_id, category_id, name, unit, price_iqd)
    values ($1, $2, 'تزوير', 'كيس', 1000)`, [B.sup1, groceriesId], /row-level security/);
  const price = await run(root_, `select price_iqd from public.products where id = $1`, [p1]);
  assert.equal(price.rows[0].price_iqd, 45000);
});

await test('only admins may approve suppliers; approval is audited with a note', async () => {
  await expectFail(as(U.sup1), `select public.admin_set_business_status($1, 'approved', null)`, [B.sup1], /ERR_FORBIDDEN/);
  await expectFail(as(U.buyer1), `select public.admin_set_business_status($1, 'approved', null)`, [B.sup2], /ERR_FORBIDDEN/);
  const log = await run(as(U.admin), `select note, action from public.audit_logs where table_name = 'businesses' and record_id = $1 order by id desc limit 1`, [B.sup1]);
  assert.equal(log.rows[0].note, 'اختبار: اعتماد المورد');
  assert.equal(log.rows[0].action, 'UPDATE');
  const denied = await run(as(U.buyer1), `select count(*)::int as n from public.audit_logs`);
  assert.equal(denied.rows[0].n, 0, 'non-admins cannot read audit logs');
});

await test('approved supplier can publish and anonymous users can see only published products', async () => {
  await run(as(U.sup1), `update public.products set is_published = true where id = $1`, [p1]);
  await run(as(U.sup1), `update public.products set is_published = true where id = $1`, [p2]);
  await run(as(U.sup1), `update public.products set is_published = true where id = $1`, [p3]);
  await run(as(U.sup3), `update public.products set is_published = true where id = $1`, [p4]);
  const anon = await run(null, `select id from public.products order by name`);
  const ids = anon.rows.map((r) => r.id);
  assert.ok(ids.includes(p1) && ids.includes(p4));
  assert.ok(!ids.includes(pDraft), 'draft hidden from anonymous');
  // Public directory must not leak supplier phone or street address.
  const dir = await run(null, `select * from public.supplier_directory where id = $1`, [B.sup1]);
  assert.equal(dir.rows.length, 1);
  assert.ok(!('phone' in dir.rows[0]) && !('address' in dir.rows[0]));
  await expectFail(null, `select count(*) from public.businesses`, [], /permission denied/);
});

await test('suspended supplier products disappear from the public catalogue', async () => {
  await run(as(U.admin), `select public.admin_set_business_status($1, 'suspended', 'اختبار: إيقاف')`, [B.sup3]);
  const visible = await run(null, `select count(*)::int as n from public.products where business_id = $1 and is_published`, [B.sup3]);
  assert.equal(visible.rows[0].n, 0);
  await run(as(U.admin), `select public.admin_set_business_status($1, 'approved', 'اختبار: إعادة تفعيل')`, [B.sup3]);
});

await test('buyers cannot read other buyers addresses; anonymous cannot read orders or commissions', async () => {
  const seen = await run(as(U.buyer2), `select count(*)::int as n from public.addresses where id = $1`, [addr1]);
  assert.equal(seen.rows[0].n, 0);
  await expectFail(null, `select * from public.orders`, [], /permission denied/);
  await expectFail(null, `select * from public.commissions`, [], /permission denied/);
});

await test('place_order: valid order uses database prices and creates immutable snapshots', async () => {
  const r = await place(as(U.buyer1), [[p1, 3]], addr1, orderKey('A'));
  orderA = r.rows[0].id;
  const o = await run(as(U.buyer1), `select status, subtotal_iqd, total_iqd, delivery_city_code from public.orders where id = $1`, [orderA]);
  assert.equal(o.rows[0].status, 'submitted');
  assert.equal(Number(o.rows[0].subtotal_iqd), 45000 * 3);
  assert.equal(Number(o.rows[0].total_iqd), 45000 * 3);
  assert.equal(o.rows[0].delivery_city_code, 'baghdad');
  const items_ = await run(as(U.buyer1), `select product_name, product_unit, unit_price_iqd, quantity, line_total_iqd from public.order_items where order_id = $1`, [orderA]);
  assert.equal(items_.rows[0].product_name, 'رز بسمتي 10 كغم');
  assert.equal(Number(items_.rows[0].line_total_iqd), 135000);
  const ev = await run(as(U.buyer1), `select to_status, actor_role from public.order_events where order_id = $1`, [orderA]);
  assert.deepEqual(ev.rows, [{ to_status: 'submitted', actor_role: 'buyer' }]);
});

await test('place_order is idempotent: repeated request returns the same order', async () => {
  const again = await place(as(U.buyer1), [[p1, 3]], addr1, orderKey('A'));
  assert.equal(again.rows[0].id, orderA);
  const count = await run(root_, `select count(*)::int as n from public.orders where idempotency_key = $1`, [orderKey('A')]);
  assert.equal(count.rows[0].n, 1);
});

await test('place_order rejects invalid business rules with stable error codes', async () => {
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-minqty-1')`,
    [items([[p2, 2]]), addr1, phone(11)], /ERR_MIN_QUANTITY/);
  await expectFail(as(U.buyer2), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-cover-1')`,
    [items([[p1, 2]]), addr2, phone(12)], /ERR_NOT_COVERED/);
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-mixed-1')`,
    [items([[p1, 2], [p4, 1]]), addr1, phone(11)], /ERR_MULTIPLE_SUPPLIERS/);
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-oos-001')`,
    [items([[p3, 2]]), addr1, phone(11)], /ERR_OUT_OF_STOCK/);
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-draft-1')`,
    [items([[pDraft, 1]]), addr1, phone(11)], /ERR_PRODUCT_UNAVAILABLE/);
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-addr-01')`,
    [items([[p1, 2]]), addr2, phone(11)], /ERR_ADDRESS_NOT_FOUND/);
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-badqty')`,
    [JSON.stringify([{ product_id: p1, quantity: 'abc' }]), addr1, phone(11)], /ERR_INVALID_ITEMS/);
  await expectFail(as(U.buyer1), `select public.place_order($1::jsonb, $2, 'bitcoin', $3, null, 'test-key-badpay')`,
    [items([[p1, 2]]), addr1, phone(11)], /ERR_INVALID_PAYMENT_METHOD/);
  await expectFail(as(U.sup1), `select public.place_order($1::jsonb, $2, 'cash_on_delivery', $3, null, 'test-key-sup-001')`,
    [items([[p1, 2]]), addr1, phone(11)], /ERR_FORBIDDEN/);
});

await test('buyers cannot write orders or order items directly', async () => {
  await expectFail(as(U.buyer1), `update public.orders set total_iqd = 1 where id = $1`, [orderA], /permission denied/);
  await expectFail(as(U.buyer1), `update public.order_items set unit_price_iqd = 1 where order_id = $1`, [orderA], /permission denied/);
  await expectFail(as(U.buyer1), `insert into public.commissions (order_id) values ($1)`, [orderA], /permission denied/);
});

await test('buyers see only their own orders; suppliers see only orders assigned to them', async () => {
  const b1 = await run(as(U.buyer1), `select count(*)::int as n from public.orders where id = $1`, [orderA]);
  assert.equal(b1.rows[0].n, 1);
  const b2 = await run(as(U.buyer2), `select count(*)::int as n from public.orders where id = $1`, [orderA]);
  assert.equal(b2.rows[0].n, 0);
  const s1 = await run(as(U.sup1), `select count(*)::int as n from public.orders where id = $1`, [orderA]);
  assert.equal(s1.rows[0].n, 1);
  const s3 = await run(as(U.sup3), `select count(*)::int as n from public.orders where id = $1`, [orderA]);
  assert.equal(s3.rows[0].n, 0, 'other supplier cannot see the order');
  const items_ = await run(as(U.buyer2), `select count(*)::int as n from public.order_items where order_id = $1`, [orderA]);
  assert.equal(items_.rows[0].n, 0);
  const events = await run(as(U.sup3), `select count(*)::int as n from public.order_events where order_id = $1`, [orderA]);
  assert.equal(events.rows[0].n, 0);
});

await test('transitions: buyers cannot accept; other suppliers cannot act; supplier steps are enforced', async () => {
  await expectFail(as(U.buyer1), `select public.transition_order($1, 'accepted', null)`, [orderA], /ERR_INVALID_TRANSITION/);
  await expectFail(as(U.sup3), `select public.transition_order($1, 'accepted', null)`, [orderA], /ERR_NOT_FOUND/);
  await run(as(U.sup1), `select public.transition_order($1, 'accepted', null)`, [orderA]);
  await expectFail(as(U.sup1), `select public.transition_order($1, 'delivered', null)`, [orderA], /ERR_INVALID_TRANSITION/, );
  await run(as(U.sup1), `select public.transition_order($1, 'preparing', null)`, [orderA]);
  await run(as(U.sup1), `select public.transition_order($1, 'out_for_delivery', null)`, [orderA]);
  await run(as(U.sup1), `select public.transition_order($1, 'delivered', 'تم التسليم للمشتري')`, [orderA]);
  // Suppliers can never mark an order completed.
  await expectFail(as(U.sup1), `select public.transition_order($1, 'completed', null)`, [orderA], /ERR_INVALID_TRANSITION/);
  await expectFail(as(U.buyer1), `select public.transition_order($1, 'completed', null)`, [orderA], /ERR_INVALID_TRANSITION/);
  await expectFail(as(U.buyer1), `select public.transition_order($1, 'disputed', null)`, [orderA], /ERR_USE_DISPUTE_FLOW/);
  const ev = await run(as(U.buyer1), `select count(*)::int as n from public.order_events where order_id = $1`, [orderA]);
  assert.equal(ev.rows[0].n, 5, 'every transition is recorded');
});

await test('a suspended supplier cannot process orders', async () => {
  const oSusp = await place(as(U.buyer1), [[p4, 1]], addr1, orderKey('SUSP'));
  await run(as(U.admin), `select public.admin_set_business_status($1, 'suspended', 'اختبار')`, [B.sup3]);
  await expectFail(as(U.sup3), `select public.transition_order($1, 'accepted', null)`, [oSusp.rows[0].id], /ERR_SUPPLIER_NOT_APPROVED/);
  await run(as(U.admin), `select public.admin_set_business_status($1, 'approved', 'اختبار')`, [B.sup3]);
});

await test('commission: completing an order creates exactly one correct, repeat-safe record', async () => {
  await run(as(U.ops), `select public.transition_order($1, 'completed', null)`, [orderA]);
  const c = await run(root_, `select count(*)::int as n from public.commissions where order_id = $1`, [orderA]);
  assert.equal(c.rows[0].n, 1);
  const row = await run(root_, `select eligible_subtotal_iqd, rate_bps, commission_iqd, status, extract(epoch from (payable_at - completed_at))::int as window_seconds from public.commissions where order_id = $1`, [orderA]);
  assert.equal(Number(row.rows[0].eligible_subtotal_iqd), 135000);
  assert.equal(row.rows[0].rate_bps, 400);
  assert.equal(Number(row.rows[0].commission_iqd), 5400); // 135000 * 4%
  assert.equal(row.rows[0].status, 'pending');
  assert.equal(row.rows[0].window_seconds, 48 * 3600);
  await expectFail(as(U.ops), `select public.transition_order($1, 'completed', null)`, [orderA], /ERR_INVALID_TRANSITION/);
  await run(root_, `select public._create_commission($1)`, [orderA]);
  const again = await run(root_, `select count(*)::int as n from public.commissions where order_id = $1`, [orderA]);
  assert.equal(again.rows[0].n, 1, 'repeated completion does not duplicate commissions');
});

await test('commissions table rejects inconsistent amounts (formula enforced in the database)', async () => {
  await expectFail('root', `
    insert into public.commissions (order_id, supplier_business_id, eligible_subtotal_iqd, rate_bps, commission_iqd, completed_at, payable_at)
    select id, supplier_business_id, 1000, 400, 999, now(), now() from public.orders where id = $1`, [orderA], /commissions_formula_check/);
});

await test('buyers and suppliers cannot read commissions; admins can', async () => {
  const b = await run(as(U.buyer1), `select count(*)::int as n from public.commissions`);
  assert.equal(b.rows[0].n, 0);
  const s = await run(as(U.sup1), `select count(*)::int as n from public.commissions`);
  assert.equal(s.rows[0].n, 0);
  const a = await run(as(U.admin), `select count(*)::int as n from public.commissions`);
  assert.equal(a.rows[0].n, 1);
});

await test('cancellation before acceptance voids nothing and creates no commission', async () => {
  const r = await place(as(U.buyer1), [[p1, 4]], addr1, orderKey('B'));
  orderB = r.rows[0].id;
  await run(as(U.buyer1), `select public.transition_order($1, 'cancelled', 'غيرت رأيي')`, [orderB]);
  const o = await run(root_, `select status, cancelled_at is not null as has_ts from public.orders where id = $1`, [orderB]);
  assert.deepEqual(o.rows[0], { status: 'cancelled', has_ts: true });
  const c = await run(root_, `select count(*)::int as n from public.commissions where order_id = $1`, [orderB]);
  assert.equal(c.rows[0].n, 0);
  await expectFail(as(U.buyer1), `select public.transition_order($1, 'cancelled', null)`, [orderB], /ERR_INVALID_TRANSITION/);
});

await test('buyers cannot cancel after the supplier accepted', async () => {
  const r = await place(as(U.buyer1), [[p1, 2]], addr1, orderKey('C'));
  orderC = r.rows[0].id;
  await run(as(U.sup1), `select public.transition_order($1, 'accepted', null)`, [orderC]);
  await expectFail(as(U.buyer1), `select public.transition_order($1, 'cancelled', null)`, [orderC], /ERR_INVALID_TRANSITION/);
});

await test('dispute on a completed order inside the window puts the commission on hold, then resolves to completed', async () => {
  // Drive orderC through to completion.
  await run(as(U.sup1), `select public.transition_order($1, 'preparing', null)`, [orderC]);
  await run(as(U.sup1), `select public.transition_order($1, 'out_for_delivery', null)`, [orderC]);
  await run(as(U.sup1), `select public.transition_order($1, 'delivered', null)`, [orderC]);
  await run(as(U.ops), `select public.transition_order($1, 'completed', null)`, [orderC]);

  await expectFail(as(U.sup1), `select public.open_dispute($1, 'مشكلة في الجودة للبضاعة')`, [orderC], /ERR_FORBIDDEN/);
  const disputeId = (await run(as(U.buyer1), `select public.open_dispute($1, 'الرز يحتوي على حبوب مكسورة') as id`, [orderC])).rows[0].id;

  const st = await run(root_, `select o.status, c.status as commission_status from public.orders o join public.commissions c on c.order_id = o.id where o.id = $1`, [orderC]);
  assert.deepEqual(st.rows[0], { status: 'disputed', commission_status: 'on_hold' });

  await expectFail(as(U.buyer1), `select public.open_dispute($1, 'نزاع ثانٍ على نفس الطلب')`, [orderC], /ERR_INVALID_TRANSITION/);
  await expectFail(as(U.buyer1), `select public.resolve_dispute($1, 'completed', 'محاولة من المشتري')`, [disputeId], /ERR_FORBIDDEN/);

  await run(as(U.ops), `select public.resolve_dispute($1, 'completed', 'تمت مراجعة الصور، الطلب مطابق')`, [disputeId]);
  const after = await run(root_, `select o.status, c.status as commission_status from public.orders o join public.commissions c on c.order_id = o.id where o.id = $1`, [orderC]);
  assert.deepEqual(after.rows[0], { status: 'completed', commission_status: 'pending' });
  const d = await run(root_, `select status from public.disputes where id = $1`, [disputeId]);
  assert.equal(d.rows[0].status, 'resolved_completed');
});

await test('dispute resolved as cancelled voids the commission and cancels the order', async () => {
  const r = await place(as(U.buyer1), [[p1, 2]], addr1, orderKey('E'));
  orderE = r.rows[0].id;
  await run(as(U.sup1), `select public.transition_order($1, 'accepted', null)`, [orderE]);
  await run(as(U.sup1), `select public.transition_order($1, 'preparing', null)`, [orderE]);
  await run(as(U.sup1), `select public.transition_order($1, 'out_for_delivery', null)`, [orderE]);
  await run(as(U.sup1), `select public.transition_order($1, 'delivered', null)`, [orderE]);
  const disputeId = (await run(as(U.buyer1), `select public.open_dispute($1, 'لم يصل الطلب كاملاً للمكان') as id`, [orderE])).rows[0].id;
  await expectFail(as(U.ops), `select public.resolve_dispute($1, 'completed', 'ok')`, [disputeId], /ERR_NOTE_REQUIRED/);
  await run(as(U.ops), `select public.resolve_dispute($1, 'cancelled', 'اتفاق الطرفين على الإلغاء، الاسترداد خارج المنصة')`, [disputeId]);
  const o = await run(root_, `select status from public.orders where id = $1`, [orderE]);
  assert.equal(o.rows[0].status, 'cancelled');
  const c = await run(root_, `select count(*)::int as n from public.commissions where order_id = $1`, [orderE]);
  assert.equal(c.rows[0].n, 0, 'no commission exists for a cancelled order');
});

await test('dispute window closes: disputes are rejected once the commission is payable', async () => {
  const r = await place(as(U.buyer1), [[p1, 2]], addr1, orderKey('D'));
  orderD = r.rows[0].id;
  for (const step of ['accepted', 'preparing', 'out_for_delivery', 'delivered']) {
    await run(as(U.sup1), `select public.transition_order($1, $2, null)`, [orderD, step]);
  }
  await run(as(U.ops), `select public.transition_order($1, 'completed', null)`, [orderD]);
  // Simulate the dispute window having passed.
  await run(root_, `update public.commissions set payable_at = now() - interval '1 minute' where order_id = $1`, [orderD]);
  await expectFail(as(U.buyer1), `select public.open_dispute($1, 'بعد انتهاء المدة المسموحة')`, [orderD], /ERR_DISPUTE_WINDOW_CLOSED/);
});

await test('commission payout is manual reconciliation: only payable commissions can be marked paid', async () => {
  const ids = (await run(root_, `select array_agg(id) as ids from public.commissions where order_id in ($1, $2)`, [orderD, orderA])).rows[0].ids;
  const updated = await run(as(U.admin), `select public.admin_mark_commissions_paid($1::uuid[], 'تحويل بنكي 2026-10-24') as n`, [ids]);
  // orderA's window is still open (48h), so only orderD is payable.
  assert.equal(updated.rows[0].n, 1);
  await expectFail(as(U.admin), `select public.admin_mark_commissions_paid($1::uuid[], 'x')`, [ids], /ERR_NOTE_REQUIRED/);
  const paid = await run(root_, `select status from public.commissions where order_id = $1`, [orderD]);
  assert.equal(paid.rows[0].status, 'paid');
});

await test('admin commission rule change is versioned: new orders use the new rate, old commissions keep theirs', async () => {
  await expectFail(as(U.ops), `select public.admin_create_commission_rule('خطة جديدة', 500, 24, false, true, 'x')`, [], /ERR_FORBIDDEN/);
  await run(as(U.admin), `select public.admin_create_commission_rule('خطة 5%', 500, 24, false, true, 'اختبار تغيير النسبة')`);
  const active = await run(root_, `select count(*)::int as n from public.commission_rules where is_active`);
  assert.equal(active.rows[0].n, 1, 'only one rule is active');
  await expectFail(root_, `insert into public.commission_rules (name, rate_bps, is_active) values ('مكرر', 100, true)`, [], /commission_rules_single_active/);

  const r = await place(as(U.buyer1), [[p4, 3]], addr1, orderKey('F'));
  const orderF = r.rows[0].id;
  // orderF is supplied by sup3 -> must be approved; sup3 is approved. Move it through.
  await run(as(U.sup3), `select public.transition_order($1, 'accepted', null)`, [orderF]);
  await run(as(U.sup3), `select public.transition_order($1, 'preparing', null)`, [orderF]);
  await run(as(U.sup3), `select public.transition_order($1, 'out_for_delivery', null)`, [orderF]);
  await run(as(U.sup3), `select public.transition_order($1, 'delivered', null)`, [orderF]);
  await run(as(U.ops), `select public.transition_order($1, 'completed', null)`, [orderF]);
  const newC = await run(root_, `select rate_bps, commission_iqd, eligible_subtotal_iqd from public.commissions where order_id = $1`, [orderF]);
  assert.equal(newC.rows[0].rate_bps, 500);
  assert.equal(Number(newC.rows[0].commission_iqd), 1800); // 3 * 12000 = 36000 * 5%
  const oldC = await run(root_, `select rate_bps from public.commissions where order_id = $1`, [orderA]);
  assert.equal(oldC.rows[0].rate_bps, 400, 'historic commission keeps its snapshot rate');
});

await test('commission summary is admin-only and aggregates by supplier', async () => {
  await expectFail(as(U.buyer1), `select * from public.commission_summary(now() - interval '1 day', now() + interval '1 day')`, [], /ERR_FORBIDDEN/);
  const rows = (await run(as(U.admin), `select * from public.commission_summary(now() - interval '1 day', now() + interval '1 day')`)).rows;
  const sup1 = rows.find((r) => r.supplier_name === 'Supplier One Trading' || r.supplier_business_id === B.sup1);
  assert.ok(sup1, 'supplier 1 present');
  // Only orderD (90,000 IQD x 4% = 3,600) was payable and paid; orderA is still inside its window.
  assert.equal(Number(sup1.paid_iqd), 3600);
});

await test('audit log records admin commission rule creation with the note', async () => {
  const log = await run(as(U.admin), `select note from public.audit_logs where table_name = 'commission_rules' order by id desc limit 1`);
  assert.equal(log.rows[0].note, 'اختبار تغيير النسبة');
});

await test('admins manage roles safely: no self-change, suppliers locked, ops role can be granted', async () => {
  await expectFail(as(U.admin), `select public.admin_set_user_role($1, 'buyer', null)`, [U.admin], /ERR_SELF_CHANGE/);
  await expectFail(as(U.admin), `select public.admin_set_user_role($1, 'ops', null)`, [U.sup1], /ERR_SUPPLIER_ROLE_LOCKED/);
  await expectFail(as(U.admin), `select public.admin_set_user_role($1, 'supplier', null)`, [U.buyer2], /ERR_INVALID_ROLE/);
  await run(as(U.admin), `select public.admin_set_user_role($1, 'ops', 'اختبار ترقية')`, [U.buyer2]);
  const r = await run(root_, `select role from public.profiles where id = $1`, [U.buyer2]);
  assert.equal(r.rows[0].role, 'ops');
  await run(as(U.admin), `select public.admin_set_user_role($1, 'buyer', 'اختبار رجوع')`, [U.buyer2]);
});

await test('deactivated users lose access to all data', async () => {
  await run(as(U.admin), `select public.admin_set_user_active($1, false, 'اختبار تعطيل')`, [U.buyer2]);
  const r = await run(as(U.buyer2), `select count(*)::int as n from public.addresses`);
  assert.equal(r.rows[0].n, 0);
  await run(as(U.admin), `select public.admin_set_user_active($1, true, 'اختبار إعادة التفعيل')`, [U.buyer2]);
});

await test('ops can see all orders but cannot approve suppliers or manage commission rules', async () => {
  const o = await run(as(U.ops), `select count(*)::int as n from public.orders`);
  assert.ok(o.rows[0].n >= 3);
  await expectFail(as(U.ops), `select public.admin_set_business_status($1, 'approved', null)`, [B.sup2], /ERR_FORBIDDEN/);
});

await test('rate limiting: fixed window per user and action', async () => {
  const a = await run(as(U.buyer1), `select public.consume_rate_limit('test_action', 2, 60) as ok`);
  const b = await run(as(U.buyer1), `select public.consume_rate_limit('test_action', 2, 60) as ok`);
  const c = await run(as(U.buyer1), `select public.consume_rate_limit('test_action', 2, 60) as ok`);
  assert.deepEqual([a.rows[0].ok, b.rows[0].ok, c.rows[0].ok], [true, true, false]);
  const other = await run(as(U.buyer2), `select public.consume_rate_limit('test_action', 2, 60) as ok`);
  assert.equal(other.rows[0].ok, true, 'limits are per user');
});

await test('product images: at most five per product and only by the owning supplier', async () => {
  const paths = [1, 2, 3, 4, 5].map((n) => `${U.sup1}/${n}.webp`);
  for (const path of paths) {
    await run(as(U.sup1), `insert into public.product_images (product_id, storage_path) values ($1, $2)`, [p1, path]);
  }
  await expectFail(as(U.sup1), `insert into public.product_images (product_id, storage_path) values ($1, $2)`, [p1, `${U.sup1}/6.webp`], /ERR_IMAGE_LIMIT/);
  await expectFail(as(U.sup3), `insert into public.product_images (product_id, storage_path) values ($1, $2)`, [p2, `${U.sup3}/x.webp`], /row-level security/);
});

await test('storage: suppliers may upload only into their own folder; pending suppliers cannot upload', async () => {
  await run(root_, `insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict do nothing`);
  await run(as(U.sup1), `insert into storage.objects (bucket_id, name, owner) values ('product-images', $1, $2)`, [`${U.sup1}/ok.webp`, U.sup1]);
  await expectFail(as(U.sup1), `insert into storage.objects (bucket_id, name, owner) values ('product-images', $1, $2)`, [`${U.sup3}/steal.webp`, U.sup1], /row-level security/);
  await expectFail(as(U.sup2), `insert into storage.objects (bucket_id, name, owner) values ('product-images', $1, $2)`, [`${U.sup2}/pending.webp`, U.sup2], /row-level security/);
  await expectFail(as(U.buyer1), `insert into storage.objects (bucket_id, name, owner) values ('product-images', $1, $2)`, [`${U.buyer1}/x.webp`, U.buyer1], /row-level security/);
});

await test('supplier coverage: suppliers manage only their own coverage', async () => {
  await run(as(U.sup1), `insert into public.supplier_coverage (business_id, city_code) values ($1, 'basra')`, [B.sup1]);
  await expectFail(as(U.sup1), `insert into public.supplier_coverage (business_id, city_code) values ($1, 'erbil')`, [B.sup3], /row-level security/);
  const cover = await run(null, `select count(*)::int as n from public.supplier_coverage where business_id = $1`, [B.sup1]);
  assert.ok(cover.rows[0].n >= 2);
});

await test('audit logs capture role and status changes performed by administrators', async () => {
  await run(as(U.admin), `select public.admin_set_user_active($1, false, 'اختبار مراجعة السجل')`, [U.buyer2]);
  await run(as(U.admin), `select public.admin_set_user_active($1, true, 'اختبار مراجعة السجل')`, [U.buyer2]);
  const logs = await run(as(U.admin), `select action, table_name, note from public.audit_logs where table_name = 'profiles' and record_id = $1 order by id desc limit 2`, [U.buyer2]);
  assert.equal(logs.rows[0].note, 'اختبار مراجعة السجل');
  assert.equal(logs.rows[0].table_name, 'profiles');
});

// ---------------------------------------------------------------------------
await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} database tests passed.`);
if (failed.length > 0) {
  process.exit(1);
}
