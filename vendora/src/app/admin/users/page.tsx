import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { Badge, Card, PageHeader } from '@/components/ui/card';
import { UserControls } from '@/components/admin/admin-controls';

export const metadata: Metadata = { title: 'المستخدمون' };

export default async function UsersPage() {
  const session = await requireSession(['admin']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const users = (data ?? []) as Array<{ id: string; full_name: string; phone: string; role: string; is_active: boolean; created_at: string }>;

  return (
    <div className="space-y-6">
      <PageHeader title="المستخدمون" description="الأدوار والتفعيل. ترقية أو تعطيل أي حساب يتطلب سبباً مكتوباً ويُسجَّل في سجل التدقيق." />
      <ul className="grid gap-4 lg:grid-cols-2">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-900">{u.full_name}</p>
                  <p className="text-sm text-muted" dir="ltr">
                    {u.phone} · سُجِّل {formatDate(u.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge tone={u.role === 'admin' ? 'success' : 'neutral'}>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Badge>
                  {!u.is_active ? <Badge tone="danger">معطّل</Badge> : null}
                </div>
              </div>
              <UserControls userId={u.id} role={u.role} isActive={u.is_active} isSelf={u.id === session.viewer.userId} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
