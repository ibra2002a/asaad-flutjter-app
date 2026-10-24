import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile, profileState } from '@/lib/session';
import { homePathFor } from '@/lib/domain/authz';
import { LoginForm } from '@/components/forms/LoginForm';
import { safeNextPath } from '@/lib/actions/types';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

type SearchParams = Promise<{ next?: string; error?: string }>;

const NOTICE: Record<string, string> = {
  suspended: 'حسابك معلق حاليا. تواصل مع فريق الدعم.',
  confirm: 'تعذر تفعيل الرابط. اطلب رابطا جديدا وحاول مرة أخرى.',
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await getProfile();
  if (profile?.is_active) {
    redirect(safeNextPath(params.next, homePathFor(profileState(profile))));
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-bold tracking-widest text-brand-600">VENDORA</p>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-950">مرحبا بعودتك</h1>
        <p className="mt-2 text-muted">سجّل الدخول لمتابعة طلباتك وإدارة نشاطك التجاري.</p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <LoginForm next={params.next} notice={params.error ? NOTICE[params.error] : undefined} />
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/" className="hover:underline">العودة إلى الصفحة الرئيسية</Link>
      </p>
    </div>
  );
}
