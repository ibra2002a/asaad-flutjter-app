import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/session';
import { markNotificationsReadAction } from '@/lib/actions/account';
import { formatDateAr, EmptyState, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export const metadata: Metadata = { title: 'الإشعارات' };

export default async function NotificationsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login?next=/notifications');

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  const items = (data ?? []) as Array<{ id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }>;
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="الإشعارات"
        description={unread > 0 ? `لديك ${unread} إشعار غير مقروء` : 'لا توجد إشعارات غير مقروءة'}
        actions={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <SubmitButton variant="secondary">تعيين الكل كمقروء</SubmitButton>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState title="لا توجد إشعارات" description="ستصلك تنبيهات عند تغيّر حالة طلباتك أو مراجعة حسابك." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const content = (
              <div className="flex items-start gap-3">
                {!n.read_at ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-lime-500" aria-label="غير مقروء" /> : <span className="mt-2 size-2.5 shrink-0" aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="font-bold text-brand-950">{n.title}</p>
                  {n.body ? <p className="mt-1 text-sm text-slate-700">{n.body}</p> : null}
                  <p className="mt-2 text-xs text-muted">{formatDateAr(n.created_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                {n.link ? (
                  <Link href={n.link} className="block rounded-lg hover:text-brand-800">{content}</Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
