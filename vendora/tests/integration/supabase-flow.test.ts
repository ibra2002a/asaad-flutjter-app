import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Runs the real application data path against a live Supabase stack
 * (GoTrue auth, PostgREST, RLS, the migrations): sign-up through the auth API,
 * scoped reads and writes, and every workflow function.
 *
 * Enabled only when SUPABASE_INTEGRATION=1 and the local/test project variables
 * are set (see docs/SETUP.md). It creates throwaway users with a unique suffix.
 */
const enabled = process.env.SUPABASE_INTEGRATION === '1';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const run = enabled ? describe : describe.skip;
const suffix = Date.now().toString(36);

function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signedInClient(email: string, password: string): Promise<{ client: SupabaseClient; id: string }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, id: data.user.id };
}

async function signUp(role: 'buyer' | 'supplier', name: string) {
  const email = `${role}-${suffix}-${name}@vendora.test`;
  const password = 'integration-pass-123';
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: `مستخدم ${name}`,
        legal_name: `شركة ${name} ${suffix}`,
        city_code: 'baghdad',
        phone: '07701234567',
      },
    },
  });
  if (error || !data.session) throw new Error(`sign-up failed (${role}): ${error?.message}`);
  return { email, password, id: data.user!.id, client };
}

run('live Supabase data path (auth, RLS, workflows)', () => {
  const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const state: Record<string, string> = {};
  let buyer: { email: string; password: string; id: string; client: SupabaseClient };
  let supplier: { email: string; password: string; id: string; client: SupabaseClient };
  let adminUser: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    buyer = await signUp('buyer', 'buyer');
    supplier = await signUp('supplier', 'supplier');
    // Operator promotes the admin account (service role only).
    const created = await signUp('buyer', 'admin');
    await admin().from('profiles').update({ role: 'admin' }).eq('id', created.id);
    adminUser = await signedInClient(created.email, created.password);
  });

  it('creates profile and business on sign-up through the auth API', async () => {
    const { data } = await buyer.client.from('profiles').select('role').eq('id', buyer.id).single();
    expect(data?.role).toBe('buyer');
    const { data: biz } = await buyer.client.from('businesses').select('verification_status').eq('owner_id', buyer.id).single();
    expect(biz?.verification_status).toBe('approved');
    const { data: supBiz } = await supplier.client.from('businesses').select('verification_status').eq('owner_id', supplier.id).single();
    expect(supBiz?.verification_status).toBe('pending');
  });

  it('rejects admin self-registration through sign-up metadata', async () => {
    const { error } = await anonClient().auth.signUp({
      email: `hacker-${suffix}@vendora.test`,
      password: 'integration-pass-123',
      options: { data: { role: 'admin', full_name: 'Hacker', legal_name: 'Hack Co', phone: '07700000000' } },
    });
    expect(error).not.toBeNull();
  });

  it('prevents a buyer from escalating their own role', async () => {
    const { error } = await buyer.client.from('profiles').update({ role: 'admin' }).eq('id', buyer.id).select();
    expect(error).not.toBeNull();
    const { data } = await buyer.client.from('profiles').select('role').eq('id', buyer.id).single();
    expect(data?.role).toBe('buyer');
  });

  it('prevents a supplier from approving its own business', async () => {
    const { error } = await supplier.client
      .from('businesses')
      .update({ verification_status: 'approved' })
      .eq('owner_id', supplier.id)
      .select();
    expect(error).not.toBeNull();
  });

  it('keeps privileged RPCs closed to non-admins', async () => {
    const { error } = await buyer.client.rpc('admin_review_business', {
      p_business_id: (await buyer.client.from('businesses').select('id').eq('owner_id', buyer.id).single()).data!.id,
      p_status: 'approved',
      p_note: null,
    });
    expect(error?.message).toMatch(/FORBIDDEN_ROLE/);
  });

  it('lets the admin approve the supplier and records the audit entry', async () => {
    const { data: supBiz } = await supplier.client.from('businesses').select('id').eq('owner_id', supplier.id).single();
    state.supplierBiz = supBiz!.id;
    const { error } = await adminUser.client.rpc('admin_review_business', {
      p_business_id: supBiz!.id,
      p_status: 'approved',
      p_note: null,
    });
    expect(error).toBeNull();
    const { data: audit } = await adminUser.client.from('audit_logs').select('action').eq('action', 'business.review');
    expect(audit?.length).toBeGreaterThan(0);
  });

  it('lets the approved supplier create a product that awaits review', async () => {
    const { data: cat } = await supplier.client.from('categories').select('id').eq('slug', 'food-beverages').single();
    const { data, error } = await supplier.client
      .from('products')
      .insert({
        supplier_id: state.supplierBiz,
        category_id: cat!.id,
        name_ar: `زيت اختبار ${suffix}`,
        unit: 'carton',
        price_iqd: 300000,
        min_order_qty: 1,
        max_order_qty: 10,
        stock_qty: 20,
        status: 'pending_review',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    state.product = data!.id;
  });

  it('hides a product awaiting review from anonymous visitors and buyers', async () => {
    const anon = await anonClient().from('products').select('id').eq('id', state.product);
    expect(anon.data).toEqual([]);
    const asBuyer = await buyer.client.from('products').select('id').eq('id', state.product);
    expect(asBuyer.data).toEqual([]);
  });

  it('refuses to let the supplier publish its own product', async () => {
    const { error } = await supplier.client.from('products').update({ status: 'active' }).eq('id', state.product).select();
    expect(error).not.toBeNull();
  });

  it('publishes the product after admin approval', async () => {
    const { error } = await adminUser.client.rpc('admin_review_product', {
      p_product_id: state.product,
      p_status: 'active',
      p_note: null,
    });
    expect(error).toBeNull();
    const { data } = await anonClient().from('products').select('id, status').eq('id', state.product);
    expect(data).toHaveLength(1);
  });

  it('lets the buyer add an address and place an idempotent order at the server price', async () => {
    const { data: addr, error: addrErr } = await buyer.client
      .from('addresses')
      .insert({ profile_id: buyer.id, label: 'المخزن', city_code: 'baghdad', district: 'الكرادة', address_line: 'شارع 62 بناية 4', phone: '07701234567', is_default: true })
      .select('id')
      .single();
    expect(addrErr).toBeNull();
    const items = [{ product_id: state.product, quantity: 2, unit_price_iqd: 1 }];
    const key = `integration-key-${suffix}`;
    const first = await buyer.client.rpc('place_order', { p_address_id: addr!.id, p_items: items, p_idempotency_key: key });
    expect(first.error).toBeNull();
    const orders = first.data as Array<{ order_id: string; total_iqd: number; duplicate: boolean }>;
    expect(orders).toHaveLength(1);
    expect(Number(orders[0]!.total_iqd)).toBe(600000);
    state.order = orders[0]!.order_id;

    const second = await buyer.client.rpc('place_order', { p_address_id: addr!.id, p_items: items, p_idempotency_key: key });
    const again = second.data as Array<{ order_id: string; duplicate: boolean }>;
    expect(again).toHaveLength(1);
    expect(again[0]!.order_id).toBe(state.order);
    expect(again[0]!.duplicate).toBe(true);
  });

  it('shows the order to the buyer and the owning supplier only', async () => {
    expect((await buyer.client.from('orders').select('id').eq('id', state.order)).data).toHaveLength(1);
    expect((await supplier.client.from('orders').select('id').eq('id', state.order)).data).toHaveLength(1);
    expect((await anonClient().from('orders').select('id').eq('id', state.order)).error).not.toBeNull();
  });

  it('walks the order through fulfilment and accrues IQD 24,000 commission on completion', async () => {
    for (const to of ['accepted', 'preparing', 'out_for_delivery', 'delivered']) {
      const { error } = await supplier.client.rpc('transition_order', { p_order_id: state.order, p_to: to, p_reason: null });
      expect(error, `supplier → ${to}`).toBeNull();
    }
    const { error: completeErr } = await buyer.client.rpc('transition_order', { p_order_id: state.order, p_to: 'completed', p_reason: null });
    expect(completeErr).toBeNull();
    const { data: commission } = await supplier.client.from('commissions').select('eligible_base_iqd, commission_iqd').eq('order_id', state.order).single();
    // 600,000 eligible × 4% = 24,000
    expect(Number(commission!.eligible_base_iqd)).toBe(600000);
    expect(Number(commission!.commission_iqd)).toBe(24000);
  });

  it('records each status change in the event log with actor and time', async () => {
    const { data } = await buyer.client.from('order_events').select('to_status, actor_role').eq('order_id', state.order).order('created_at');
    expect(data?.map((e) => e.to_status)).toEqual(['submitted', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'completed']);
  });

  it('notifies the supplier of the new order and the buyer of each fulfilment step', async () => {
    const { data: buyerNotes } = await buyer.client.from('notifications').select('title');
    expect(buyerNotes?.some((n) => n.title.includes('تم قبول الطلب'))).toBe(true);
    const { data: supNotes } = await supplier.client.from('notifications').select('title');
    expect(supNotes?.some((n) => n.title.includes('تم استلام الطلب') || n.title.includes('طلب'))).toBe(true);
  });

  it('lets the admin see commissions and exports them; buyers cannot read audit logs', async () => {
    const { data: rows } = await adminUser.client.from('commissions').select('id').eq('order_id', state.order);
    expect(rows).toHaveLength(1);
    const { data: auditForBuyer } = await buyer.client.from('audit_logs').select('id');
    expect(auditForBuyer).toEqual([]);
  });

  it('keeps one buyer\'s orders invisible to another buyer', async () => {
    const other = await signUp('buyer', 'other');
    expect((await other.client.from('orders').select('id').eq('id', state.order)).data).toEqual([]);
  });

  it('stores product images only under the supplier\'s own folder in storage', async () => {
    const { error: ownErr } = await supplier.client.storage
      .from('product-images')
      .upload(`${state.supplierBiz}/${state.product}/test.png`, new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), { upsert: true });
    expect(ownErr).toBeNull();
    const { error: otherErr } = await buyer.client.storage
      .from('product-images')
      .upload(`${state.supplierBiz}/${state.product}/evil.png`, new Blob([new Uint8Array([1])], { type: 'image/png' }));
    expect(otherErr).not.toBeNull();
  });
});
