// Seeds CLEARLY MARKED TEST DATA into a Supabase project (demo users, approved and pending suppliers,
// products, and an address). Every product name starts with "[تجريبي]" and every account uses
// the @vendora.test domain. Run it only against a development or pilot project you control.
//
// Usage (on your own computer, never in Vercel or in the browser):
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   SEED_DEMO_PASSWORD='choose-a-long-password' \
//   node scripts/seed-demo.mjs
//
// The script is idempotent: existing demo accounts are reused.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_DEMO_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_DEMO_PASSWORD (8+ characters).');
  process.exit(1);
}
if (password.length < 8) {
  console.error('SEED_DEMO_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const TEST_PREFIX = '[تجريبي]';

async function ensureUser(email, meta) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list.data?.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function one(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

console.log('Seeding TEST data into', url);

const buyerId = await ensureUser('buyer.demo@vendora.test', {
  role: 'buyer', full_name: `${TEST_PREFIX} مشتري تجريبي`, phone: '07700000011', business_name: `${TEST_PREFIX} محل الأمل`, city_code: 'baghdad',
});
const supplierId = await ensureUser('supplier.demo@vendora.test', {
  role: 'supplier', full_name: `${TEST_PREFIX} مورد تجريبي`, phone: '07700000021', business_name: `${TEST_PREFIX} شركة الرافدين للجملة`, city_code: 'baghdad', business_address: 'بغداد - الكرادة',
});
const pendingId = await ensureUser('pending.demo@vendora.test', {
  role: 'supplier', full_name: `${TEST_PREFIX} مورد بانتظار الاعتماد`, phone: '07700000022', business_name: `${TEST_PREFIX} مورد قيد المراجعة`, city_code: 'baghdad',
});
const adminId = await ensureUser('admin.demo@vendora.test', {
  role: 'buyer', full_name: `${TEST_PREFIX} مدير تجريبي`, phone: '07700000001', business_name: `${TEST_PREFIX} إدارة`, city_code: 'baghdad',
});
const opsId = await ensureUser('ops.demo@vendora.test', {
  role: 'buyer', full_name: `${TEST_PREFIX} عمليات تجريبي`, phone: '07700000002', business_name: `${TEST_PREFIX} عمليات`, city_code: 'baghdad',
});

// Roles for staff accounts (service role bypasses RLS; audit triggers record the change).
await one(admin.from('profiles').update({ role: 'admin' }).eq('id', adminId).select());
await one(admin.from('profiles').update({ role: 'ops' }).eq('id', opsId).select());

// Approve the demo supplier; leave the second one pending for testing the approval flow.
const supplierBiz = await one(admin.from('businesses').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('owner_id', supplierId).select('id'));
await one(admin.from('businesses').update({ status: 'pending' }).eq('owner_id', pendingId).select('id'));
const supplierBusinessId = supplierBiz[0].id;

// Coverage: Baghdad and Basra for the demo supplier.
await admin.from('supplier_coverage').upsert(
  [
    { business_id: supplierBusinessId, city_code: 'baghdad' },
    { business_id: supplierBusinessId, city_code: 'basra' },
  ],
  { onConflict: 'business_id,city_code', ignoreDuplicates: true },
);

// Demo buyer address.
const existingAddress = await one(admin.from('addresses').select('id').eq('owner_id', buyerId).limit(1));
if (existingAddress.length === 0) {
  await one(admin.from('addresses').insert({ owner_id: buyerId, label: `${TEST_PREFIX} المحل`, city_code: 'baghdad', address_line: 'بغداد - الكاظمية - شارع 14', landmark: 'قرب الجامع' }).select('id'));
}

// Demo products in the supplier's catalogue.
const categories = await one(admin.from('categories').select('id, slug'));
const categoryId = (slug) => categories.find((c) => c.slug === slug)?.id;
const products = [
  { name: 'رز بسمتي 10 كغم', unit: 'كيس', price: 45000, min: 2, category: 'groceries', stock: 'in_stock' },
  { name: 'زيت دوار الشمس 5 لتر', unit: 'كرتون', price: 30000, min: 1, category: 'groceries', stock: 'in_stock' },
  { name: 'شاي أحمر 500 غم', unit: 'كرتون', price: 12000, min: 5, category: 'beverages', stock: 'limited' },
  { name: 'مياه معدنية 1.5 لتر', unit: 'قطعة', price: 9000, min: 6, category: 'beverages', stock: 'in_stock' },
  { name: 'منظف أرضيات 4 لتر', unit: 'علبة', price: 14000, min: 2, category: 'cleaning', stock: 'in_stock' },
  { name: 'علب تغليف كرتونية متوسطة', unit: 'حزمة', price: 25000, min: 1, category: 'packaging', stock: 'out_of_stock' },
];
for (const p of products) {
  const name = `${TEST_PREFIX} ${p.name}`;
  const exists = await one(admin.from('products').select('id').eq('business_id', supplierBusinessId).eq('name', name).limit(1));
  if (exists.length > 0) continue;
  await one(
    admin.from('products').insert({
      business_id: supplierBusinessId,
      category_id: categoryId(p.category),
      name,
      description: 'منتج تجريبي لاختبار المنصة. ليس منتجاً حقيقياً.',
      unit: p.unit,
      price_iqd: p.price,
      min_quantity: p.min,
      stock_status: p.stock,
      is_published: true,
    }).select('id'),
  );
}

console.log('Done. Demo accounts (password = SEED_DEMO_PASSWORD):');
console.log('  buyer.demo@vendora.test     (مشتري، بغداد)');
console.log('  supplier.demo@vendora.test  (مورد معتمد)');
console.log('  pending.demo@vendora.test   (مورد بانتظار الاعتماد)');
console.log('  ops.demo@vendora.test       (فريق العمليات)');
console.log('  admin.demo@vendora.test     (مدير)');
