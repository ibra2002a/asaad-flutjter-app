import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-xl font-black tracking-wide text-white">VENDORA</p>
          <p className="mt-2 text-sm text-brand-200">Trade Smarter. Grow Faster.</p>
          <p className="mt-3 text-sm text-brand-200">سوق الجملة B2B لربط التجار بموردين موثوقين. انطلاقة تجريبية في بغداد.</p>
        </div>
        <nav aria-label="روابط التذييل" className="flex flex-col gap-2 text-sm">
          <Link href="/categories" className="hover:text-lime-300">الفئات</Link>
          <Link href="/products" className="hover:text-lime-300">المنتجات</Link>
          <Link href="/suppliers" className="hover:text-lime-300">الموردون المعتمدون</Link>
          <Link href="/register" className="hover:text-lime-300">سجّل كتاجر أو مورد</Link>
        </nav>
        <div className="text-sm text-brand-200">
          <p className="font-semibold text-white">الدعم</p>
          <p className="mt-2">للاستفسار عن الطلبات أو الحسابات، تواصل مع فريق الدعم عبر الإشعارات داخل المنصة.</p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} VENDORA. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
