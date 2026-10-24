'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from '@/lib/actions/auth';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { Alert, Field, Input, buttonClass } from '../ui';
import { SubmitButton } from '../SubmitButton';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, formAction] = useActionState(loginAction, INITIAL_FORM_STATE);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {notice ? <Alert tone="warning">{notice}</Alert> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="البريد الإلكتروني" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required aria-invalid={Boolean(state.fieldErrors?.email)} />
      </Field>
      <Field label="كلمة المرور" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required aria-invalid={Boolean(state.fieldErrors?.password)} />
      </Field>

      <SubmitButton className="w-full text-base">تسجيل الدخول</SubmitButton>

      <p className="text-center text-sm text-muted">
        ليس لديك حساب؟{' '}
        <Link href="/register" className={buttonClass('ghost', 'min-h-0 px-1 py-0 text-brand-700')}>
          أنشئ حسابا تجاريا
        </Link>
      </p>
    </form>
  );
}
