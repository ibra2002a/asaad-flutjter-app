/**
 * DEMO DATA ONLY — NON-PRODUCTION.
 *
 * Creates clearly labelled demo accounts, one approved supplier with products,
 * and a buyer address, so the marketplace can be exercised in a test project.
 *
 * Safety:
 *   - Refuses to run unless VENDORA_ALLOW_DEMO_SEED=true is set explicitly.
 *   - Every business name is prefixed with "[DEMO]" and emails use @vendora.test.
 *   - Uses the service-role key, which must only exist in your local shell or
 *     CI secrets. It is never read by the application.
 *
 * Usage (test project only):
 *   VENDORA_ALLOW_DEMO_SEED=true DEMO_PASSWORD='choose-a-strong-test-pass' npm run seed:demo
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEMO_PREFIX = '[DEMO]';
const DOMAIN = 'vendora.test';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See docs/SETUP.md.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  if (process.env.VENDORA_ALLOW_DEMO_SEED !== 'true') {
    console.error('Refusing to seed: set VENDORA_ALLOW_DEMO_SEED=true on a TEST project only.');
    process.exit(1);
  }

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const password = requireEnv('DEMO_PASSWORD');
  if (password.length < 12) {
    console.error('DEMO_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const accounts = [
    { key: 'buyer', email: `buyer@${DOMAIN}`, role: 'buyer', fullName: 'تاجر تجريبي', legalName: `${DEMO_PREFIX} متجر الأمل للمواد الغذائية` },
    { key: 'supplier', email: `supplier@${DOMAIN}`, role: 'supplier', fullName: 'مورد تجريبي', legalName: `${DEMO_PREFIX} شركة الرافدين للتوريدات` },
    { key: 'admin', email: `admin@${DOMAIN}`, role: 'buyer', fullName: 'مدير تجريبي', legalName: `${DEMO_PREFIX} إدارة VENDORA` },
  ] as const;

  const ids: Record<string, string> = {};
  for (const account of accounts) {
    const existing = await findUserByEmail(admin, account.email);
    if (existing) {
      ids[account.key] = existing;
      console.log(`exists  ${account.email}`);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: {
        role: account.role,
        full_name: account.fullName,
        legal_name: account.legalName,
        city_code: 'baghdad',
        phone: account.key === 'buyer' ? '07700000001' : account.key === 'supplier' ? '07700000002' : '07700000003',
      },
    });
    if (error || !data.user) {
      console.error(`failed to create ${account.email}: ${error?.message}`);
      process.exit(1);
    }
    ids[account.key] = data.user.id;
    console.log(`created ${account.email}`);
  }

  // Promote the demo admin. Only the service role can do this, never a client.
  await must(admin.from('profiles').update({ role: 'admin' }).eq('id', ids.admin!), 'promote admin');
  // Approve the demo supplier, as an administrator would after document review.
  await must(
    admin.from('businesses').update({ verification_status: 'approved', reviewed_at: new Date().toISOString() }).eq('owner_id', ids.supplier!),
    'approve supplier',
  );
  await must(
    admin.from('supplier_coverage').upsert({ business_id: await businessIdOf(admin, ids.supplier!), city_code: 'baghdad' }, { onConflict: 'business_id,city_code' }),
    'coverage',
  );

  const supplierBizId = await businessIdOf(admin, ids.supplier!);
  const { data: categories } = (await admin.from('categories').select('id, slug')) as { data: Array<{ id: string; slug: string }> | null };
  const categoryId = (slug: string) => categories?.find((c) => c.slug === slug)?.id;

  const products = [
    { name_ar: '[تجريبي] زيت دوار الشمس — كرتون 12 لتر', slug: 'food-beverages', unit: 'carton', price_iqd: 300000, sale_price_iqd: null, min_order_qty: 1, max_order_qty: 50, stock_qty: 120 },
    { name_ar: '[تجريبي] رز بسمتي — كيس 10 كغم', slug: 'food-beverages', unit: 'bag', price_iqd: 60000, sale_price_iqd: 55000, min_order_qty: 2, max_order_qty: 40, stock_qty: 300 },
    { name_ar: '[تجريبي] منظف أرضيات — عبوة 4 لتر', slug: 'cleaning', unit: 'liter', price_iqd: 18000, sale_price_iqd: null, min_order_qty: 6, max_order_qty: null, stock_qty: 500 },
  ];

  for (const p of products) {
    const { data: existing } = (await admin.from('products').select('id').eq('name_ar', p.name_ar).maybeSingle()) as { data: { id: string } | null };
    if (existing) continue;
    await must(
      admin.from('products').insert({
        supplier_id: supplierBizId,
        category_id: categoryId(p.slug),
        name_ar: p.name_ar,
        description_ar: 'منتج تجريبي لاختبار المنصة. ليس منتجا حقيقيا.',
        unit: p.unit,
        price_iqd: p.price_iqd,
        sale_price_iqd: p.sale_price_iqd,
        min_order_qty: p.min_order_qty,
        max_order_qty: p.max_order_qty,
        stock_qty: p.stock_qty,
        status: 'active',
      }),
      `insert product ${p.name_ar}`,
    );
  }

  const { data: buyerAddress } = (await admin.from('addresses').select('id').eq('profile_id', ids.buyer!).maybeSingle()) as { data: { id: string } | null };
  if (!buyerAddress) {
    await must(
      admin.from('addresses').insert({
        profile_id: ids.buyer!,
        label: `${DEMO_PREFIX} المخزن`,
        city_code: 'baghdad',
        district: 'الكرادة',
        address_line: 'عنوان تجريبي — شارع 62',
        phone: '07700000001',
        is_default: true,
      }),
      'insert buyer address',
    );
  }

  console.log('\nDEMO data ready. Accounts (test project only):');
  console.log(`  buyer    ${accounts[0].email}`);
  console.log(`  supplier ${accounts[1].email}`);
  console.log(`  admin    ${accounts[2].email}`);
  console.log('Use DEMO_PASSWORD to sign in. Remove demo data before any real launch.');
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function businessIdOf(admin: SupabaseClient, ownerId: string): Promise<string> {
  const { data } = (await admin.from('businesses').select('id').eq('owner_id', ownerId).single()) as { data: { id: string } | null };
  if (!data) throw new Error('supplier business not found');
  return data.id;
}

async function must(query: PromiseLike<{ error: { message: string } | null }>, label: string) {
  const { error } = await query;
  if (error) {
    console.error(`${label} failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
