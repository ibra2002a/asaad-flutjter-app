import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile, profileState } from '@/lib/session';
import { homePathFor } from '@/lib/domain/authz';
import { listCities } from '@/lib/data/catalog';
import { RegisterForm } from '@/components/forms/RegisterForm';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage() {
  const profile = await getProfile();
  if (profile?.is_active) redirect(homePathFor(profileState(profile)));
  const cities = await listCities();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-bold tracking-widest text-brand-600">VENDORA</p>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-950">أنشئ حسابك التجاري</h1>
        <p className="mt-2 text-muted">تسجيل مجاني. يبدأ الطلب أو البيع بعد مراجعة بياناتك.</p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <RegisterForm cities={cities} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        لديك حساب بالفعل؟ <Link href="/login" className="font-bold text-brand-700 hover:underline">سجّل الدخول</Link>
      </p>
    </div>
  );
}
