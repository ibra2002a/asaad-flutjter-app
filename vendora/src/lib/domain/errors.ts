/**
 * Maps the stable error codes raised by the database (the text before the first
 * colon, e.g. "INSUFFICIENT_STOCK: x has 3") to Arabic messages for users.
 */
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'يجب تسجيل الدخول أولا.',
  FORBIDDEN: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  FORBIDDEN_ROLE: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  ACCOUNT_SUSPENDED: 'حسابك معلق حاليا. تواصل مع الدعم.',
  BUSINESS_NOT_APPROVED: 'حسابك التجاري بانتظار الموافقة قبل إتمام الطلبات.',
  ADDRESS_NOT_FOUND: 'عنوان التوصيل غير موجود. اختر عنوانا آخر.',
  INVALID_CART: 'السلة فارغة أو تحتوي على عدد كبير من المنتجات.',
  INVALID_CART_LINE: 'توجد بيانات غير صالحة في السلة. حدّث السلة وحاول مجددا.',
  DUPLICATE_PRODUCT_LINE: 'المنتج موجود أكثر من مرة في السلة.',
  PRODUCT_UNAVAILABLE: 'أحد المنتجات لم يعد متاحا للبيع.',
  QUANTITY_BELOW_MINIMUM: 'الكمية أقل من الحد الأدنى للطلب.',
  QUANTITY_ABOVE_MAXIMUM: 'الكمية أكبر من الحد الأعلى للطلب.',
  QUANTITY_INVALID: 'الكمية المطلوبة غير صحيحة.',
  INSUFFICIENT_STOCK: 'الكمية المطلوبة غير متوفرة في المخزون.',
  INVALID_IDEMPOTENCY_KEY: 'تعذر تأكيد الطلب. حدّث الصفحة وحاول مجددا.',
  ORDER_NOT_FOUND: 'الطلب غير موجود.',
  INVALID_TRANSITION: 'لا يمكن تغيير حالة الطلب إلى هذه الحالة.',
  REASON_REQUIRED: 'يرجى كتابة السبب.',
  DISPUTE_NOT_ALLOWED: 'لا يمكن فتح نزاع إلا بعد تسليم الطلب.',
  DISPUTE_NOT_OPEN: 'هذا النزاع مغلق بالفعل.',
  ITEM_NOT_FOUND: 'المنتج غير موجود ضمن هذا الطلب.',
  INVALID_REASON: 'يرجى كتابة سبب واضح للنزاع (5 أحرف على الأقل).',
  BUSINESS_NOT_FOUND: 'الحساب التجاري غير موجود.',
  PRODUCT_NOT_FOUND: 'المنتج غير موجود.',
  PRODUCT_STATUS_FORBIDDEN: 'لا يمكنك تغيير حالة المنتج إلى هذه الحالة.',
  PRODUCT_OWNER_IMMUTABLE: 'لا يمكن نقل المنتج إلى مورد آخر.',
  MODERATION_NOTE_FORBIDDEN: 'ملاحظات المراجعة للإدارة فقط.',
  PRODUCT_IMAGE_LIMIT: 'الحد الأقصى لصور المنتج ٨ صور.',
  PROFILE_NOT_FOUND: 'المستخدم غير موجود.',
  SELF_MODIFICATION_FORBIDDEN: 'لا يمكنك تعديل حسابك من هذه الصفحة.',
  INVALID_RATE: 'نسبة العمولة غير صالحة.',
  INVALID_RULE_TARGET: 'هدف قاعدة العمولة غير صحيح.',
  CATEGORY_NOT_FOUND: 'الفئة غير موجودة.',
  COMMISSION_NOT_SETTLEABLE: 'لا يمكن تسوية هذه العمولة.',
  DISPUTE_NOT_FOUND: 'النزاع غير موجود.',
  RESOLUTION_INVALID: 'نوع الحل لا يتناسب مع هذا النزاع.',
  INVALID_ROLE: 'نوع الحساب غير مسموح.',
};

export const GENERIC_ERROR_AR = 'حدث خطأ غير متوقع. حاول مرة أخرى لاحقا.';

export function errorCode(message: string | undefined | null): string | null {
  if (!message) return null;
  const head = message.split(':')[0]?.trim() ?? '';
  return /^[A-Z_]+$/.test(head) ? head : null;
}

export function userMessageFor(error: { message?: string } | null | undefined): string {
  const code = errorCode(error?.message);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return GENERIC_ERROR_AR;
}
