-- =============================================================================
-- VENDORA · 0700 · Product image storage (Supabase Storage only)
-- Files live under <supplier_business_id>/<product_id>/<file>. Public read so
-- product photos can be shown on the storefront; only the owning supplier can
-- write, enforced by the first path segment.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('product-images', 'product-images', true, 3145728,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists "product_images_public_read" on storage.objects;
    create policy "product_images_public_read" on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'product-images');

    drop policy if exists "product_images_owner_insert" on storage.objects;
    create policy "product_images_owner_insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = public.my_business_id()::text
      );

    drop policy if exists "product_images_owner_delete" on storage.objects;
    create policy "product_images_owner_delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = public.my_business_id()::text
      );
  end if;
end;
$$;
