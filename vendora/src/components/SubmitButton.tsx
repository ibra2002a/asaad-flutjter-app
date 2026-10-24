'use client';

import { useFormStatus } from 'react-dom';
import { buttonClass } from './ui';

export function SubmitButton({
  children,
  pendingLabel = 'جاري التنفيذ…',
  variant = 'primary',
  className = '',
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  /** Lets one form expose several submit buttons; the clicked button's value is posted. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-disabled={pending} className={buttonClass(variant, className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
