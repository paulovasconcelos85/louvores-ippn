-- Imagens dos eventos da igreja, enviadas do computador ou do celular (antes só
-- dava para colar o link de uma foto hospedada em outro lugar).
--
-- Bucket público: eventos são públicos e mostram a imagem pela URL.
-- Caminho: <igreja_id>/<uuid>.<ext> (src/lib/enviar-imagem.ts).
-- Sobe e apaga quem gerencia os eventos daquela igreja: a mesma regra da API
-- (/api/eventos → podeGerenciarEventos em src/lib/permissions.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'eventos-imagens', 'eventos-imagens', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Espelha CARGOS_GERENCIAR_EVENTOS + tag de secretaria, mas presa à igreja
-- informada (o vínculo e a tag precisam ser daquela igreja).
create or replace function public.pode_gerenciar_eventos(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_igreja_id is not null and (
    public.is_global_admin()
    or exists (
      select 1
      from public.usuarios_acesso ua
      join public.usuarios_igrejas ui on ui.usuario_id = ua.id
      where ua.auth_user_id = auth.uid()
        and coalesce(ua.ativo, true) = true
        and ui.ativo = true
        and ui.igreja_id = p_igreja_id
        and ui.cargo = any (array[
          'presbitero'::cargo_tipo,
          'pastor'::cargo_tipo,
          'staff'::cargo_tipo,
          'admin'::cargo_tipo,
          'superadmin'::cargo_tipo
        ])
    )
    or exists (
      select 1
      from public.usuarios_acesso ua
      join public.usuarios_tags ut
        on (ut.usuario_id = ua.id or ut.pessoa_id = ua.pessoa_id)
       and ut.igreja_id = p_igreja_id
      join public.tags_funcoes tf
        on tf.id = ut.tag_id
       and tf.categoria = 'secretaria'
       and coalesce(tf.ativo, true) = true
      where ua.auth_user_id = auth.uid()
        and coalesce(ua.ativo, true) = true
        and public.eh_membro_igreja(p_igreja_id)
    )
  );
$$;

revoke all on function public.pode_gerenciar_eventos(uuid) from public, anon, authenticated;
grant execute on function public.pode_gerenciar_eventos(uuid) to authenticated;

-- igreja_da_imagem_boletim só lê o <igreja_id>/ do começo do caminho; serve aqui também.
create policy eventos_imagens_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'eventos-imagens'
    and public.pode_gerenciar_eventos(public.igreja_da_imagem_boletim(name))
  );

create policy eventos_imagens_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'eventos-imagens'
    and public.pode_gerenciar_eventos(public.igreja_da_imagem_boletim(name))
  );

create policy eventos_imagens_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'eventos-imagens'
    and public.pode_gerenciar_eventos(public.igreja_da_imagem_boletim(name))
  );
