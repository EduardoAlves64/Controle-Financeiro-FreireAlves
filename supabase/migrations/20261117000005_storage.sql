-- =====================================================================
-- FINANCE HUB — Storage (somente Supabase)
--   avatars/<user_id>/...           público para leitura, escrita só do dono
--   attachments/<household_id>/...  privado, só membros da família
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('attachments', 'attachments', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "attachments_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "attachments_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_household_member(((storage.foldername(name))[1])::uuid));
