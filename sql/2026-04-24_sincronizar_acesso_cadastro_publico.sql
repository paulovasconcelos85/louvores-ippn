-- Sincroniza acesso automaticamente para cadastros com e-mail.
-- Quando uma pessoa tem e-mail e vinculo em pessoas_igrejas, o banco garante:
-- 1. usuarios_acesso vinculado a pessoa
-- 2. usuarios_igrejas vinculado as igrejas da pessoa

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
      (ua.pessoa_id = v_pessoa.id) desc,
      (ua.pessoa_id is null) desc,
      ua.atualizado_em desc nulls last,
      ua.criado_em desc nulls last
    limit 1;
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

create or replace function public.trg_sincronizar_acesso_pessoas_igrejas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sincronizar_acesso_pessoa_por_email(new.pessoa_id);
  return new;
end;
$$;

create or replace function public.trg_sincronizar_acesso_pessoas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sincronizar_acesso_pessoa_por_email(new.id);
  return new;
end;
$$;

drop trigger if exists sincronizar_acesso_pessoas_igrejas_aiu on public.pessoas_igrejas;

create trigger sincronizar_acesso_pessoas_igrejas_aiu
after insert or update of igreja_id, cargo, ativo
on public.pessoas_igrejas
for each row
execute function public.trg_sincronizar_acesso_pessoas_igrejas();

drop trigger if exists sincronizar_acesso_pessoas_aiu on public.pessoas;

create trigger sincronizar_acesso_pessoas_aiu
after insert or update of email, nome, telefone, cargo, ativo, usuario_id
on public.pessoas
for each row
execute function public.trg_sincronizar_acesso_pessoas();

-- Backfill para pessoas ja cadastradas com e-mail e vinculo em igreja.
select public.sincronizar_acesso_pessoa_por_email(p.id)
from public.pessoas p
where coalesce(trim(p.email), '') <> ''
  and exists (
    select 1
    from public.pessoas_igrejas pi
    where pi.pessoa_id = p.id
  );
