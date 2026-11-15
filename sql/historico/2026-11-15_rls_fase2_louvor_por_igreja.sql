-- RLS fase 2: louvor, cultos, cânticos e escalas presos à igreja (15/11/2026).
--
-- Problemas corrigidos:
-- 1. tem_acesso_louvor() não recebia a igreja: líder de louvor (ou pastor,
--    presbítero, seminarista) de UMA igreja criava, editava e apagava cultos,
--    louvor_itens, escalas, escalas_funcoes e cânticos de TODAS as igrejas.
-- 2. escalas e escalas_funcoes: qualquer conta logada lia tudo (SELECT true).
-- 3. "Louvores IPPN" (cultos): qualquer conta logada lia os cultos de todas
--    as igrejas, inclusive os futuros.
-- 4. louvor_itens: legível por visitantes não logados (SELECT true para public).
--    O boletim público lê pelo servidor com a service role, então não depende
--    disso.
-- 5. canticos: legível por visitantes e editável por qualquer conta logada de
--    qualquer igreja.
-- 6. usuarios_tags: o membro comum não conseguia marcar as próprias funções no
--    /perfil. Agora consegue, exceto as de liderança (Líder de Louvor, Pastor,
--    Presbítero, Diácono, Pregação), que continuam só com o pastor/admin.
-- 7. escalas_funcoes: o músico podia alterar qualquer coluna da própria linha
--    (por exemplo, mover-se para outra escala). Agora só confirma presença.
--
-- Preenchimento: 889 louvor_itens, 45 escalas_funcoes e 38 usuarios_tags estavam
-- sem igreja_id. São preenchidos a partir da linha-mãe, e triggers passam a
-- preencher sozinhos (o navegador não precisa mandar igreja_id).
--
-- Observação: tags_funcoes é um catálogo compartilhado na prática (as tags
-- cadastradas pela IPPN são usadas por ICPB e ICPT), então a igreja do vínculo
-- é usuarios_tags.igreja_id, não tags_funcoes.igreja_id.
--
-- Fora do escopo (próximo passo): is_global_admin() trata superadmin de
-- QUALQUER igreja como admin de todas. As políticas novas não a usam.

begin;

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

