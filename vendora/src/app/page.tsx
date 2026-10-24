import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listCategories, listProducts } from '@/lib/data/catalog';
import { ProductCard } from '@/components/ProductCard';
import { buttonClass, Card } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = {
  title: 'VENDORA — Trade Smarter. Grow Faster.',
  description: 'اشترِ بالجملة من موردين معتمدين في العراق، وتابع طلباتك خطوة بخطوة.',
};

async function getStats() {
  if (!isSupabaseConfigured()) return { suppliers: 0, products: 0 };
  const supabase = await createSupabaseServerClient();
  const [suppliers, products] = await Promise.all([
    supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('kind', 'supplier').eq('verification_status', 'approved'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]);
  return { suppliers: suppliers.count ?? 0, products: products.count ?? 0 };
}

export default async function HomePage() {
  const [categories, stats, featured] = await Promise.all([
    listCategories(),
    getStats(),
    listProducts({ page: 1 }),
  ]);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-lime-400/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-lime-300 ring-1 ring-white/15">
              <span className="size-2 rounded-full bg-lime-400" aria-hidden="true" />
              انطلاقة تجريبية في بغداد
            </p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              اشترِ بالجملة من موردين <span className="text-lime-400">معتمدين</span>، بثقة وشفافية
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-brand-100">
              قارن الموردين، اطلب بأسعار الجملة، وتابع طلبك من التجهيز حتى التسليم. كل مورد يُراجع قبل أن يبيع على المنصة.
            </p>
            <p className="text-sm font-bold tracking-widest text-lime-300">Trade Smarter. Grow Faster.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/products" className={buttonClass('accent', 'min-h-12 px-7 text-base')}>
                تصفح المنتجات
              </Link>
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-7 text-base font-bold text-white hover:bg-white/10">
                سجّل نشاطك التجاري
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            {[
              { label: 'موردون معتمدون', value: stats.suppliers },
              { label: 'منتجات منشورة', value: stats.products },
              { label: 'فئات رئيسية', value: categories.length },
              { label: 'منتجات تُراجع قبل النشر', value: '١٠٠٪' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10 backdrop-blur">
                <dt className="text-sm font-medium text-brand-200">{item.label}</dt>
                <dd className="ltr-num mt-2 text-4xl font-black text-white">{typeof item.value === 'number' ? item.value.toLocaleString('ar-IQ') : item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="text-center text-2xl font-extrabold text-brand-950 sm:text-3xl">كيف يعمل VENDORA؟</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { step: '١', title: 'اختر وقارن', text: 'تصفح الفئات والمنتجات، وقارن الموردين المعتمدين ومناطق تغطيتهم.' },
            { step: '٢', title: 'اطلب بأمان', text: 'أسعار وكميات الجملة محسوبة من النظام. كل طلب يصل للمورد المعني مباشرة.' },
            { step: '٣', title: 'تابع حتى التسليم', text: 'تتبع كل مرحلة من القبول حتى التسليم، وافتح نزاعا إذا لزم الأمر.' },
          ].map((item) => (
            <Card key={item.step} className="relative">
              <span className="flex size-11 items-center justify-center rounded-xl bg-lime-300 text-lg font-black text-brand-950">{item.step}</span>
              <h3 className="mt-4 text-lg font-bold text-brand-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6" aria-labelledby="cats">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 id="cats" className="text-2xl font-extrabold text-brand-950 sm:text-3xl">تسوّق حسب الفئة</h2>
            <Link href="/categories" className="text-sm font-semibold text-brand-700 hover:underline">كل الفئات</Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <li key={category.id}>
                <Link href={`/products?category=${category.slug}`} className="flex min-h-16 items-center rounded-2xl border border-line bg-white px-5 py-4 font-bold text-brand-900 shadow-sm hover:border-brand-300 hover:bg-brand-50">
                  {category.name_ar}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-white py-16" aria-labelledby="featured">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 id="featured" className="text-2xl font-extrabold text-brand-950 sm:text-3xl">أحدث المنتجات المعتمدة</h2>
            <Link href="/products" className="text-sm font-semibold text-brand-700 hover:underline">عرض الكل</Link>
          </div>
          {featured.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-brand-200 p-8 text-center text-muted">
              لا توجد منتجات منشورة حاليا. تُعرض المنتجات هنا بعد اعتمادها.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.items.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-brand-900 p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <div>
            <h2 className="text-2xl font-extrabold">هل أنت مورد بالجملة؟</h2>
            <p className="mt-2 max-w-xl text-brand-200">سجّل شركتك، وبعد اعتماد الهوية التجارية انشر منتجاتك واستقبل الطلبات مباشرة من التجار.</p>
          </div>
          <Link href="/register" className={buttonClass('accent', 'min-h-12 shrink-0 px-7 text-base')}>
            سجّل كمورد
          </Link>
        </div>
      </section>
    </>
  );
}
