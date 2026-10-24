-- VENDORA: product image storage.
-- Files live in the public bucket "product-images" under "<auth user id>/<random name>".
-- The bucket enforces size and MIME limits; policies allow writes only into the uploader's own
-- folder, and only for approved suppliers. Uploads are also content-checked by the app (magic bytes).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists product_images_owner_insert on storage.objects;
create policy product_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.active_uid()::text
    and public.app_role() = 'supplier'
    and public.is_approved_supplier(public.my_business_id())
  );

drop policy if exists product_images_owner_delete on storage.objects;
create policy product_images_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.active_uid()::text
    and public.app_role() = 'supplier'
  );
