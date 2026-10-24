import { z } from 'zod';
import { PAYMENT_METHODS, STOCK_STATUSES, ROLES } from '@/lib/types';

/** Iraqi and international phone numbers: optional +, 8 to 15 digits. Spaces and dashes are removed first. */
export const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

const phone = z
  .string({ error: 'أدخل رقم الهاتف' })
  .transform(normalizePhone)
  .pipe(z.string().regex(PHONE_REGEX, 'رقم الهاتف غير صحيح'));

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} مطلوب` })
    .trim()
    .min(min, `${label} قصير جداً`)
    .max(max, `${label} طويل جداً`);

/** Optional text: missing, empty or whitespace-only input becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} طويل جداً`)
    .nullish()
    .transform((v) => (v ? v : null));

/** Trims and lower-cases before format checks, so pasted addresses with spaces still pass. */
const emailField = z
  .string({ error: 'البريد الإلكتروني مطلوب' })
  .trim()
  .toLowerCase()
  .pipe(z.email('البريد الإلكتروني غير صحيح'));

const uuid = z.string().regex(UUID_REGEX, 'معرّف غير صالح');
const cityCode = z.string().regex(/^[a-z_]{2,30}$/, 'المحافظة غير صالحة');

export const passwordSchema = z
  .string({ error: 'كلمة المرور مطلوبة' })
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .max(72, 'كلمة المرور طويلة جداً');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(72),
});

export const registerSchema = z
  .object({
    role: z.enum(['buyer', 'supplier'], { error: 'اختر نوع الحساب' }),
    fullName: text(2, 120, 'الاسم'),
    email: emailField,
    password: passwordSchema,
    phone,
    businessName: text(2, 150, 'اسم النشاط التجاري'),
    cityCode,
    businessAddress: optionalText(300, 'العنوان'),
  })
  .strict();

export const businessProfileSchema = z.object({
  name: text(2, 150, 'اسم النشاط التجاري'),
  description: optionalText(1000, 'الوصف'),
  cityCode,
  address: optionalText(300, 'العنوان'),
  phone,
});

export const profileSchema = z.object({
  fullName: text(2, 120, 'الاسم'),
  phone,
});

export const addressSchema = z.object({
  label: text(1, 60, 'اسم العنوان'),
  cityCode,
  addressLine: text(5, 300, 'العنوان التفصيلي'),
  landmark: optionalText(200, 'أقرب معلم'),
});

export const productSchema = z
  .object({
    name: text(2, 150, 'اسم المنتج'),
    description: optionalText(2000, 'الوصف'),
    categoryId: uuid,
    unit: text(1, 40, 'الوحدة'),
    priceIqd: z.coerce
      .number({ error: 'السعر مطلوب' })
      .int('السعر يجب أن يكون رقماً صحيحاً بالدينار')
      .min(1, 'السعر يجب أن يكون أكبر من صفر')
      .max(100_000_000, 'السعر مرتفع جداً'),
    minQuantity: z.coerce
      .number({ error: 'الحد الأدنى للكمية مطلوب' })
      .int('الكمية يجب أن تكون رقماً صحيحاً')
      .min(1, 'الحد الأدنى للكمية يجب أن يكون 1 على الأقل')
      .max(100_000, 'الحد الأدنى للكمية مرتفع جداً'),
    stockStatus: z.enum(STOCK_STATUSES, { error: 'حالة المخزون غير صالحة' }),
    isPublished: z.boolean(),
  })
  .strict();

export const cartItemSchema = z.object({
  productId: uuid,
  quantity: z.number().int().min(1).max(100_000),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'السلة فارغة').max(50, 'عدد المنتجات في الطلب كبير جداً'),
  addressId: uuid,
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'اختر طريقة الدفع' }),
  contactPhone: phone,
  buyerNotes: optionalText(1000, 'الملاحظات'),
  idempotencyKey: z.string().min(8).max(100),
});

export const statusChangeSchema = z.object({
  orderId: uuid,
  toStatus: z.enum(['accepted', 'preparing', 'out_for_delivery', 'delivered', 'completed', 'cancelled']),
  note: z.string().trim().max(1000).optional(),
});

export const disputeSchema = z.object({
  orderId: uuid,
  reason: text(10, 1000, 'سبب النزاع'),
});

export const resolveDisputeSchema = z.object({
  disputeId: uuid,
  outcome: z.enum(['completed', 'cancelled']),
  note: text(3, 1000, 'ملاحظة القرار'),
});

export const businessStatusSchema = z.object({
  businessId: uuid,
  status: z.enum(['approved', 'rejected', 'suspended', 'pending']),
  note: z.string().trim().max(1000),
});

export const userRoleSchema = z.object({
  userId: uuid,
  role: z.enum(['buyer', 'ops', 'admin']),
  note: text(3, 1000, 'سبب التغيير'),
});

export const commissionRuleSchema = z.object({
  name: text(2, 100, 'اسم القاعدة'),
  ratePercent: z.coerce.number({ error: 'النسبة مطلوبة' }).min(0, 'النسبة لا يمكن أن تكون سالبة').max(30, 'النسبة القصوى 30%'),
  disputeWindowHours: z.coerce.number().int().min(0).max(720),
  deliveryFeeCommissionable: z.boolean(),
  activate: z.boolean(),
  note: optionalText(1000, 'الملاحظة'),
});

export const markPaidSchema = z.object({
  commissionIds: z.array(uuid).min(1, 'اختر عمولة واحدة على الأقل').max(500),
  reference: text(3, 100, 'المرجع'),
});

export const categorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, 'المعرّف الإنجليزي: أحرف صغيرة وأرقام وشرطات فقط'),
  nameAr: text(2, 100, 'اسم الفئة'),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export const coverageSchema = z.object({ cityCode });

export const adminSearchSchema = z.object({ role: z.enum(ROLES).optional() });

/** Collects zod issues into a { fieldName: message } map for the form. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_form');
    out[key] ??= issue.message;
  }
  return out;
}
