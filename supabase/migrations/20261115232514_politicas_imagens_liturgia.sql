-- Imagens de tema da liturgia (bucket liturgias_thumbnails) presas à igreja.
--
-- Antes:
-- - quem administrava QUALQUER igreja (can_manage_any_church) subia, trocava e
--   apagava imagens de cultos de todas as igrejas;
-- - o líder de louvor, que edita a liturgia, não conseguia subir a imagem;
-- - três políticas apontavam para 'liturgias-thumbnails' (com hífen), bucket
--   que não existe.
--
-- Agora a igreja vem do próprio nome do arquivo, que o app grava como
-- culto-<Culto nr.>-<timestamp>.<ext> (src/app/(sistema)/cultos/_lib/dados.ts).
-- Pode mexer quem tem tem_acesso_louvor_igreja() na igreja daquele culto.
-- O bucket é público: a leitura pela URL pública não depende destas políticas.

create or replace function public.igreja_da_imagem_liturgia(p_nome text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.igreja_id
  from public."Louvores IPPN" c
  where c."Culto nr." = nullif(substring(p_nome from '^culto-([0-9]{1,18})-'), '')::bigint;
$$;

revoke all on function public.igreja_da_imagem_liturgia(text) from public, anon, authenticated;
grant execute on function public.igreja_da_imagem_liturgia(text) to authenticated;

drop policy if exists "Permitir upload para autenticados" on storage.objects;
drop policy if exists "Permitir leitura pública" on storage.objects;
drop policy if exists "Permitir delete para autenticados" on storage.objects;
drop policy if exists "Allow authorized users for RUD 1uuagf2_0" on storage.objects;
drop policy if exists "Allow authorized users for RUD 1uuagf2_1" on storage.objects;
drop policy if exists "Allow authorized users for RUD 1uuagf2_2" on storage.objects;
drop policy if exists "Allow authorized users for RUD 1uuagf2_3" on storage.objects;

create policy liturgia_imagens_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'liturgias_thumbnails'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_liturgia(name))
  );

create policy liturgia_imagens_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'liturgias_thumbnails'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_liturgia(name))
  );

create policy liturgia_imagens_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'liturgias_thumbnails'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_liturgia(name))
  )
  with check (
    bucket_id = 'liturgias_thumbnails'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_liturgia(name))
  );

create policy liturgia_imagens_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'liturgias_thumbnails'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_liturgia(name))
  );
