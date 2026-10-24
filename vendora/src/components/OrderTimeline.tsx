import { ORDER_STATUS_LABEL_AR, ORDER_TIMELINE, timelineIndex, type OrderStatus } from '@/lib/domain/order-status';
import { formatDateAr } from './ui';

export interface TimelineEvent {
  to_status: OrderStatus;
  created_at: string;
  actor_role: string;
  reason: string | null;
}

const ACTOR_AR: Record<string, string> = {
  buyer: 'المشتري',
  supplier: 'المورد',
  admin: 'الإدارة',
  system: 'النظام',
};

/** Progress tracker for the happy path, plus the terminal states when they apply. */
export function OrderTimeline({ status, events }: { status: OrderStatus; events: TimelineEvent[] }) {
  const current = timelineIndex(status);
  const terminal = status === 'cancelled' || status === 'disputed';

  return (
    <div className="space-y-6">
      {terminal ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          الحالة الحالية: {ORDER_STATUS_LABEL_AR[status]}
        </p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-6" aria-label="مراحل الطلب">
          {ORDER_TIMELINE.map((step, index) => {
            const done = current >= index;
            const active = current === index;
            return (
              <li key={step} className="flex items-center gap-3 sm:flex-col sm:text-center">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'
                  } ${active ? 'ring-4 ring-lime-300' : ''}`}
                >
                  {index + 1}
                </span>
                <span className={`text-sm font-semibold ${done ? 'text-brand-950' : 'text-slate-500'}`}>
                  {ORDER_STATUS_LABEL_AR[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {events.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-bold text-brand-950">سجل الطلب</h3>
          <ol className="space-y-3 border-s-2 border-brand-100 ps-5">
            {events.map((event, index) => (
              <li key={`${event.created_at}-${index}`} className="relative">
                <span className="absolute -start-[1.72rem] top-1.5 size-3 rounded-full bg-brand-600" aria-hidden="true" />
                <p className="font-semibold text-brand-950">{ORDER_STATUS_LABEL_AR[event.to_status]}</p>
                <p className="text-xs text-muted">
                  {formatDateAr(event.created_at)} · بواسطة {ACTOR_AR[event.actor_role] ?? event.actor_role}
                </p>
                {event.reason ? <p className="mt-1 text-sm text-slate-700">السبب: {event.reason}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
