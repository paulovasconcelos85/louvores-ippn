-- Endurecimento do RLS (revisão de 07/11/2026).
--
-- Problemas corrigidos:
-- 1. pessoas: a política de leitura tinha "OR ativo = true", então qualquer conta
--    logada (inclusive uma recém-criada, sem igreja) lia a ficha completa de todos
--    os membros de todas as igrejas: saúde, endereço, nascimento, cadastro_token.
-- 2. usuarios_acesso: cada usuário podia alterar a própria linha, inclusive
--    igreja_id e pessoa_id, que as funções de permissão usam para decidir acesso.
-- 3. pessoas: cada usuário podia alterar qualquer coluna da própria ficha,
--    inclusive cargo.
-- 4. notas_pastorais, usuarios_tags e convites: pastor/presbítero de uma igreja
--    lia e alterava dados de todas as igrejas (can_manage_any_church).
-- 5. usuarios_tags era legível por visitantes não logados.
--
-- Tudo o que o app faz pelo navegador continua permitido; o resto passa pelas
-- rotas /api, que usam a service role e não são afetadas pelo RLS.

begin;

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

-- Pode gerenciar a pessoa: superadmin, ou pastor/presbítero/seminarista de
-- alguma igreja à qual a pessoa pertence.
create or replace function public.pode_gerenciar_pessoa(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.pessoas_igrejas pi
      where pi.pessoa_id = p_pessoa_id
        and public.can_manage_church(pi.igreja_id)
    );
$$;

-- Pode ver o registro de acesso: superadmin, ou liderança de uma igreja do usuário.
create or replace function public.pode_gerenciar_usuario_acesso(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.usuarios_acesso ua
      where ua.id = p_usuario_id
        and ua.igreja_id is not null
        and public.can_manage_church(ua.igreja_id)
    )
    or exists (
      select 1
      from public.usuarios_igrejas ui
      where ui.usuario_id = p_usuario_id
        and public.can_manage_church(ui.igreja_id)
    );
$$;

revoke execute on function public.pode_gerenciar_pessoa(uuid) from public, anon;
revoke execute on function public.pode_gerenciar_usuario_acesso(uuid) from public, anon;
grant execute on function public.pode_gerenciar_pessoa(uuid) to authenticated, service_role;
grant execute on function public.pode_gerenciar_usuario_acesso(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pessoas
-- ---------------------------------------------------------------------------

drop policy if exists pessoas_select_self_or_admin on public.pessoas;
create policy pessoas_select_self_or_admin on public.pessoas
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or id = public.current_person_id()
    or public.pode_gerenciar_pessoa(id)
    or public.usuario_tem_acesso_pessoa(id)
  );

-- Pelo navegador só saem colunas de identificação; a ficha completa vem da API.
revoke all on public.pessoas from anon;
revoke select, update on public.pessoas from authenticated;
grant select (id, nome, apelido, email, telefone, foto_url, cargo, ativo, usuario_id)
  on public.pessoas to authenticated;
-- A tela de perfil edita só nome e telefone.
grant update (nome, telefone, atualizado_em) on public.pessoas to authenticated;

-- ---------------------------------------------------------------------------
-- usuarios_acesso (o navegador só lê; as escritas vêm da API)
-- ---------------------------------------------------------------------------

drop policy if exists usuarios_acesso_select_self_or_admin on public.usuarios_acesso;
drop policy if exists usuarios_acesso_update_self_or_admin on public.usuarios_acesso;
drop policy if exists usuarios_acesso_insert_admin on public.usuarios_acesso;
drop policy if exists usuarios_acesso_delete_admin on public.usuarios_acesso;

create policy usuarios_acesso_select_self_or_admin on public.usuarios_acesso
  for select to authenticated
  using (auth_user_id = auth.uid() or public.pode_gerenciar_usuario_acesso(id));

create policy usuarios_acesso_insert_admin on public.usuarios_acesso
  for insert to authenticated
  with check (public.is_global_admin());

create policy usuarios_acesso_update_admin on public.usuarios_acesso
  for update to authenticated
  using (public.is_global_admin())
  with check (public.is_global_admin());

