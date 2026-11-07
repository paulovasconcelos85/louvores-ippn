-- O cadastro público (/api/cadastro-publico) aceita qualquer e-mail, e o
-- trigger de pessoas_igrejas chama sincronizar_acesso_pessoa_por_email().
-- Na versão anterior, a busca por e-mail achava o usuarios_acesso de QUALQUER
-- pessoa com aquele e-mail e o atualizava: bastava alguém se cadastrar com o
-- e-mail de um pastor para religar o acesso dele a um cadastro falso, trocar
-- igreja/cargo e até desativá-lo.
--
-- Agora o acesso só é adotado por e-mail se ainda não estiver vinculado a
-- outra pessoa. Se o e-mail já pertence ao acesso de outra pessoa, o cadastro
-- novo fica sem acesso (a liderança resolve a duplicidade manualmente).
--
-- Igual a sql/2026-04-24_sincronizar_acesso_cadastro_publico.sql, exceto pelo
-- bloco "if v_usuario_acesso_id is null then ... where lower(trim(ua.email))".


create or replace function public.sincronizar_acesso_pessoa_por_email(p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa record;
  v_email text;
  v_usuario_acesso_id uuid;
  v_principal record;
  v_vinculo record;
begin
  select
    p.id,
    p.nome,
    p.email,
    p.telefone,
    p.cargo,
    p.ativo,
    p.usuario_id
  into v_pessoa
  from public.pessoas p
  where p.id = p_pessoa_id;

  if not found then
    return;
  end if;

  v_email := lower(trim(coalesce(v_pessoa.email, '')));

  if v_email = '' then
    return;
  end if;

  select
    pi.igreja_id,
    coalesce(pi.cargo, v_pessoa.cargo, 'membro'::cargo_tipo) as cargo,
    coalesce(pi.ativo, v_pessoa.ativo, true) as ativo,
    coalesce(pi.criado_em, now()) as criado_em
  into v_principal
  from public.pessoas_igrejas pi
  where pi.pessoa_id = v_pessoa.id
  order by
    coalesce(pi.ativo, true) desc,
    pi.atualizado_em desc nulls last,
    pi.criado_em desc nulls last
  limit 1;

  if not found then
    return;
  end if;

  select ua.id
  into v_usuario_acesso_id
  from public.usuarios_acesso ua
  where ua.pessoa_id = v_pessoa.id
  order by ua.atualizado_em desc nulls last, ua.criado_em desc nulls last
  limit 1;

  if v_usuario_acesso_id is null then
    select ua.id
    into v_usuario_acesso_id
    from public.usuarios_acesso ua
    where lower(trim(ua.email)) = v_email
    order by
      (ua.pessoa_id is null) desc,
      ua.atualizado_em desc nulls last,
      ua.criado_em desc nulls last
    limit 1;

    -- E-mail já usado pelo acesso de outra pessoa: não mexe nele.
    if v_usuario_acesso_id is not null and exists (
      select 1
      from public.usuarios_acesso ua
      where ua.id = v_usuario_acesso_id
        and ua.pessoa_id is not null
        and ua.pessoa_id <> v_pessoa.id
    ) then
      return;
    end if;
  end if;

  if v_usuario_acesso_id is null then
    insert into public.usuarios_acesso (
      pessoa_id,
      igreja_id,
      auth_user_id,
      email,
      nome,
      cargo,
      telefone,
      ativo,
      criado_em,
      atualizado_em
    )
    values (
      v_pessoa.id,
      v_principal.igreja_id,
      v_pessoa.usuario_id,
      v_email,
      v_pessoa.nome,
      v_principal.cargo,
      v_pessoa.telefone,
      v_principal.ativo,
      now(),
      now()
    )
    returning id into v_usuario_acesso_id;
  else
    update public.usuarios_acesso
    set
      pessoa_id = v_pessoa.id,
      igreja_id = v_principal.igreja_id,
      auth_user_id = coalesce(auth_user_id, v_pessoa.usuario_id),
      email = v_email,
      nome = coalesce(nullif(trim(v_pessoa.nome), ''), nome),
      cargo = v_principal.cargo,
      telefone = coalesce(v_pessoa.telefone, telefone),
      ativo = v_principal.ativo,
      atualizado_em = now()
    where id = v_usuario_acesso_id;
  end if;

  for v_vinculo in
    select
      pi.igreja_id,
      coalesce(pi.cargo, v_pessoa.cargo, 'membro'::cargo_tipo) as cargo,
      coalesce(pi.ativo, v_pessoa.ativo, true) as ativo,
      coalesce(pi.criado_em, now()) as criado_em
    from public.pessoas_igrejas pi
    where pi.pessoa_id = v_pessoa.id
  loop
    insert into public.usuarios_igrejas (
      usuario_id,
      igreja_id,
      cargo,
      ativo,
      criado_em
    )
    values (
      v_usuario_acesso_id,
      v_vinculo.igreja_id,
      v_vinculo.cargo,
      v_vinculo.ativo,
      v_vinculo.criado_em
    )
    on conflict (usuario_id, igreja_id)
    do update set
      cargo = excluded.cargo,
      ativo = excluded.ativo;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
