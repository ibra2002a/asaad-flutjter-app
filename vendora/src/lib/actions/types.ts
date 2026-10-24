import type { ZodError } from 'zod';

/** Shape returned to forms that use useActionState. */
export interface FormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
}

export const INITIAL_FORM_STATE: FormState = {};

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Only same-site relative paths may be used after login, which blocks open redirects. */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (lower.includes('email not confirmed')) return 'يرجى تفعيل بريدك الإلكتروني أولا من الرسالة المرسلة إليك.';
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'هذا البريد الإلكتروني مسجل بالفعل. سجّل الدخول بدلا من ذلك.';
  }
  if (lower.includes('password')) return 'كلمة المرور لا تستوفي المتطلبات.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'محاولات كثيرة. انتظر دقائق ثم حاول مجددا.';
  if (lower.includes('invalid_role')) return 'نوع الحساب غير مسموح.';
  return 'تعذر إكمال الطلب. حاول مرة أخرى لاحقا.';
}
