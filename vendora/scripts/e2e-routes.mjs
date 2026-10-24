/**
 * Route sweep: signs in as each role (fresh accounts), loads every page in that
 * role's portal at phone width, and checks for server errors, error screens and
 * horizontal scroll. Also confirms each role is refused the other portals.
 *
 *   E2E_BASE_URL=http://localhost:3400 CHROMIUM_PATH=... node scripts/e2e-routes.mjs
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ANON = process.env.E2E_ANON_KEY ?? '';
const RUN = Date.now().toString(36);
const PASSWORD = 'route-pass-12345';
const DB = process.env.E2E_DB_CONTAINER ?? 'supabase_db_vendora';
const SUPA = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const failures = [];
let checks = 0;

const sql = (q) => execFileSync('docker', ['exec', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();

async function createAccount(role, label) {
  const email = `${label}-${RUN}@vendora.test`;
  const res = await fetch(`${SUPA}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({
      email, password: PASSWORD,
      data: { role, full_name: `مستخدم ${label}`, legal_name: `${label} ${RUN}`, city_code: 'baghdad', phone: '07701234567' },
    }),
  });
  if (!res.ok) throw new Error(`signup ${label} failed: ${res.status} ${await res.text()}`);
  return email;
}

async function signIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator('#email').waitFor({ state: 'visible' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

async function visit(page, path, expectPrefix) {
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  const status = response?.status() ?? 0;
  const finalPath = new URL(page.url()).pathname;
  const body = await page.locator('main').innerText().catch(() => '');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  checks += 1;
  const problems = [];
  if (status >= 500) problems.push(`HTTP ${status}`);
  if (body.includes('حدث خطأ غير متوقع')) problems.push('error screen');
  if (overflow > 1) problems.push(`horizontal scroll ${overflow}px`);
  if (expectPrefix && !finalPath.startsWith(expectPrefix)) problems.push(`landed on ${finalPath}`);
  if (problems.length) failures.push(`${path}: ${problems.join(', ')}`);
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${path}${problems.length ? ' — ' + problems.join(', ') : ''}`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const mobile = () => browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-IQ', isMobile: true, hasTouch: true });

try {
  const buyerEmail = await createAccount('buyer', 'rbuyer');
  const supplierEmail = await createAccount('supplier', 'rsupplier');
  const adminEmail = await createAccount('buyer', 'radmin');
  sql(`update public.profiles set role='admin' where id=(select id from auth.users where email='${adminEmail}')`);
  sql(`update public.businesses set verification_status='approved' where owner_id=(select id from auth.users where email='${supplierEmail}')`);

  const roles = [
    { name: 'buyer', email: buyerEmail, prefix: '/buyer', pages: ['/buyer', '/buyer/orders', '/buyer/profile', '/notifications', '/cart', '/checkout'] },
    { name: 'supplier', email: supplierEmail, prefix: '/supplier', pages: ['/supplier', '/supplier/onboarding', '/supplier/products', '/supplier/products/new', '/supplier/orders', '/supplier/profile', '/supplier/reports'] },
    { name: 'admin', email: adminEmail, prefix: '/admin', pages: ['/admin', '/admin/suppliers', '/admin/buyers', '/admin/products', '/admin/orders', '/admin/disputes', '/admin/commissions', '/admin/categories', '/admin/audit'] },
  ];

  for (const role of roles) {
    const context = await mobile();
    const page = await context.newPage();
    await signIn(page, role.email);
    console.log(`--- ${role.name}`);
    for (const path of role.pages) await visit(page, path);
    for (const other of roles.filter((r) => r !== role)) {
      await visit(page, other.prefix, role.prefix);
    }
    await context.close();
  }

  const guest = await mobile();
  const guestPage = await guest.newPage();
  console.log('--- guest');
  for (const path of ['/', '/categories', '/products', '/suppliers', '/cart']) await visit(guestPage, path);
  await visit(guestPage, '/admin', '/login');
  await visit(guestPage, '/buyer', '/login');
  await guest.close();
} catch (error) {
  failures.push(`run aborted: ${error.message}`);
} finally {
  await browser.close();
}

console.log(`\n${checks} page checks, ${failures.length} problem(s)`);
for (const f of failures) console.log(`  ! ${f}`);
process.exitCode = failures.length ? 1 : 0;
