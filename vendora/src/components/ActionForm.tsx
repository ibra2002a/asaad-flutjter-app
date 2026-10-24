'use client';

import { useActionState, type ReactNode } from 'react';
import { INITIAL_FORM_STATE, type FormState } from '@/lib/actions/types';
import { Alert } from './ui';

type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;

/**
 * Form bound to a server action that returns a result instead of redirecting.
 * Shows success or error inline; the page itself refreshes through revalidatePath.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className={className}>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {children}
    </form>
  );
}
