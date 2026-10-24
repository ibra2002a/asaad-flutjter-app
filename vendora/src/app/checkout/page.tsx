import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/card';
import { CheckoutForm, type AddressOption } from '@/components/forms/checkout-form';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'إتمام الطلب' };

export default async function CheckoutPage() {
  const session = await requireSession(['buyer']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('addresses')
    .select('id, label, address_line, cities:city_code(name_ar)')
    .order('created_at', { ascending: false });

  const addresses: AddressOption[] = (data ?? []).map((a) => {
    const city = a.cities as unknown as { name_ar: string } | null;
    return {
      id: a.id as string,
      label: a.label as string,
      address_line: a.address_line as string,
      city_name: city?.name_ar ?? '',
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader title="إتمام الطلب" description="راجع العنوان وطريقة الدفع. يتم تأكيد الأسعار والتوفر من الخادم." />
      <CheckoutForm addresses={addresses} defaultPhone={session.viewer.phone} />
    </div>
  );
}
