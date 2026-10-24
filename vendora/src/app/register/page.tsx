import type { Metadata } from 'next';
import { RegisterForm } from '@/components/forms/auth-forms';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getSession, homePathFor } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.viewer.role));

  const supabase = await createClient();
  const { data: cities } = await supabase.from('cities').select('code, name_ar').order('sort_order');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Card className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-brand-900">إنشاء حساب في VENDORA</h1>
          <p className="text-muted">سجّل كمشترٍ تجاري أو كمورد جملة. التسجيل مجاني.</p>
        </div>
        <RegisterForm cities={(cities ?? []) as { code: string; name_ar: string }[]} />
      </Card>
    </div>
  );
}
