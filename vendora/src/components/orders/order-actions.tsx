'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { openDisputeAction, resolveDisputeAction, transitionOrderAction } from '@/actions/orders';
import { SubmitButton } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Notice } from '@/components/ui/card';
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/field';
import { useAction } from '@/components/forms/use-action';
import { canOpenDispute, nextStatusesFor, TRANSITION_BUTTON_LABELS } from '@/lib/orders/rules';
import type { OrderStatus, Role } from '@/lib/types';

/**
 * Buttons for the status changes this role may make from the current status.
 * Showing a button is only a convenience: transition_order() enforces the same rules in the database.
 */
export function OrderStatusActions({ orderId, role, status }: { orderId: string; role: Role; status: OrderStatus }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const { run, pending } = useAction(transitionOrderAction);

  const targets = nextStatusesFor(role, status);
  if (targets.length === 0) return null;

  const isStaff = role === 'ops' || role === 'admin';

  function change(toStatus: OrderStatus) {
    setMessage(null);
    if (toStatus === 'cancelled') {
      if (!window.confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;
      if (isStaff && note.trim().length < 3) {
        setMessage('اكتب سبب الإلغاء (3 أحرف على الأقل).');
        return;
      }
    }
    run({ orderId, toStatus, note: note.trim() || undefined }, () => {
      setNote('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message ? <Notice tone="error">{message}</Notice> : null}
      <Field label="ملاحظة (اختيارية، وإلزامية عند إلغاء الإدارة للطلب)" name={`note-${orderId}`}>
        <TextArea name={`note-${orderId}`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        {targets.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => change(to)}
            className={buttonClass(
              to === 'cancelled' ? 'danger' : to === 'completed' || to === 'delivered' ? 'accent' : 'primary',
            )}
          >
            {pending ? 'جارٍ التحديث…' : TRANSITION_BUTTON_LABELS[to]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OpenDisputeForm({ orderId, role, status }: { orderId: string; role: Role; status: OrderStatus }) {
  const router = useRouter();
  const { run, pending, result } = useAction(openDisputeAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  if (!canOpenDispute(role, status)) return null;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run({ orderId, reason: String(form.get('reason') ?? '') }, () => router.refresh());
      }}
    >
      {result ? <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice> : null}
      <Field label="سبب النزاع" name="reason" error={errors.reason} hint="اشرح المشكلة بالتفصيل: الكمية، الجودة، التأخير…">
        <TextArea name="reason" rows={3} maxLength={1000} required error={errors.reason} />
      </Field>
      <SubmitButton variant="danger" pendingLabel="جارٍ فتح النزاع…" disabled={pending}>
        فتح نزاع على الطلب
      </SubmitButton>
    </form>
  );
}

export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const { run, pending, result } = useAction(resolveDisputeAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run(
          { disputeId, outcome: String(form.get('outcome') ?? ''), note: String(form.get('note') ?? '') },
          () => router.refresh(),
        );
      }}
    >
      {result ? <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice> : null}
      <Field label="القرار" name="outcome" error={errors.outcome}>
        <SelectInput name="outcome" defaultValue="completed" error={errors.outcome}>
          <option value="completed">إبقاء الطلب مكتملاً (العمولة مستحقة بعد النافذة)</option>
          <option value="cancelled">إلغاء الطلب (إلغاء العمولة، والاسترداد خارج المنصة)</option>
        </SelectInput>
      </Field>
      <Field label="ملاحظة القرار" name="note" error={errors.note}>
        <TextInput name="note" required minLength={3} maxLength={1000} error={errors.note} />
      </Field>
      <SubmitButton pendingLabel="جارٍ التسجيل…" disabled={pending}>
        تسجيل القرار
      </SubmitButton>
    </form>
  );
}
