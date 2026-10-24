'use client';

import { useActionState, useState } from 'react';
import { openDisputeAction } from '@/lib/actions/buyer';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { Alert, Card, Field, Select, Textarea } from '../ui';
import { SubmitButton } from '../SubmitButton';

export interface DisputeItem {
  id: string;
  name: string;
  remaining: number;
}

export function DisputeForm({ orderId, items }: { orderId: string; items: DisputeItem[] }) {
  const [state, action] = useActionState(openDisputeAction, INITIAL_FORM_STATE);
  const [kind, setKind] = useState<'return' | 'quality' | 'other'>('return');
  const [itemId, setItemId] = useState(items.find((i) => i.remaining > 0)?.id ?? '');
  const selected = items.find((i) => i.id === itemId);
  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">فتح نزاع أو طلب إرجاع</h2>
      <p className="mt-1 text-sm text-muted">استخدم هذا النموذج إذا وصلت الكمية أو الجودة مختلفة عن الطلب. يراجع فريق VENDORA النزاع مع المورد.</p>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        {state.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        {state.success ? <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div> : null}

        <Field label="نوع المشكلة" htmlFor="dp-kind" error={errors.kind}>
          <Select id="dp-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="return">إرجاع كمية (تالف أو ناقص)</option>
            <option value="quality">جودة المنتج لا تطابق الوصف</option>
            <option value="other">مشكلة أخرى</option>
          </Select>
        </Field>

        {kind === 'return' ? (
          <>
            <Field label="المنتج" htmlFor="dp-item" error={errors.orderItemId}>
              <Select id="dp-item" name="orderItemId" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((item) => (
                  <option key={item.id} value={item.id} disabled={item.remaining < 1}>
                    {item.name}{item.remaining < 1 ? ' (تم إرجاعه)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الكمية" htmlFor="dp-qty" hint={selected ? `حتى ${selected.remaining}` : undefined} error={errors.requestedQuantity}>
              <input
                id="dp-qty"
                name="requestedQuantity"
                type="number"
                min={1}
                max={selected?.remaining ?? 1}
                defaultValue={1}
                className="min-h-11 w-full rounded-xl border border-line px-3.5 text-base"
              />
            </Field>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <Field label="وصف المشكلة" htmlFor="dp-reason" hint="اكتب التفاصيل بوضوح، بحد أدنى 5 أحرف." error={errors.reason}>
            <Textarea id="dp-reason" name="reason" required minLength={5} maxLength={1000} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton variant="danger" pendingLabel="جاري الإرسال…">فتح النزاع</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
