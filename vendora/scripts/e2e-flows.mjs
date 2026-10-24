/**
 * Full user journey in a real browser against a running app and a live Supabase
 * project (local stack or test project). Creates uniquely named accounts.
 *
 *   E2E_BASE_URL=http://localhost:3200 E2E_DB_CONTAINER=supabase_db_vendora \
 *   CHROMIUM_PATH=... node scripts/e2e-flows.mjs
 *
 * Admin promotion is done by an operator-equivalent SQL statement, exactly as
 * OPERATIONS.md describes. It needs E2E_DB_CONTAINER (docker) or E2E_DATABASE_URL (psql).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const RUN = Date.now().toString(36);
const PASSWORD = 'e2e-pass-12345';
const PRODUCT = `زيت اختبار المتصفح ${RUN}`;
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const results = [];
const step = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) throw new Error(`step failed: ${name}`);
};

function sql(statement) {
  if (process.env.E2E_DATABASE_URL) {
    return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-tAc', statement], { encoding: 'utf8' }).trim();
  }
  const container = process.env.E2E_DB_CONTAINER ?? 'supabase_db_vendora';
  return execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', statement], { encoding: 'utf8' }).trim();
}

async function register(page, role, name) {
  await page.goto(`${BASE}/register`);
  await page.locator('#fullName').waitFor({ state: 'visible' });
  await page.locator(`input[name=role][value=${role}]`).check();
  await page.locator('#fullName').fill(`مستخدم ${name}`);
  await page.locator('#legalName').fill(`${role === 'supplier' ? 'مورد' : 'متجر'} ${name} ${RUN}`);
  await page.locator('#cityCode').selectOption('baghdad');
  await page.locator('#phone').fill('07701234567');
  await page.locator('#email').fill(`${name}-${RUN}@vendora.test`);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('input[name=acceptTerms]').check();
  await page.getByRole('button', { name: role === 'supplier' ? 'تسجيل كمورد' : 'إنشاء الحساب' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/register'), { timeout: 20000 });
  return `${name}-${RUN}@vendora.test`;
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator('#email').waitFor({ state: 'visible' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

async function logout(page) {
  await page.getByRole('button', { name: 'خروج' }).first().click();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 20000 });
}

async function waitFor(check, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  step(`no horizontal scroll: ${label}`, overflow <= 1, `${overflow}px`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  // ---------- 1. Sign-up on a phone-sized viewport
  // Each person gets an isolated browser context (separate cookies), like real users.
  const mobileContext = () => browser.newContext({ viewport: MOBILE, locale: 'ar-IQ', isMobile: true, hasTouch: true });
  const buyerContext = await mobileContext();
  const buyerPage = await buyerContext.newPage();
  const buyerEmail = await register(buyerPage, 'buyer', 'buyer');
  step('buyer registration redirects to buyer dashboard', /\/buyer/.test(new URL(buyerPage.url()).pathname));
  await noHorizontalScroll(buyerPage, 'buyer dashboard (390px)');
  await logout(buyerPage);

  const supplierContext = await mobileContext();
  const supplierPage = await supplierContext.newPage();
  const supplierEmail = await register(supplierPage, 'supplier', 'supplier');
  step('supplier registration lands on onboarding', new URL(supplierPage.url()).pathname === '/supplier/onboarding');
  await logout(supplierPage);

  // ---------- 2. Operator promotes an admin (documented procedure)
  const adminEmail = `admin-${RUN}@vendora.test`;
  const adminContext = await mobileContext();
  const adminPage = await adminContext.newPage();
  await register(adminPage, 'buyer', 'admin');
  // The admin registration above used the buyer form; its email is "admin-<RUN>@vendora.test".
  sql(`update public.profiles set role = 'admin' where id = (select id from auth.users where email = '${adminEmail}')`);
  await logout(adminPage);
  step('operator promotes admin account', sql(`select p.role from public.profiles p join auth.users u on u.id=p.id where u.email='${adminEmail}'`) === 'admin');

  // ---------- 3. Admin approves the supplier
  await login(adminPage, adminEmail);
  await adminPage.goto(`${BASE}/admin/suppliers?status=pending`);
  const card = adminPage.locator('li', { hasText: `مورد supplier ${RUN}` });
  await card.getByRole('button', { name: 'اعتماد', exact: true }).click();
  await waitFor(() => sql(`select verification_status from public.businesses b join auth.users u on u.id=b.owner_id where u.email='${supplierEmail}'`) === 'approved', 'supplier approved');
  step('admin approves supplier', sql(`select verification_status from public.businesses b join auth.users u on u.id=b.owner_id where u.email='${supplierEmail}'`) === 'approved');
  await noHorizontalScroll(adminPage, 'admin suppliers (390px)');
  await logout(adminPage);

  // ---------- 4. Supplier creates a product and submits for review
  await login(supplierPage, supplierEmail);
  await supplierPage.goto(`${BASE}/supplier/products/new`);
  await supplierPage.locator('#pr-name').fill(PRODUCT);
  await supplierPage.locator('#pr-category').selectOption({ label: 'المواد الغذائية والمشروبات' });
  await supplierPage.locator('#pr-unit').selectOption('carton');
  await supplierPage.locator('#pr-price').fill('300000');
  await supplierPage.locator('#pr-stock').fill('50');
  await supplierPage.locator('#pr-min').fill('1');
  await supplierPage.locator('#pr-status').selectOption('pending_review');
  await supplierPage.getByRole('button', { name: 'إنشاء المنتج' }).click();
  await supplierPage.waitForURL(/\/supplier\/products\/[0-9a-f-]{36}/, { timeout: 20000 });
  step('supplier creates product for review', sql(`select status from public.products where name_ar = '${PRODUCT}'`) === 'pending_review');
  await noHorizontalScroll(supplierPage, 'supplier product edit (390px)');
  // Upload a product photo through the real form (storage bucket + policy + product_images row).
  const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await supplierPage.locator('#pr-images').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG_1PX });
  await supplierPage.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await waitFor(() => sql(`select count(*) from public.product_images pi join public.products p on p.id=pi.product_id where p.name_ar='${PRODUCT}'`) === '1', 'image stored');
  step('supplier uploads a product photo', sql(`select storage_path from public.product_images pi join public.products p on p.id=pi.product_id where p.name_ar='${PRODUCT}'`).endsWith('.png'));
  await logout(supplierPage);

  // ---------- 5. Product is hidden from buyers until admin approval
  await login(buyerPage, buyerEmail);
  await buyerPage.goto(`${BASE}/products?q=${encodeURIComponent(PRODUCT)}`);
  step('unapproved product is hidden from buyers', (await buyerPage.locator('a[href^="/products/"]', { hasText: PRODUCT }).count()) === 0);

  // ---------- 6. Admin publishes it
  await login(adminPage, adminEmail);
  await adminPage.goto(`${BASE}/admin/products`);
  const pcard = adminPage.locator('li', { hasText: PRODUCT });
  await pcard.getByRole('button', { name: 'اعتماد ونشر' }).click();
  await waitFor(() => sql(`select status from public.products where name_ar = '${PRODUCT}'`) === 'active', 'product published');
  step('admin approves product', sql(`select status from public.products where name_ar = '${PRODUCT}'`) === 'active');
  await logout(adminPage);

  // ---------- 7. Buyer adds an address, shops, and checks out (mobile)
  await buyerPage.goto(`${BASE}/buyer/profile`);
  await buyerPage.locator('#ad-label').fill('المخزن الرئيسي');
  await buyerPage.locator('#ad-district').fill('الكرادة');
  await buyerPage.locator('#ad-line').fill('شارع 62 بناية 4');
  await buyerPage.locator('#ad-phone').fill('07701234567');
  await buyerPage.getByRole('button', { name: 'حفظ العنوان' }).click();
  await waitFor(() => sql(`select count(*) from public.addresses a join auth.users u on u.id=a.profile_id where u.email='${buyerEmail}'`) === '1', 'address saved');
  step('buyer saves delivery address', sql(`select count(*) from public.addresses a join auth.users u on u.id=a.profile_id where u.email='${buyerEmail}'`) === '1');

  await buyerPage.goto(`${BASE}/products?q=${encodeURIComponent(PRODUCT)}`);
  await buyerPage.locator('a[href^="/products/"]', { hasText: PRODUCT }).first().click();
  await buyerPage.getByRole('button', { name: 'أضف إلى السلة' }).click();
  step('buyer adds product to cart', await buyerPage.getByRole('link', { name: 'عرض السلة' }).isVisible());
  await noHorizontalScroll(buyerPage, 'product detail (390px)');
  await buyerPage.goto(`${BASE}/checkout`);
  await buyerPage.getByRole('button', { name: 'تأكيد الطلب' }).click();
  await buyerPage.waitForURL(/\/buyer\/orders\/[0-9a-f-]{36}/, { timeout: 30000 });
  const orderUrl = buyerPage.url();
  step('checkout creates order and opens tracking page', /notice=placed/.test(orderUrl));
  const orderId = orderUrl.match(/orders\/([0-9a-f-]{36})/)[1];
  await noHorizontalScroll(buyerPage, 'order tracking (390px)');
  await logout(buyerPage);

  // ---------- 8. Supplier fulfils the order
  await login(supplierPage, supplierEmail);
  await supplierPage.goto(`${BASE}/supplier/orders/${orderId}`);
  const steps = [
    ['قبول الطلب', 'accepted'],
    ['بدء التجهيز', 'preparing'],
    ['بدء التوصيل (في الطريق)', 'out_for_delivery'],
    ['تأكيد التسليم للتاجر', 'delivered'],
  ];
  for (const [label, expected] of steps) {
    const button = supplierPage.getByRole('button', { name: label });
    await button.waitFor({ state: 'visible', timeout: 20000 });
    await button.click();
    // Wait for the server action to commit, then for the page to refresh.
    await waitFor(() => sql(`select status from public.orders where id='${orderId}'`) === expected, `order → ${expected}`);
  }
  step('supplier moves order through fulfilment', sql(`select status from public.orders where id='${orderId}'`) === 'delivered');
  await logout(supplierPage);

  // ---------- 9. Buyer confirms receipt; commission is accrued
  await login(buyerPage, buyerEmail);
  await buyerPage.goto(`${BASE}/buyer/orders/${orderId}`);
  await buyerPage.getByRole('button', { name: 'تأكيد الاستلام' }).click();
  await waitFor(() => sql(`select status from public.orders where id='${orderId}'`) === 'completed', 'order completed');
  step('buyer confirms receipt; order completes', sql(`select status from public.orders where id='${orderId}'`) === 'completed');
  step('commission of IQD 12,000 accrued for IQD 300,000 at 4%', sql(`select commission_iqd from public.commissions where order_id='${orderId}'`) === '12000');
  await noHorizontalScroll(buyerPage, 'order detail after completion (390px)');
  await logout(buyerPage);

  // ---------- 10. Admin sees the commission on the dashboard
  await login(adminPage, adminEmail);
  await adminPage.goto(`${BASE}/admin/commissions`);
  step('admin commissions page lists the order', (await adminPage.getByText(/VND-/).count()) > 0);
  await adminPage.goto(`${BASE}/admin`);
  step('admin dashboard renders database metrics', (await adminPage.getByText('مؤشرات المنصة').count()) > 0);
  await noHorizontalScroll(adminPage, 'admin dashboard (390px)');
  await logout(adminPage);

  // ---------- 10b. Second and third orders: supplier rejects one, buyer cancels one
  async function placeOrderAsBuyer() {
    await login(buyerPage, buyerEmail);
    await buyerPage.goto(`${BASE}/products?q=${encodeURIComponent(PRODUCT)}`);
    await buyerPage.locator('a[href^="/products/"]', { hasText: PRODUCT }).first().click();
    await buyerPage.getByRole('button', { name: 'أضف إلى السلة' }).click();
    await buyerPage.goto(`${BASE}/checkout`);
    await buyerPage.getByRole('button', { name: 'تأكيد الطلب' }).click();
    await buyerPage.waitForURL(/\/buyer\/orders\/[0-9a-f-]{36}/, { timeout: 30000 });
    return buyerPage.url().match(/orders\/([0-9a-f-]{36})/)[1];
  }

  const rejectedId = await placeOrderAsBuyer();
  await logout(buyerPage);
  await login(supplierPage, supplierEmail);
  await supplierPage.goto(`${BASE}/supplier/orders/${rejectedId}`);
  await supplierPage.locator('#reject-reason').waitFor({ state: 'visible' });
  await supplierPage.locator('#reject-reason').fill('المنتج غير متوفر في المستودع حاليا');
  await supplierPage.getByRole('button', { name: 'رفض الطلب' }).click();
  await waitFor(() => sql(`select status from public.orders where id='${rejectedId}'`) === 'cancelled', 'rejected order cancelled');
  step('supplier rejects a new order with a reason', sql(`select cancellation_reason from public.orders where id='${rejectedId}'`).includes('المستودع'));
  await logout(supplierPage);

  const cancelledId = await placeOrderAsBuyer();
  await supplierPage.goto(`${BASE}/supplier/orders`);
  await logout(buyerPage);
  await login(supplierPage, supplierEmail);
  await supplierPage.goto(`${BASE}/supplier/orders/${cancelledId}`);
  await supplierPage.getByRole('button', { name: 'قبول الطلب' }).click();
  await waitFor(() => sql(`select status from public.orders where id='${cancelledId}'`) === 'accepted', 'order accepted');
  await logout(supplierPage);
  await login(buyerPage, buyerEmail);
  await buyerPage.goto(`${BASE}/buyer/orders/${cancelledId}`);
  await buyerPage.locator('#cancel-reason').fill('تغير في خطة الشراء');
  await buyerPage.getByRole('button', { name: 'إلغاء الطلب' }).click();
  await waitFor(() => sql(`select status from public.orders where id='${cancelledId}'`) === 'cancelled', 'buyer cancellation');
  step('buyer cancels an accepted order before preparation', sql(`select status from public.orders where id='${cancelledId}'`) === 'cancelled');

  // ---------- 10c. Buyer opens a return dispute on the completed order; admin resolves it
  await buyerPage.goto(`${BASE}/buyer/orders/${orderId}`);
  await buyerPage.locator('#dp-reason').fill('وصلت العبوة تالفة ولم تطابق الوصف');
  await buyerPage.getByRole('button', { name: 'فتح النزاع' }).click();
  await waitFor(() => sql(`select count(*) from public.disputes where order_id='${orderId}' and status='open'`) === '1', 'dispute opened');
  step('buyer opens a return dispute on a completed order', sql(`select status from public.orders where id='${orderId}'`) === 'disputed');
  await logout(buyerPage);

  await login(adminPage, adminEmail);
  await adminPage.goto(`${BASE}/admin/disputes`);
  const disputeId = sql(`select id from public.disputes where order_id='${orderId}' and status='open'`);
  await adminPage.locator(`#note-${disputeId}`).fill('تم التحقق من الصور، قبول إرجاع الكمية');
  // Scope to this run's dispute: earlier runs may leave other open disputes on the page.
  await adminPage.locator('form', { has: adminPage.locator(`#note-${disputeId}`) }).getByRole('button', { name: 'إرجاع جزئي' }).click();
  await waitFor(() => sql(`select status from public.disputes where id='${disputeId}'`) === 'resolved', 'dispute resolved');
  step('admin resolves a return; order returns to completed', sql(`select status from public.orders where id='${orderId}'`) === 'completed');
  step('commission reverses by the returned unit (net IQD 0)', sql(`select (c.commission_iqd + coalesce((select sum(a.amount_iqd) from public.commission_adjustments a where a.commission_id = c.id),0)) from public.commissions c where c.order_id='${orderId}'`) === '0');
  await noHorizontalScroll(adminPage, 'admin disputes (390px)');

  // ---------- 10d. CSV export is admin-only and downloads a valid file
  const csv = await adminPage.request.get(`${BASE}/admin/exports/commissions`);
  const body = await csv.text();
  step('admin downloads commissions CSV', csv.status() === 200 && (csv.headers()['content-type'] || '').includes('text/csv') && body.includes('order_number,supplier,'));
  // Anonymous visitors are redirected to login by middleware; no CSV content may be returned.
  const anonContext = await browser.newContext();
  const anonResponse = await anonContext.request.get(`${BASE}/admin/exports/commissions`);
  const anonBody = await anonResponse.text();
  await anonContext.close();
  step('CSV export never returns data to anonymous visitors', !anonBody.includes('order_number,supplier,') && /\/login/.test(anonResponse.url()));
  await logout(adminPage);

  // ---------- 11. Desktop pass over the public storefront
  const desktop = await browser.newContext({ viewport: DESKTOP, locale: 'ar-IQ' });
  const guest = await desktop.newPage();
  await guest.goto(`${BASE}/`);
  step('landing page renders Arabic RTL', (await guest.getAttribute('html', 'dir')) === 'rtl');
  await noHorizontalScroll(guest, 'landing (1280px)');
  await guest.goto(`${BASE}/products?q=${encodeURIComponent(PRODUCT)}`);
  step('guest sees the approved product on the storefront', (await guest.locator('a[href^="/products/"]', { hasText: PRODUCT }).count()) > 0);
  await guest.locator('a[href^="/products/"]', { hasText: PRODUCT }).first().click();
  await guest.waitForURL(/\/products\/[0-9a-f-]{36}/);
  const photo = await guest.locator('main img[src*="product-images"]').count();
  step('public product page shows the uploaded photo from storage', photo > 0);
  await desktop.close();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} steps passed`);
}
