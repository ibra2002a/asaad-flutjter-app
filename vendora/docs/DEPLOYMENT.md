# VENDORA — Deployment (Vercel + Supabase)

Deploy the **test environment first**, verify, then promote to production.
Production steps that cost money, buy a domain, or change live data need the
founder's explicit approval.

## 0. Pre-flight

- [ ] `npm run check` passes on the commit you are deploying.
- [ ] Migrations applied to the **test** Supabase project and smoke-tested.
- [ ] You have read `docs/OPERATIONS.md` (backups, administrator creation).
- [ ] You have a recent backup plan (Supabase point-in-time recovery on a paid tier, or the scheduled logical backup in OPERATIONS.md).

## 1. Supabase

Create two projects: **vendora-test** and **vendora-prod**. Apply the migrations to each (SETUP.md §4) in order.

For each project:

1. **Authentication → URL Configuration**: Site URL = the app's public URL. Add `<url>/auth/callback` to Redirect URLs.
2. **Authentication → Email**: enable "Confirm email". Customise the templates in Arabic if desired.
3. **Storage**: confirm the `product-images` bucket exists (created by migration `20260101000700`) and is public-read.
4. **Settings → API**: copy the URL, anon key and service-role key into the environment.
5. **Database → Backups**: enable point-in-time recovery if your plan supports it (recommended before real customers).

## 2. Vercel

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project** → import the repository.
3. **Root Directory**: set to `vendora`. (The legacy Flutter files at the repository root are not part of VENDORA.)
4. **Framework Preset**: Next.js (auto-detected). Build command: `npm run build`. Output: default.
5. **Environment Variables** (Production and Preview):

   | Name | Value source | Public? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings | yes |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings (anon key) | yes |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` or your domain | yes |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings (service_role) | **no — leave it out of the app environment** unless you run scripts from Vercel |

   The application itself never needs the service-role key. Keep it out of Vercel unless a maintenance script runs there.

6. Deploy. Vercel builds with `npm ci` and `next build`.

Use a **separate Vercel project or Preview environment** pointed at `vendora-test` for trials. Production variables must point only at `vendora-prod`.

## 3. Post-deploy verification (test environment)

Run through this list on the deployed URL and record the result:

- [ ] Landing page loads; `lang="ar"` and `dir="rtl"`; layout correct on a phone.
- [ ] Register as a buyer → confirmation email received → sign in → lands in `/buyer`.
- [ ] Register as a supplier → lands in `/supplier/onboarding` as "pending".
- [ ] Admin promotes a test admin (OPERATIONS.md) → `/admin` shows real counts.
- [ ] Admin approves the supplier → supplier receives a notification.
- [ ] Supplier creates a product → it does **not** appear on `/products` → admin approves → it appears.
- [ ] Buyer adds to cart, checks out → order appears in `/buyer/orders` and `/supplier/orders`.
- [ ] Supplier accepts → prepares → out for delivery → delivered → buyer confirms receipt → commission appears in `/admin/commissions`.
- [ ] CSV export downloads from `/admin/exports/orders`.

## 4. Custom domain (requires founder approval: may incur cost)

1. Purchase the domain (founder decision).
2. Vercel → Project → **Settings → Domains** → add the domain and follow the DNS instructions.
3. Update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL / Redirect URLs to the new domain, then redeploy.

## 5. Rollback

- **App**: Vercel → Deployments → select the last good deployment → **Promote to Production**.
- **Database**: migrations are forward-only. To roll back, apply a new corrective migration. For data incidents, follow the recovery steps in `docs/OPERATIONS.md`.

## 6. Monitoring (minimum)

- Vercel → Logs for server errors (`[VENDORA]` prefix in error logs).
- Supabase → Logs for database and auth events.
- Check the admin dashboard daily for pending suppliers, products and open disputes.
