import type { HTMLAttributes, ReactNode } from 'react';
import { ORDER_STATUS_TONES } from '@/lib/orders/rules';
import type { OrderStatus } from '@/lib/types';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 ${className}`} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">{title}</h1>
        {description ? <p className="text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-50 text-sky-800',
  success: 'bg-lime-100 text-brand-900',
  warning: 'bg-amber-50 text-warning',
  danger: 'bg-red-50 text-danger',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONE_CLASSES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{label}</Badge>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error' | 'warning'; children: ReactNode }) {
  const classes = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-lime-400 bg-lime-100 text-brand-900',
    error: 'border-red-200 bg-red-50 text-danger',
    warning: 'border-amber-200 bg-amber-50 text-warning',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-brand-50/50 p-10 text-center">
      <p className="text-lg font-semibold text-brand-900">{title}</p>
      {description ? <p className="mt-2 text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-900 tabular">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
