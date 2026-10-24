import { Alert } from './ui';

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <Alert tone="error">{error}</Alert>;
  if (success) return <Alert tone="success">{success}</Alert>;
  return null;
}

/** Shows a one-off message passed back through the ?notice= or ?error= query parameters. */
const NOTICES: Record<string, string> = {
  saved: 'تم حفظ التغييرات.',
  created: 'تم إنشاء المنتج وإرساله للمراجعة.',
  status: 'تم تحديث حالة المنتج.',
  updated: 'تم تحديث حالة الطلب.',
  placed: 'تم تأكيد طلبك بنجاح. يمكنك متابعته من هنا.',
  cancelled: 'تم إلغاء الطلب.',
  completed: 'شكرا لتأكيد الاستلام. اكتمل الطلب.',
  settled: 'تم تسجيل التسوية.',
  resolved: 'تم حل النزاع وتحديث الطلب والعمولة.',
  'dispute-opened': 'تم فتح النزاع.',
};

export function QueryNotice({ notice, error }: { notice?: string; error?: string }) {
  if (error) return <Alert tone="error">{error}</Alert>;
  if (notice && NOTICES[notice]) return <Alert tone="success">{NOTICES[notice]}</Alert>;
  return null;
}