-- Pertence à igreja: tem acesso pela igreja principal ou por usuarios_igrejas,
-- ou está vinculado como pessoa (pessoas_igrejas).
create or replace function public.eh_membro_igreja(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.usuario_tem_acesso_igreja(p_igreja_id)
    or exists (
      select 1
      from public.usuarios_acesso ua
      join public.pessoas_igrejas pi
        on pi.pessoa_id = ua.pessoa_id
       and pi.igreja_id = p_igreja_id
      where ua.auth_user_id = auth.uid()
        and coalesce(ua.ativo, true) = true
        and coalesce(pi.ativo, true) = true
    );
$$;

-- Pode mexer no louvor (cultos, liturgia, cânticos, escalas) DESTA igreja:
-- pastor/presbítero/seminarista/superadmin da igreja, ou quem tem a tag de
-- categoria louvor_lideranca vinculada a esta igreja.
create or replace function public.tem_acesso_louvor_igreja(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_igreja_id is not null and (
    public.can_manage_church(p_igreja_id)
    or public.pode_gerenciar_escalas(p_igreja_id)
    or exists (
      select 1
      from public.usuarios_acesso ua
      join public.usuarios_tags ut
        on (ut.usuario_id = ua.id or ut.pessoa_id = ua.pessoa_id)
       and ut.igreja_id = p_igreja_id
      join public.tags_funcoes tf
        on tf.id = ut.tag_id
       and tf.categoria = 'louvor_lideranca'
       and coalesce(tf.ativo, true) = true
      where ua.auth_user_id = auth.uid()
        and coalesce(ua.ativo, true) = true
        and public.eh_membro_igreja(p_igreja_id)
    )
  );
$$;

-- Tags que o próprio membro pode marcar/desmarcar no /perfil.
create or replace function public.tag_autoatribuivel(p_tag_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.tags_funcoes tf
    where tf.id = p_tag_id
      and coalesce(tf.ativo, true) = true
      and tf.categoria not in (
        'louvor_lideranca',
        'lideranca',
        'lideranca_pastor',
        'lideranca_presbitero',
        'lideranca_diacono'
      )
  );
$$;

revoke execute on function public.eh_membro_igreja(uuid) from public, anon;
revoke execute on function public.tem_acesso_louvor_igreja(uuid) from public, anon;
revoke execute on function public.tag_autoatribuivel(uuid) from public, anon;
grant execute on function public.eh_membro_igreja(uuid) to authenticated;
grant execute on function public.tem_acesso_louvor_igreja(uuid) to authenticated;
grant execute on function public.tag_autoatribuivel(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: igreja_id sempre vem da linha-mãe
-- ---------------------------------------------------------------------------

create or replace function public.trg_louvor_itens_igreja()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  select c.igreja_id into new.igreja_id
  from public."Louvores IPPN" c
  where c."Culto nr." = new.culto_id;
  return new;
end;
$$;

drop trigger if exists louvor_itens_igreja on public.louvor_itens;
create trigger louvor_itens_igreja
  before insert or update of culto_id, igreja_id on public.louvor_itens
  for each row execute function public.trg_louvor_itens_igreja();

create or replace function public.trg_escalas_funcoes_igreja()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  select e.igreja_id into new.igreja_id
  from public.escalas e
  where e.id = new.escala_id;

  -- Quem não lidera o louvor da igreja (o músico confirmando a própria
  -- presença) só pode mudar confirmado, status e observacoes.
  if tg_op = 'UPDATE'
     and not public.tem_acesso_louvor_igreja(old.igreja_id)
     and auth.uid() is not null
     and (new.escala_id is distinct from old.escala_id
          or new.pessoa_id is distinct from old.pessoa_id
          or new.tag_id is distinct from old.tag_id
          or new.ordem is distinct from old.ordem) then
    raise exception 'Sem permissão para alterar esta função da escala'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists escalas_funcoes_igreja on public.escalas_funcoes;
create trigger escalas_funcoes_igreja
  before insert or update on public.escalas_funcoes
  for each row execute function public.trg_escalas_funcoes_igreja();

-- usuarios_tags: se o navegador não mandar igreja_id, usa a igreja da pessoa.
create or replace function public.trg_usuarios_tags_igreja()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.igreja_id is null then
    select pi.igreja_id into new.igreja_id
    from public.pessoas_igrejas pi
    where pi.pessoa_id = new.pessoa_id
      and coalesce(pi.ativo, true) = true
    order by pi.igreja_id
    limit 1;
  end if;

  if new.igreja_id is null then
    select ua.igreja_id into new.igreja_id
    from public.usuarios_acesso ua
    where ua.id = new.usuario_id
       or (new.pessoa_id is not null and ua.pessoa_id = new.pessoa_id)
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_tags_igreja on public.usuarios_tags;
create trigger usuarios_tags_igreja
  before insert or update of pessoa_id, usuario_id, igreja_id on public.usuarios_tags
  for each row execute function public.trg_usuarios_tags_igreja();

-- ---------------------------------------------------------------------------
-- Preenchimento do igreja_id que faltava
-- ---------------------------------------------------------------------------

update public.louvor_itens li
set igreja_id = c.igreja_id
from public."Louvores IPPN" c
where c."Culto nr." = li.culto_id
  and li.igreja_id is distinct from c.igreja_id;

update public.escalas_funcoes ef
set igreja_id = e.igreja_id
from public.escalas e
where e.id = ef.escala_id
  and ef.igreja_id is distinct from e.igreja_id;

-- O trigger preenche a partir da pessoa.
update public.usuarios_tags
set pessoa_id = pessoa_id
where igreja_id is null;

-- ---------------------------------------------------------------------------
-- "Louvores IPPN" (cultos)
-- ---------------------------------------------------------------------------

drop policy if exists "Logados veem todos os cultos" on public."Louvores IPPN";
drop policy if exists "Líderes podem criar cultos" on public."Louvores IPPN";
drop policy if exists "Líderes podem editar cultos" on public."Louvores IPPN";
drop policy if exists "Líderes podem deletar cultos" on public."Louvores IPPN";

create policy cultos_select_igreja on public."Louvores IPPN"
  for select to authenticated
  using (public.eh_membro_igreja(igreja_id));

create policy cultos_insert_louvor on public."Louvores IPPN"
  for insert to authenticated
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy cultos_update_louvor on public."Louvores IPPN"
  for update to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id))
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy cultos_delete_louvor on public."Louvores IPPN"
  for delete to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id));

-- ---------------------------------------------------------------------------
-- louvor_itens
-- ---------------------------------------------------------------------------

drop policy if exists public_select_louvor_itens on public.louvor_itens;
drop policy if exists louvor_itens_select on public.louvor_itens;
drop policy if exists "Líderes podem criar itens de liturgia" on public.louvor_itens;
drop policy if exists "Líderes podem editar itens de liturgia" on public.louvor_itens;
drop policy if exists "Líderes podem deletar itens de liturgia" on public.louvor_itens;

create policy louvor_itens_select_igreja on public.louvor_itens
  for select to authenticated
  using (public.eh_membro_igreja(igreja_id));

create policy louvor_itens_insert_louvor on public.louvor_itens
  for insert to authenticated
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy louvor_itens_update_louvor on public.louvor_itens
  for update to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id))
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy louvor_itens_delete_louvor on public.louvor_itens
  for delete to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id));

