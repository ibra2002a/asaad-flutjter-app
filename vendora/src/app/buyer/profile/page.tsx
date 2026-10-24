import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMyBusiness, getProfile } from '@/lib/session';
import { listCities } from '@/lib/data/catalog';
import { deleteAddressAction, setDefaultAddressAction } from '@/lib/actions/account';
import { BusinessForm, ProfileForm, AddressForm } from '@/components/forms/AccountForms';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { VerificationBadge } from '@/components/StatusBadge';
import type { Address } from '@/lib/data/types';

export const metadata: Metadata = { title: 'الملف التجاري' };

export default async function BuyerProfilePage() {
  const [profile, business, cities] = await Promise.all([getProfile(), getMyBusiness(), listCities()]);
  if (!profile || !business) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('addresses')
    .select('id, profile_id, label, city_code, district, address_line, phone, is_default')
    .order('is_default', { ascending: false });
  const addresses = (data ?? []) as Address[];

  return (
    <>
      <PageHeader
        title="الملف التجاري"
        description="حسابك وعناوين التوصيل. العنوان الافتراضي يُختار تلقائيا عند الدفع."
        actions={<VerificationBadge status={business.verification_status} />}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-8">
          <ProfileForm profile={profile} />
          <BusinessForm business={business} cities={cities} />
        </div>

        <div className="space-y-8">
          <Card>
            <h2 className="text-lg font-bold text-brand-950">عناوين التوصيل</h2>
            {addresses.length === 0 ? (
              <div className="mt-4"><EmptyState title="لا توجد عناوين بعد" description="أضف عنوانا لتتمكن من إتمام الطلبات." /></div>
            ) : (
              <ul className="mt-4 space-y-3">
                {addresses.map((address) => (
                  <li key={address.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-brand-950">{address.label}</p>
                      {address.is_default ? <Badge tone="lime">افتراضي</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{address.district} — {address.address_line}</p>
                    <p className="ltr-num mt-1 text-xs text-muted">{address.phone}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!address.is_default ? (
                        <form action={setDefaultAddressAction}>
                          <input type="hidden" name="id" value={address.id} />
                          <SubmitButton variant="secondary" pendingLabel="…" className="min-h-9 px-3 text-xs">اجعله الافتراضي</SubmitButton>
                        </form>
                      ) : null}
                      <form action={deleteAddressAction}>
                        <input type="hidden" name="id" value={address.id} />
                        <SubmitButton variant="ghost" pendingLabel="…" className="min-h-9 px-3 text-xs text-red-700">حذف</SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <AddressForm cities={cities} />
        </div>
      </div>
    </>
  );
}
