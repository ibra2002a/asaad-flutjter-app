# VENDORA — Operations, backup and recovery

## Creating an administrator

Admin rights are never granted through the app. Only an operator with access to the Supabase project can promote an account.

1. The person signs up at `/register` (as a buyer) using their work email, and confirms it.
2. In Supabase → **SQL Editor**, run (replace the email):

   ```sql
   update public.profiles
      set role = 'admin'
    where id = (select id from auth.users where email = 'admin@example.com');
   ```

3. Record the promotion in your operations log (who, when, why). The database itself does not log this statement.

To remove access: set `role = 'buyer'` the same way, or suspend the profile from `/admin/buyers` with a reason.

## Daily routine

| Check | Where | Action |
| --- | --- | --- |
| New suppliers | `/admin/suppliers` (pending) | Verify documents, then approve or reject with a note |
| Products awaiting review | `/admin/products` | Approve or reject with a note |
| Open disputes | `/admin/disputes` | Resolve within the agreed SLA |
| Commission to settle | `/admin/commissions` | After manual payment, press "تسوية يدوية" |

## Changing the commission rate

`/admin/commissions` → "تحديد نسبة عمولة جديدة". Choose the scope:

- **Global**: default for everyone.
- **Category**: overrides the global rate for one category.
- **Supplier**: a negotiated agreement that overrides both.

Every change requires a reason and is written to the audit log. Orders keep the rate that applied when they were placed, so a rate change never alters an existing order.

## Handling disputes

- **Partial return**: enter the quantity actually returned (or leave blank to accept the buyer's requested quantity). The order returns to its previous status and the commission is reduced automatically.
- **Full refund**: all units are treated as returned and the order is cancelled. Any commission already accrued is reversed by an adjustment.
- **No action**: the order returns to its previous status unchanged.

Every resolution is audited.

## Backup

Supabase backs up the database. For the pilot, keep **both**:

1. **Platform backups**: on a paid Supabase plan, enable daily backups and Point-in-Time Recovery (PITR) in **Project → Database → Backups**.
2. **Logical export** (independent copy you control). Run monthly, and before any migration:

   ```bash
   # Use the connection string from Supabase → Project Settings → Database (session pooler, port 5432).
   # Keep the output private: it contains customer and supplier data.
   pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges \
     --format=custom --file="vendora-public-$(date +%F).dump"
   ```

   Store dumps in an encrypted location with restricted access. Test a restore at least once per quarter.

Product images live in Supabase Storage. Back them up with the Supabase CLI or `rclone` against the `product-images` bucket on the same schedule.

## Recovery

### Restore the database from a dump (into a NEW project, never over production by accident)

```bash
pg_restore --no-owner --no-privileges --dbname "$RESTORE_DB_URL" vendora-public-YYYY-MM-DD.dump
```

Then re-apply the storage policy migration (`20260101000700_storage.sql`) and check Authentication settings, because auth users are not part of the `public` schema dump. Users must be restored from Supabase's auth backup or recreated.

### Restore from Point-in-Time Recovery

Use Supabase → Database → Backups → Restore to a point in time. Restores create a new database; verify it, then switch the application's environment variables to it.

### Recovering from an accidental bad admin action

- Commission rules: add a new rule with the correct rate (history is kept).
- Supplier status: approve/suspend again from `/admin/suppliers`.
- Order status: the event log (`order_events`) shows every change. Corrections must be made through the workflow (for example, a new commission adjustment), because the log is append-only by design.

## Incident checklist

1. Stop the bleeding: suspend the affected account from `/admin/buyers` or `/admin/suppliers` with a reason.
2. Capture evidence: query `audit_logs` and `order_events` for the time window.
3. Rotate secrets if any key may have leaked (Supabase → API settings → rotate; update Vercel).
4. Communicate with affected parties through the in-app notification and direct contact.
5. Write a short post-incident note in your operations log.
