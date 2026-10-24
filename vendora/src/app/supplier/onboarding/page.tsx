import type { Metadata } from 'next';
import Link from 'next/link';
import { getMyBusiness } from '@/lib/session';
import { Card, PageHeader, buttonClass, Alert } from '@/components/ui';
import { VerificationBadge } from '@/components/StatusBadge';

export const metadata: Metadata = { title: 'اعتماد المورد' };

export default async function SupplierOnboardingPage() {
  const business = await getMyBusiness();
  const status = business?.verification_status ?? 'pending';
  const steps = [
    { title: 'إنشاء الحساب', done: true, text: 'تم إنشاء حساب المورد.' },
    { title: 'استكمال الملف التجاري', done: Boolean(business?.legal_name && business?.phone && business?.tax_number), text: 'أضف الاسم التجاري والهاتف والرقم الضريبي (إن وجد).' },
    { title: 'تحديد مناطق التغطية', done: false, text: 'اختر المدن التي تستطيع التوصيل إليها.' },
    { title: 'مراجعة الهوية التجارية', done: status === 'approved', text: 'يراجع فريق VENDORA بياناتك ويعتمد الحساب.' },
    { title: 'نشر المنتجات', done: false, text: 'بعد الاعتماد، أضف منتجاتك وأرسلها للمراجعة.' },
  ];

  return (
    <>
      <PageHeader eyebrow="خطوات الاعتماد" title="حالة حسابك كمورد" description="أكمل الخطوات التالية لتبدأ البيع على VENDORA." actions={<VerificationBadge status={status} />} />

      {status === 'rejected' ? <div className="mb-6"><Alert tone="error">{business?.review_note ?? 'لم يتم اعتماد الحساب. راجع الملف التجاري وتواصل مع الدعم.'}</Alert></div> : null}
      {status === 'suspended' ? <div className="mb-6"><Alert tone="error">{business?.review_note ?? 'الحساب معلّق حاليا. تواصل مع الدعم.'}</Alert></div> : null}
      {status === 'approved' ? <div className="mb-6"><Alert tone="success">تم اعتماد حسابك. يمكنك الآن إضافة المنتجات ونشرها بعد المراجعة.</Alert></div> : null}

      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card className="flex items-start gap-4">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {step.done ? '✓' : index + 1}
              </span>
              <div>
                <h2 className="font-bold text-brand-950">{step.title}</h2>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/supplier/profile" className={buttonClass('primary')}>إكمال الملف التجاري</Link>
        <Link href="/supplier/products" className={buttonClass('secondary')}>المنتجات</Link>
      </div>
    </>
  );
}
