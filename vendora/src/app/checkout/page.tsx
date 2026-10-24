import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBuyerReady } from '@/lib/data/buyer';
import { CheckoutForm } from '@/components/CheckoutForm';
import { PageHeader, Alert, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'إتمام الطلب' };

export default async function CheckoutPage() {
  const ready = await requireBuyerReady();
  if (ready.kind === 'redirect') redirect(ready.to);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="الخطوة الأخيرة" title="إتمام الطلب" description="راجع الكميات والعنوان، ثم أكد الطلب. تُحسب الأسعار من النظام مباشرة." />
      {ready.kind === 'pending' ? (
        <Alert tone="warning">حسابك التجاري قيد المراجعة. ستتمكن من الطلب فور اعتماده.</Alert>
      ) : ready.addresses.length === 0 ? (
        <div className="space-y-4">
          <Alert tone="info">أضف عنوان توصيل أولا لإتمام الطلب.</Alert>
          <Link href="/buyer/profile" className={buttonClass('primary')}>إضافة عنوان التوصيل</Link>
        </div>
      ) : (
        <CheckoutForm addresses={ready.addresses} />
      )}
    </div>
  );
}
