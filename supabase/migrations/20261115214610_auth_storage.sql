-- Objetos fora do schema public, copiados da produção em 15/11/2026.
-- (O `supabase db pull` gerou só o public; esta parte foi lida do banco.)

-- auth.users: bloqueia cadastro de e-mail não permitido.
drop trigger if exists trigger_verificar_email on auth.users;
create trigger trigger_verificar_email
  before insert on auth.users
  for each row execute function public.verificar_email_permitido();

-- Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('Logos', 'Logos', true, null, null),
  ('liturgias_thumbnails', 'liturgias_thumbnails', true, null, null),
  ('financas-comprovantes', 'financas-comprovantes', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Políticas de storage.objects, como estão em produção.
-- Atenção: as três primeiras usam 'liturgias-thumbnails' (com hífen), bucket
-- que não existe, então não têm efeito.
create policy "Permitir upload para autenticados" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'liturgias-thumbnails');

create policy "Permitir leitura pública" on storage.objects
  for select to public
  using (bucket_id = 'liturgias-thumbnails');

create policy "Permitir delete para autenticados" on storage.objects
  for delete to authenticated
  using (bucket_id = 'liturgias-thumbnails');

create policy "Allow authorized users for RUD 1uuagf2_0" on storage.objects
  for select to authenticated
  using (bucket_id = 'liturgias_thumbnails' and public.can_manage_any_church());

create policy "Allow authorized users for RUD 1uuagf2_1" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'liturgias_thumbnails' and public.can_manage_any_church());

create policy "Allow authorized users for RUD 1uuagf2_2" on storage.objects
  for update to authenticated
  using (bucket_id = 'liturgias_thumbnails' and public.can_manage_any_church());

create policy "Allow authorized users for RUD 1uuagf2_3" on storage.objects
  for delete to authenticated
  using (bucket_id = 'liturgias_thumbnails' and public.can_manage_any_church());