create policy usuarios_acesso_delete_admin on public.usuarios_acesso
  for delete to authenticated
  using (public.is_global_admin());

-- ---------------------------------------------------------------------------
-- usuarios_tags (38 linhas têm igreja_id nulo; por isso a checagem também
-- olha a igreja da pessoa)
-- ---------------------------------------------------------------------------

drop policy if exists "Admins podem remover tags" on public.usuarios_tags;
drop policy if exists "Admins podem adicionar tags" on public.usuarios_tags;
drop policy if exists "Admins podem atualizar tags" on public.usuarios_tags;
drop policy if exists "Usuários autenticados podem ver tags" on public.usuarios_tags;
drop policy if exists usuarios_tags_select_all on public.usuarios_tags;
drop policy if exists usuarios_tags_select_self_or_admin on public.usuarios_tags;
drop policy if exists usuarios_tags_insert_admin on public.usuarios_tags;
drop policy if exists usuarios_tags_update_admin on public.usuarios_tags;
drop policy if exists usuarios_tags_delete_admin on public.usuarios_tags;

create policy usuarios_tags_select_self_or_admin on public.usuarios_tags
  for select to authenticated
  using (
    usuario_id = public.current_access_user_id()
    or pessoa_id = public.current_person_id()
    or public.can_manage_church(igreja_id)
    or public.pode_gerenciar_pessoa(pessoa_id)
    or public.usuario_tem_acesso_pessoa(pessoa_id)
  );

create policy usuarios_tags_insert_admin on public.usuarios_tags
  for insert to authenticated
  with check (public.can_manage_church(igreja_id) or public.pode_gerenciar_pessoa(pessoa_id));

create policy usuarios_tags_update_admin on public.usuarios_tags
  for update to authenticated
  using (public.can_manage_church(igreja_id) or public.pode_gerenciar_pessoa(pessoa_id))
  with check (public.can_manage_church(igreja_id) or public.pode_gerenciar_pessoa(pessoa_id));

create policy usuarios_tags_delete_admin on public.usuarios_tags
  for delete to authenticated
  using (public.can_manage_church(igreja_id) or public.pode_gerenciar_pessoa(pessoa_id));

revoke all on public.usuarios_tags from anon;

-- ---------------------------------------------------------------------------
-- notas_pastorais (só a liderança da igreja do membro)
-- ---------------------------------------------------------------------------

drop policy if exists "Notas visíveis para liderança" on public.notas_pastorais;
drop policy if exists "Liderança pode criar notas" on public.notas_pastorais;
drop policy if exists "Autor pode editar suas notas" on public.notas_pastorais;
drop policy if exists "Admin e pastor podem deletar notas" on public.notas_pastorais;

create policy "Notas visíveis para liderança" on public.notas_pastorais
  for select to authenticated
  using (public.pode_gerenciar_pessoa(membro_id));

create policy "Liderança pode criar notas" on public.notas_pastorais
  for insert to authenticated
  with check (autor_id = public.current_person_id() and public.pode_gerenciar_pessoa(membro_id));

create policy "Autor pode editar suas notas" on public.notas_pastorais
  for update to authenticated
  using (autor_id = public.current_person_id() and public.pode_gerenciar_pessoa(membro_id))
  with check (autor_id = public.current_person_id() and public.pode_gerenciar_pessoa(membro_id));

create policy "Admin e pastor podem deletar notas" on public.notas_pastorais
  for delete to authenticated
  using (public.pode_gerenciar_pessoa(membro_id));

revoke all on public.notas_pastorais from anon;

-- ---------------------------------------------------------------------------
-- convites
-- ---------------------------------------------------------------------------

drop policy if exists "Admins podem gerenciar convites" on public.convites;
create policy "Admins podem gerenciar convites" on public.convites
  for all to authenticated
  using (public.is_global_admin() or public.can_manage_church(igreja_id))
  with check (public.is_global_admin() or public.can_manage_church(igreja_id));

revoke all on public.convites from anon;

commit;