-- ---------------------------------------------------------------------------
-- canticos (os poucos sem igreja ficam só para leitura)
-- ---------------------------------------------------------------------------

drop policy if exists public_select_canticos on public.canticos;
drop policy if exists "Usuários autenticados podem criar cânticos" on public.canticos;
drop policy if exists "Usuários autenticados podem editar cânticos" on public.canticos;
drop policy if exists "Líderes podem deletar cânticos" on public.canticos;

create policy canticos_select_igreja on public.canticos
  for select to authenticated
  using (igreja_id is null or public.eh_membro_igreja(igreja_id));

create policy canticos_insert_igreja on public.canticos
  for insert to authenticated
  with check (public.usuario_tem_acesso_igreja(igreja_id));

create policy canticos_update_igreja on public.canticos
  for update to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id))
  with check (public.usuario_tem_acesso_igreja(igreja_id));

create policy canticos_delete_louvor on public.canticos
  for delete to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id));

-- ---------------------------------------------------------------------------
-- escalas
-- ---------------------------------------------------------------------------

drop policy if exists "Apenas logados veem escalas" on public.escalas;
drop policy if exists leaders_select_all_escalas on public.escalas;
drop policy if exists "Líderes podem criar escalas" on public.escalas;
drop policy if exists "Líderes podem editar escalas" on public.escalas;
drop policy if exists "Líderes podem deletar escalas" on public.escalas;
drop policy if exists escalas_select_membros on public.escalas;
drop policy if exists escalas_insert_admin on public.escalas;
drop policy if exists escalas_update_admin on public.escalas;
drop policy if exists escalas_delete_admin on public.escalas;

create policy escalas_select_igreja on public.escalas
  for select to authenticated
  using (public.eh_membro_igreja(igreja_id));

create policy escalas_insert_louvor on public.escalas
  for insert to authenticated
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy escalas_update_louvor on public.escalas
  for update to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id))
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy escalas_delete_louvor on public.escalas
  for delete to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id));

-- ---------------------------------------------------------------------------
-- escalas_funcoes (igreja_id preenchido pelo trigger a partir da escala)
-- ---------------------------------------------------------------------------

drop policy if exists "Apenas logados veem escalas_funcoes" on public.escalas_funcoes;
drop policy if exists "Logados veem escalas_funcoes" on public.escalas_funcoes;
drop policy if exists "Líderes podem adicionar pessoas nas escalas" on public.escalas_funcoes;
drop policy if exists "Líderes podem remover pessoas das escalas" on public.escalas_funcoes;
drop policy if exists ef_select_membros on public.escalas_funcoes;
drop policy if exists ef_insert_admin on public.escalas_funcoes;
drop policy if exists ef_update_admin on public.escalas_funcoes;
drop policy if exists ef_delete_admin on public.escalas_funcoes;
drop policy if exists musico_confirma_presenca on public.escalas_funcoes;

create policy ef_select_igreja on public.escalas_funcoes
  for select to authenticated
  using (public.eh_membro_igreja(igreja_id));

create policy ef_insert_louvor on public.escalas_funcoes
  for insert to authenticated
  with check (public.tem_acesso_louvor_igreja(igreja_id));

create policy ef_update_louvor on public.escalas_funcoes
  for update to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id))
  with check (public.tem_acesso_louvor_igreja(igreja_id));

-- O músico confirma a própria presença (o trigger impede mudar o resto).
create policy ef_musico_confirma_presenca on public.escalas_funcoes
  for update to authenticated
  using (pessoa_id = public.current_person_id())
  with check (pessoa_id = public.current_person_id());

create policy ef_delete_louvor on public.escalas_funcoes
  for delete to authenticated
  using (public.tem_acesso_louvor_igreja(igreja_id));

-- ---------------------------------------------------------------------------
-- usuarios_tags: o membro marca as próprias funções no /perfil
-- ---------------------------------------------------------------------------

drop policy if exists usuarios_tags_insert_self on public.usuarios_tags;
drop policy if exists usuarios_tags_delete_self on public.usuarios_tags;

create policy usuarios_tags_insert_self on public.usuarios_tags
  for insert to authenticated
  with check (
    pessoa_id = public.current_person_id()
    and public.eh_membro_igreja(igreja_id)
    and public.tag_autoatribuivel(tag_id)
  );

create policy usuarios_tags_delete_self on public.usuarios_tags
  for delete to authenticated
  using (
    pessoa_id = public.current_person_id()
    and public.tag_autoatribuivel(tag_id)
  );

-- tags_funcoes tinha duas políticas de leitura iguais.
drop policy if exists "Usuarios logados podem ver tags" on public.tags_funcoes;

commit;
