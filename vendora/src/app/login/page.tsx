import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/forms/auth-forms';
import { Card, Notice } from '@/components/ui/card';
import { getSession, homePathFor } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homePathFor(session.viewer.role));

  const { next, error } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Card className="space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-brand-900">تسجيل الدخول</h1>
          <p className="text-muted">أهلاً بعودتك إلى VENDORA</p>
        </div>
        {error === 'confirm' ? <Notice tone="warning">تعذر تأكيد البريد. اطلب رابطاً جديداً أو سجّل الدخول.</Notice> : null}
        <LoginForm next={next} />
        <p className="text-center text-sm text-muted">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-semibold text-brand-700 underline">
            أنشئ حساباً
          </Link>
        </p>
      </Card>
    </div>
  );
}
