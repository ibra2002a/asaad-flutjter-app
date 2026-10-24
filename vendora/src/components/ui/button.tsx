'use client';

import { useFormStatus } from 'react-dom';
import type { ButtonHTMLAttributes } from 'react';
import { buttonClass, type ButtonVariant } from '@/components/ui/button-styles';

type SubmitProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pendingLabel?: string;
};

/** Submit button that disables itself while the enclosing form is submitting. */
export function SubmitButton({ variant = 'primary', pendingLabel = 'جارٍ الحفظ…', children, className, ...props }: SubmitProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, className)} {...props}>
      {pending ? pendingLabel : children}
    </button>
  );
}
