-- VENDORA: reference data required for the app to work (safe to run in production).
-- Demo/test users and products are NOT here; see scripts/seed-demo.mjs.

-- Iraqi governorates. Pilot launch is limited to Baghdad.
insert into public.cities (code, name_ar, is_pilot, sort_order) values
  ('baghdad',      'بغداد',         true,  1),
  ('basra',        'البصرة',        false, 2),
  ('nineveh',      'نينوى',         false, 3),
  ('erbil',        'أربيل',         false, 4),
  ('sulaymaniyah', 'السليمانية',    false, 5),
  ('duhok',        'دهوك',          false, 6),
  ('kirkuk',       'كركوك',         false, 7),
  ('anbar',        'الأنبار',       false, 8),
  ('babil',        'بابل',          false, 9),
  ('karbala',      'كربلاء',        false, 10),
  ('najaf',        'النجف',         false, 11),
  ('wasit',        'واسط',          false, 12),
  ('diyala',       'ديالى',         false, 13),
  ('salah_al_din', 'صلاح الدين',    false, 14),
  ('maysan',       'ميسان',         false, 15),
  ('dhi_qar',      'ذي قار',        false, 16),
  ('muthanna',     'المثنى',        false, 17),
  ('qadisiyah',    'القادسية',      false, 18)
on conflict (code) do nothing;

insert into public.categories (slug, name_ar, sort_order) values
  ('groceries',         'المواد الغذائية',         1),
  ('beverages',         'المشروبات',               2),
  ('fresh-produce',     'الخضار والفواكه',         3),
  ('dairy',             'الألبان والأجبان',        4),
  ('cleaning',          'المنظفات والمستلزمات',    5),
  ('packaging',         'التغليف والتعبئة',        6),
  ('restaurant-supplies', 'مستلزمات المطاعم',      7)
on conflict (slug) do nothing;

-- DEMO default commission: 4% (400 bps), 48-hour dispute window. Demo value only:
-- replace it from the admin commissions page before going live.
insert into public.commission_rules (name, rate_bps, dispute_window_hours, delivery_fee_commissionable, is_active, is_demo)
values ('القاعدة الافتراضية التجريبية (4%)', 400, 48, false, true, true)
on conflict do nothing;
