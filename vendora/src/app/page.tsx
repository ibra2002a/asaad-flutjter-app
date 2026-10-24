import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';
import { Card, Badge } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'الجملة للتجار في العراق',
  description: 'اطلب بالجملة من موردين معتمدين في بغداد. أسعار واضحة بالدينار العراقي وتتبع كامل للطلب.',
};

const VALUE_PROPS = [
  {
    title: 'موردون معتمدون',
    text: 'كل مورد يُراجع يدوياً قبل نشر منتجاته. لا تظهر منتجات غير معتمدة في الكتالوج.',
  },
  {
    title: 'أسعار واضحة بالدينار',
    text: 'سعر كل وحدة وحد أدنى للكمية وتوفر المنتج ومناطق التوصيل، معروضة قبل الطلب.',
  },
  {
    title: 'تتبع كامل للطلب',
    text: 'من الإرسال إلى التسليم، كل تغيير في الحالة مسجّل بالتاريخ والجهة المنفّذة.',
  },
];

const STEPS = [
  { n: '١', title: 'اختر منتجاتك', text: 'تصفح الكتالوج واختر من مورد واحد لكل طلب.' },
  { n: '٢', title: 'حدد العنوان والدفع', text: 'اختر عنوان التوصيل وطريقة الدفع المتفق عليها.' },
  { n: '٣', title: 'أرسل الطلب', text: 'يتحقق النظام من الأسعار والتوفر والحد الأدنى تلقائياً.' },
  { n: '٤', title: 'تابع حتى التسليم', text: 'يؤكد المورد الطلب ويتابعه حتى يصلك.' },
];

export default function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(163,230,53,0.25),transparent_45%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="space-y-6">
            <Badge tone="success">المرحلة التجريبية · بغداد</Badge>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              VENDORA
              <span className="mt-3 block text-2xl font-bold text-lime-400 sm:text-3xl">Trade Smarter. Grow Faster.</span>
            </h1>
            <p className="max-w-xl text-lg text-brand-100/90">
              منصة الجملة التي تربط أصحاب المحلات والمطاعم والشركات بموردين معتمدين في العراق. اطلب بالدينار، وتابع طلبك خطوة بخطوة.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/products" className={buttonClass('accent', 'px-6 text-base')}>
                تصفح المنتجات
              </Link>
              <Link href="/register" className={buttonClass('onDark', 'px-6 text-base')}>
                إنشاء حساب تاجر
              </Link>
            </div>
          </div>
          <div className="grid content-center gap-4">
            <Card className="space-y-2 border-white/10 bg-white/5 text-white shadow-none">
              <p className="text-sm text-brand-100/80">لأصحاب المحلات والمطاعم</p>
              <p className="text-xl font-bold">اطلب ما تحتاجه بالجملة، بسعر واضح ومن مورد معتمد.</p>
            </Card>
            <Card className="space-y-2 border-white/10 bg-white/5 text-white shadow-none">
              <p className="text-sm text-brand-100/80">للموردين والموزعين</p>
              <p className="text-xl font-bold">اعرض منتجاتك على تجار بغداد، واستقبل الطلبات مباشرة.</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-10 px-4 py-16 sm:px-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-3xl font-bold text-brand-900">لماذا VENDORA؟</h2>
          <p className="text-muted">بنينا المنصة على ثلاثة مبادئ: الثقة في الموردين، ووضوح الأسعار، وسهولة متابعة كل طلب.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((item) => (
            <Card key={item.title} className="space-y-3">
              <span className="block h-1 w-10 rounded-full bg-lime-400" aria-hidden="true" />
              <h3 className="text-xl font-bold text-brand-900">{item.title}</h3>
              <p className="text-muted">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-brand-50/60 py-16">
        <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-brand-900">كيف تطلب؟</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
                <span className="grid size-10 place-items-center rounded-full bg-brand-800 font-bold text-lime-400">{step.n}</span>
                <h3 className="font-bold text-brand-900">{step.title}</h3>
                <p className="text-sm text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand-800 p-8 text-white sm:flex-row sm:items-center sm:p-12">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">أنت مورد جملة؟</h2>
            <p className="text-brand-100/90">سجّل نشاطك، وبعد الاعتماد انشر منتجاتك واستقبل طلبات التجار في محافظتك.</p>
          </div>
          <Link href="/register" className={buttonClass('accent', 'px-6')}>
            سجّل كمورد
          </Link>
        </div>
      </section>
    </div>
  );
}
