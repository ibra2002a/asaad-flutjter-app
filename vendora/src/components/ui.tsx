import Link from 'next/link';
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition focus-visible:outline-3 disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 shadow-sm shadow-brand-900/20',
  accent: 'bg-lime-400 text-brand-950 hover:bg-lime-500',
  secondary: 'border border-line bg-white text-brand-900 hover:border-brand-300 hover:bg-brand-50',
  ghost: 'text-brand-800 hover:bg-brand-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${extra}`.trim();
}

export function LinkButton({
  href,
  variant = 'primary',
  className = '',
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-semibold text-brand-600">{eyebrow}</p> : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-100 text-brand-800',
  lime: 'bg-lime-300 text-brand-950',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-800',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning';
  children: ReactNode;
}) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
      <div aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-lime-300 text-brand-900">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M6 7l1.5 12h9L18 7M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-brand-950">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-brand-950">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'min-h-11 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-200 aria-invalid:border-red-500 disabled:bg-slate-50';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-24 ${props.className ?? ''}`} />;
}

export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function formatDateAr(value: string | Date): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Baghdad',
  }).format(new Date(value));
}

export function formatDayAr(value: string | Date): string {
  return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeZone: 'Asia/Baghdad' }).format(new Date(value));
}
