export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="space-y-2">
          <p className="text-lg font-black tracking-wide text-white">VENDORA</p>
          <p className="text-sm text-brand-100/80">Trade Smarter. Grow Faster.</p>
        </div>
        <div className="space-y-2 text-sm text-brand-100/80">
          <p className="font-semibold text-white">المرحلة التجريبية</p>
          <p>التوصيل مبدئياً في بغداد. الطلبات من مورد واحد لكل طلب.</p>
        </div>
        <div className="space-y-2 text-sm text-brand-100/80">
          <p className="font-semibold text-white">الدفع</p>
          <p>لا تحتفظ المنصة بأموال المشترين. الدفع يتم بالطريقة المتفق عليها بين الطرفين.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-brand-100/60">
        © {new Date().getFullYear()} VENDORA · جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
