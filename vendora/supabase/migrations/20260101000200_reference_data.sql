-- =============================================================================
-- VENDORA · 0200 · Reference data (not demo data — safe for production)
-- =============================================================================

insert into public.cities (code, name_ar) values
  ('baghdad', 'بغداد'),
  ('basra', 'البصرة'),
  ('erbil', 'أربيل'),
  ('najaf', 'النجف'),
  ('karbala', 'كربلاء'),
  ('mosul', 'الموصل'),
  ('sulaymaniyah', 'السليمانية'),
  ('kirkuk', 'كركوك');

insert into public.categories (slug, name_ar, description_ar, sort_order) values
  ('food-beverages', 'المواد الغذائية والمشروبات', 'مواد غذائية ومشروبات بالجملة', 10),
  ('cleaning', 'مواد التنظيف', 'منظفات ومستلزمات تنظيف للمحلات والمنازل', 20),
  ('personal-care', 'العناية الشخصية', 'منتجات العناية بالبشرة والشعر', 30),
  ('electronics', 'الإلكترونيات والأجهزة', 'أجهزة وملحقات إلكترونية', 40),
  ('building-materials', 'مواد البناء', 'مواد بناء وأدوات إنشائية', 50),
  ('clothing', 'الملابس والأقمشة', 'ملابس وأقمشة بالجملة', 60),
  ('stationery', 'القرطاسية والمستلزمات المكتبية', 'قرطاسية ولوازم مكتبية', 70),
  ('kitchenware', 'أدوات المطبخ والمنزل', 'أدوات مطبخ ومستلزمات منزلية', 80);

-- Development default: 4% on every category/supplier until an admin sets a rule.
insert into public.commission_rules (scope, rate_bp, note)
values ('global', 400, 'القيمة الافتراضية للتطوير: 4%');
