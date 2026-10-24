/**
 * Maps database error codes (raised as `ERR_*` by SECURITY DEFINER functions) and
 * Supabase/PostgREST errors to Arabic messages. Unknown errors never leak raw text.
 */
const MESSAGES: Record<string, string> = {
  ERR_UNAUTHENTICATED: 'يجب تسجيل الدخول أولاً.',
  ERR_FORBIDDEN: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  ERR_NOT_FOUND: 'العنصر المطلوب غير موجود أو لا يمكنك الوصول إليه.',
  ERR_INVALID_INPUT: 'البيانات المدخلة غير صالحة.',
  ERR_INVALID_ITEMS: 'عناصر الطلب غير صالحة. راجع السلة وأعد المحاولة.',
  ERR_INVALID_PAYMENT_METHOD: 'طريقة الدفع غير صالحة.',
  ERR_INVALID_PHONE: 'رقم الهاتف غير صحيح.',
  ERR_BUSINESS_NOT_APPROVED: 'حساب النشاط التجاري غير معتمد بعد.',
  ERR_ADDRESS_NOT_FOUND: 'عنوان التوصيل غير موجود.',
  ERR_PRODUCT_UNAVAILABLE: 'أحد المنتجات لم يعد متاحاً للطلب.',
  ERR_SUPPLIER_NOT_APPROVED: 'المورد غير معتمد حالياً ولا يستقبل طلبات.',
  ERR_OUT_OF_STOCK: 'أحد المنتجات غير متوفر حالياً.',
  ERR_MIN_QUANTITY: 'الكمية أقل من الحد الأدنى للطلب لأحد المنتجات.',
  ERR_NOT_COVERED: 'المورد لا يوصّل إلى مدينة العنوان المختار.',
  ERR_MULTIPLE_SUPPLIERS: 'كل طلب يجب أن يحتوي على منتجات من مورد واحد فقط.',
  ERR_INVALID_TRANSITION: 'لا يمكن تغيير حالة الطلب إلى هذه الحالة الآن.',
  ERR_USE_DISPUTE_FLOW: 'لفتح نزاع استخدم زر "فتح نزاع".',
  ERR_NOTE_REQUIRED: 'هذا الإجراء يتطلب ملاحظة توضيحية.',
  ERR_DISPUTE_EXISTS: 'يوجد نزاع مفتوح على هذا الطلب بالفعل.',
  ERR_DISPUTE_NOT_OPEN: 'هذا النزاع مغلق بالفعل.',
  ERR_DISPUTE_WINDOW_CLOSED: 'انتهت مدة فتح النزاع لهذا الطلب.',
  ERR_INVALID_STATUS: 'الحالة المطلوبة غير صالحة.',
  ERR_SELF_CHANGE: 'لا يمكنك تنفيذ هذا الإجراء على حسابك.',
  ERR_INVALID_ROLE: 'الدور المطلوب غير مسموح.',
  ERR_SUPPLIER_ROLE_LOCKED: 'لا يمكن تغيير دور حساب مورد من هنا. يتطلب مراجعة يدوية.',
  ERR_NO_ACTIVE_COMMISSION_RULE: 'لا توجد قاعدة عمولة نشطة. أضف قاعدة من صفحة العمولات.',
  ERR_IMAGE_LIMIT: 'الحد الأقصى 5 صور لكل منتج.',
  ERR_RATE_LIMITED: 'محاولات كثيرة. حاول لاحقاً.',
};

const GENERIC = 'حدث خطأ غير متوقع. حاول مرة أخرى.';

export function messageForDbError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return GENERIC;
  const raw = error.message ?? '';
  const code = raw.match(/ERR_[A-Z_]+/)?.[0];
  if (code && MESSAGES[code]) return MESSAGES[code] ?? GENERIC;
  if (/row-level security|permission denied/i.test(raw)) return MESSAGES.ERR_FORBIDDEN ?? GENERIC;
  if (error.code === '23505') return 'هذا السجل موجود مسبقاً.';
  return GENERIC;
}
