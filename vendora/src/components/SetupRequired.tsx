/**
 * Shown instead of the storefront when Supabase credentials are missing. It names
 * exactly what to configure, so the app never fails with a generic error.
 */
export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-bold tracking-widest text-brand-600">VENDORA</p>
      <h1 className="text-3xl font-extrabold text-brand-950">الموقع يحتاج إلى إعداد قبل التشغيل</h1>
      <p className="text-muted">
        لم يتم ضبط الاتصال بقاعدة البيانات. هذه الرسالة تظهر في البيئات التي لم تُربط بعد بمشروع Supabase.
      </p>
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="font-semibold text-brand-950">المتغيرات المطلوبة:</p>
        <ul className="ltr-num mt-3 list-disc space-y-1 ps-6 text-sm text-slate-700">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>NEXT_PUBLIC_SITE_URL</li>
        </ul>
        <p className="mt-4 text-sm text-muted">راجع الملف docs/SETUP.md في المستودع للخطوات الكاملة.</p>
      </div>
    </main>
  );
}
