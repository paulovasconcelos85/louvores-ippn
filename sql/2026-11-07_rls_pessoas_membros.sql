-- Membro comum não vê o cadastro dos outros membros.
--
-- Depois de 2026-11-07_rls_endurecimento.sql, qualquer membro com acesso via
-- nome, e-mail e telefone de todos da própria igreja. Agora:
-- - cada um vê a si mesmo;
-- - a liderança (pastor, presbítero, seminarista, superadmin) vê a igreja;
-- - quem está numa escala publicada da igreja aparece para os membros, porque a
--   página /escala/[id] mostra quem vai servir. Rascunhos só para quem monta
--   escalas.

begin;

create or replace function public.pessoa_visivel_em_escala(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.escalas_funcoes ef
    join public.escalas e on e.id = ef.escala_id
    where ef.pessoa_id = p_pessoa_id
      and (e.status = 'publicada' or public.tem_acesso_louvor())
      and public.usuario_tem_acesso_igreja(e.igreja_id)
  );
$$;

revoke execute on function public.pessoa_visivel_em_escala(uuid) from public, anon;
grant execute on function public.pessoa_visivel_em_escala(uuid) to authenticated, service_role;

drop policy if exists pessoas_select_self_or_admin on public.pessoas;
create policy pessoas_select_self_or_admin on public.pessoas
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or id = public.current_person_id()
    or public.pode_gerenciar_pessoa(id)
    or public.pessoa_visivel_em_escala(id)
  );

-- Funções (tags) de outros membros: só a própria e a liderança.
drop policy if exists usuarios_tags_select_self_or_admin on public.usuarios_tags;
create policy usuarios_tags_select_self_or_admin on public.usuarios_tags
  for select to authenticated
  using (
    usuario_id = public.current_access_user_id()
    or pessoa_id = public.current_person_id()
    or public.can_manage_church(igreja_id)
    or public.pode_gerenciar_pessoa(pessoa_id)
  );

commit;
