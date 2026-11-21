-- Imagens de notícias, avisos e informativos do boletim, enviadas do computador
-- ou do celular (antes só dava para colar o link de uma foto hospedada em outro lugar).
--
-- Bucket público: o boletim é público e mostra a imagem pela URL.
-- Caminho: <igreja_id>/<uuid>.<ext> (src/app/(sistema)/cultos/_lib/imagens-boletim.ts).
-- Sobe e apaga quem edita o boletim daquela igreja (tem_acesso_louvor_igreja),
-- a mesma regra das imagens de tema do culto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'boletim-imagens', 'boletim-imagens', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create or replace function public.igreja_da_imagem_boletim(p_nome text)
returns uuid
language sql
immutable
set search_path to 'public'
as $$
  select case
    when p_nome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then substring(p_nome from 1 for 36)::uuid
  end;
$$;

revoke all on function public.igreja_da_imagem_boletim(text) from public, anon, authenticated;
grant execute on function public.igreja_da_imagem_boletim(text) to authenticated;

create policy boletim_imagens_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'boletim-imagens'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_boletim(name))
  );

create policy boletim_imagens_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'boletim-imagens'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_boletim(name))
  );

create policy boletim_imagens_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'boletim-imagens'
    and public.tem_acesso_louvor_igreja(public.igreja_da_imagem_boletim(name))
  );
