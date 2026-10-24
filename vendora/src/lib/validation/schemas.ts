import { z } from 'zod';
import { MAX_LINE_QUANTITY } from '@/lib/domain/cart';
import { MAX_RATE_BP } from '@/lib/domain/commission';

/** Iraqi phone numbers: digits, optional leading +, spaces removed before validation. */
export const phoneSchema = z
  .string({ message: 'أدخل رقم الهاتف' })
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, 'رقم الهاتف غير صحيح'));

const trimmed = (min: number, max: number, message: string) =>
  z.string({ message }).transform((v) => v.trim()).pipe(z.string().min(min, message).max(max, message));

export const uuidSchema = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'معرّف غير صالح');

export const emailSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email('البريد الإلكتروني غير صحيح'));

export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل')
  .max(72, 'كلمة المرور طويلة جدا');

export const registerSchema = z.object({
  role: z.enum(['buyer', 'supplier'], { message: 'اختر نوع الحساب' }),
  fullName: trimmed(2, 120, 'الاسم الكامل يجب أن يكون بين حرفين و120 حرفا'),
  legalName: trimmed(2, 160, 'اسم المنشأة يجب أن يكون بين حرفين و160 حرفا'),
  cityCode: z.string().regex(/^[a-z]+(-[a-z]+)*$/, 'اختر المدينة'),
  phone: phoneSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: 'يجب الموافقة على الشروط' }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'أدخل كلمة المرور'),
});

export const addressSchema = z.object({
  label: trimmed(1, 40, 'اسم العنوان مطلوب'),
  cityCode: z.string().regex(/^[a-z]+(-[a-z]+)*$/, 'اختر المدينة'),
  district: trimmed(2, 80, 'اسم المنطقة مطلوب'),
  addressLine: trimmed(5, 300, 'أدخل تفاصيل العنوان (5 أحرف على الأقل)'),
  phone: phoneSchema,
  isDefault: z.boolean().default(false),
});

export const profileSchema = z.object({
  fullName: trimmed(2, 120, 'الاسم الكامل مطلوب'),
  phone: phoneSchema,
});

export const businessProfileSchema = z.object({
  legalName: trimmed(2, 160, 'اسم المنشأة مطلوب'),
  descriptionAr: z.string().max(2000, 'الوصف طويل جدا').optional().transform((v) => v?.trim() || null),
  taxNumber: z.string().max(40).optional().transform((v) => v?.trim() || null),
  cityCode: z.string().regex(/^[a-z]+(-[a-z]+)*$/, 'اختر المدينة'),
  streetAddress: z.string().max(300).optional().transform((v) => v?.trim() || null),
  phone: phoneSchema,
});

export const productUnits = ['piece', 'carton', 'pack', 'kg', 'liter', 'meter', 'bag', 'box', 'set'] as const;
export const productUnitLabelsAr: Record<(typeof productUnits)[number], string> = {
  piece: 'قطعة',
  carton: 'كرتون',
  pack: 'عبوة',
  kg: 'كيلوغرام',
  liter: 'لتر',
  meter: 'متر',
  bag: 'كيس',
  box: 'صندوق',
  set: 'طقم',
};

const optionalInt = (min: number, max: number, message: string) =>
  z
    .union([z.literal(''), z.undefined(), z.coerce.number().int(message).min(min, message).max(max, message)])
    .transform((v) => (v === '' || v === undefined ? null : v));

export const productSchema = z
  .object({
    categoryId: uuidSchema,
    nameAr: trimmed(2, 160, 'اسم المنتج يجب أن يكون بين حرفين و160 حرفا'),
    descriptionAr: z.string().max(4000, 'الوصف طويل جدا').optional().transform((v) => v?.trim() || null),
    unit: z.enum(productUnits, { message: 'اختر وحدة البيع' }),
    priceIqd: z.coerce
      .number({ message: 'أدخل السعر بالدينار العراقي' })
      .int('السعر يجب أن يكون عددا صحيحا من الدنانير')
      .min(1, 'السعر يجب أن يكون أكبر من صفر')
      .max(1_000_000_000, 'السعر كبير جدا'),
    salePriceIqd: optionalInt(1, 1_000_000_000, 'سعر الخصم غير صحيح'),
    minOrderQty: z.coerce.number().int('أدخل رقما صحيحا').min(1, 'الحد الأدنى يجب أن يكون 1 على الأقل').max(1_000_000),
    maxOrderQty: optionalInt(1, 1_000_000, 'الحد الأعلى غير صحيح'),
    stockQty: z.coerce.number().int('أدخل رقما صحيحا').min(0, 'المخزون لا يمكن أن يكون سالبا').max(10_000_000),
    // Absent on edits of a live product: its status is left as moderated by an admin.
    status: z.enum(['draft', 'pending_review', 'archived'], { message: 'حالة غير صالحة' }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.salePriceIqd !== null && value.salePriceIqd >= value.priceIqd) {
      ctx.addIssue({ code: 'custom', path: ['salePriceIqd'], message: 'سعر الخصم يجب أن يكون أقل من السعر الأصلي' });
    }
    if (value.maxOrderQty !== null && value.maxOrderQty < value.minOrderQty) {
      ctx.addIssue({ code: 'custom', path: ['maxOrderQty'], message: 'الحد الأعلى يجب أن يكون أكبر من الأدنى' });
    }
  });

export const cartQuantitySchema = z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY);

export const disputeSchema = z
  .object({
    orderId: uuidSchema,
    kind: z.enum(['return', 'quality', 'other'], { message: 'اختر نوع النزاع' }),
    orderItemId: z.string().optional(),
    requestedQuantity: z.coerce.number().int().min(1).optional(),
    reason: trimmed(5, 1000, 'اكتب سببا واضحا (5 أحرف على الأقل)'),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'return' && (!value.orderItemId || !value.requestedQuantity)) {
      ctx.addIssue({ code: 'custom', path: ['orderItemId'], message: 'حدد المنتج والكمية المراد إرجاعها' });
    }
  });

/** Admins type a percentage (e.g. 4 or 3.5); it is stored as integer basis points. */
export const commissionPercentSchema = z
  .string()
  .transform((v) => Number(v.trim()))
  .pipe(
    z
      .number({ message: 'أدخل نسبة صحيحة' })
      .min(0, 'النسبة لا يمكن أن تكون سالبة')
      .max(MAX_RATE_BP / 100, 'أعلى نسبة مسموحة 30%'),
  )
  .transform((percent) => Math.round(percent * 100));
