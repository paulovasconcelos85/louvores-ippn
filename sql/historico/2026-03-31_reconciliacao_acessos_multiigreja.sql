-- Reconciliacao de pessoas x acessos x multi-igreja
-- Data: 2026-03-31
-- Objetivo:
-- 1. Diagnosticar registros orfaos entre pessoas, pessoas_igrejas, usuarios_acesso e usuarios_igrejas
-- 2. Reconciliar automaticamente apenas os casos seguros
-- 3. Preparar os casos que exigem decisao manual, com foco na ICPB e no Rev. Manuel Luzia

begin;

-- ============================================================
-- BLOCO 1. DIAGNOSTICO
-- Rode este bloco primeiro para entender o estado atual.
-- ============================================================

-- Pessoas sem vinculo em pessoas_igrejas.
select
  p.id,
  p.nome,
  p.email,
  p.cargo,
  p.igreja_id
from pessoas p
left join pessoas_igrejas pi on pi.pessoa_id = p.id
where pi.id is null
order by p.nome;

-- Usuarios de acesso sem pessoa vinculada.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.igreja_id,
  ua.auth_user_id
from usuarios_acesso ua
where ua.pessoa_id is null
order by ua.nome;

-- Usuarios de acesso sem igreja vinculada.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.pessoa_id,
  ua.auth_user_id
from usuarios_acesso ua
where ua.igreja_id is null
order by ua.nome;

-- Usuarios de acesso sem vinculo em usuarios_igrejas.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.pessoa_id,
  ua.igreja_id
from usuarios_acesso ua
left join usuarios_igrejas ui on ui.usuario_id = ua.id
where ui.id is null
order by ua.nome;

-- Pessoas da ICPB hoje.
select
  p.id,
  p.nome,
  p.email,
  p.cargo,
  p.igreja_id,
  pi.status_membro,
  pi.ativo
from pessoas p
left join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
where p.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
   or pi.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
order by p.nome;

-- Usuarios de acesso associados a ICPB hoje.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.pessoa_id,
  ua.igreja_id,
  ui.igreja_id as igreja_vinculada,
  ui.cargo as cargo_vinculado,
  ui.ativo as vinculo_ativo
from usuarios_acesso ua
left join usuarios_igrejas ui on ui.usuario_id = ua.id
where ua.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
   or ui.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
order by ua.nome;

-- Caso especifico: Rev. Manuel Luzia.
select
  ua.*
from usuarios_acesso ua
where lower(trim(ua.email)) = 'mluziapastor@gmail.com'
   or lower(trim(ua.nome)) like '%manuel%';


-- ============================================================
-- BLOCO 2. RECONCILIACAO AUTOMATICA SEGURA
-- Estes updates so cobrem casos com correspondencia confiavel.
-- ============================================================

-- 2.1. Garantir pessoas_igrejas a partir do igreja_id legado de pessoas.
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
select
  p.id,
  p.igreja_id,
  coalesce(nullif(p.status_membro, ''), 'ativo'),
  coalesce(nullif(p.cargo::text, ''), 'membro')::cargo_tipo,
  coalesce(p.ativo, true),
  'Vinculo criado automaticamente a partir de pessoas.igreja_id em 2026-03-31',
  now(),
  now()
from pessoas p
left join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = p.igreja_id
where p.igreja_id is not null
  and pi.id is null;

-- 2.2. Vincular usuarios_acesso a pessoas por e-mail, quando houver match exato unico.
with matches as (
  select
    ua.id as usuario_acesso_id,
    p.id as pessoa_id,
    p.igreja_id as igreja_id,
    coalesce(nullif(ua.cargo::text, ''), nullif(p.cargo::text, ''), 'membro')::cargo_tipo as cargo_resolvido,
    row_number() over (partition by ua.id order by p.atualizado_em desc nulls last, p.criado_em desc nulls last) as rn,
    count(*) over (partition by ua.id) as total_matches
  from usuarios_acesso ua
  join pessoas p
    on lower(trim(p.email)) = lower(trim(ua.email))
  where ua.pessoa_id is null
    and coalesce(trim(ua.email), '') <> ''
)
update usuarios_acesso ua
set
  pessoa_id = m.pessoa_id,
  igreja_id = coalesce(ua.igreja_id, m.igreja_id),
  cargo = coalesce(nullif(ua.cargo::text, ''), m.cargo_resolvido::text)::cargo_tipo,
  atualizado_em = now()
from matches m
where ua.id = m.usuario_acesso_id
  and m.rn = 1
  and m.total_matches = 1;

-- 2.3. Preencher igreja_id de usuarios_acesso a partir da pessoa vinculada.
update usuarios_acesso ua
set
  igreja_id = p.igreja_id,
  cargo = coalesce(nullif(ua.cargo::text, ''), nullif(p.cargo::text, ''), 'membro')::cargo_tipo,
  atualizado_em = now()
from pessoas p
where ua.pessoa_id = p.id
  and ua.igreja_id is null;

-- 2.4. Criar vinculos em usuarios_igrejas para usuarios_acesso que ja tem pessoa e igreja.
insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
select
  ua.id,
  ua.igreja_id,
  coalesce(nullif(ua.cargo::text, ''), nullif(p.cargo::text, ''), 'membro')::cargo_tipo,
  coalesce(ua.ativo, true),
  now()
from usuarios_acesso ua
left join pessoas p on p.id = ua.pessoa_id
left join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = ua.igreja_id
where ua.pessoa_id is not null
  and ua.igreja_id is not null
  and ui.id is null;

-- 2.5. Sincronizar cargo vazio em usuarios_acesso com o vinculo da pessoa.
update usuarios_acesso ua
set
  cargo = coalesce(
    (
      select nullif(pi.cargo::text, '')
      from pessoas_igrejas pi
      where pi.pessoa_id = p.id
        and pi.igreja_id = ua.igreja_id
      limit 1
    ),
    nullif(p.cargo::text, ''),
    'membro'
  )::cargo_tipo,
  atualizado_em = now()
from pessoas p
where ua.pessoa_id = p.id
  and coalesce(trim(ua.cargo::text), '') = '';


-- ============================================================
-- BLOCO 3. RELATORIOS POS-RECONCILIACAO
-- Confere o que ainda ficou pendente.
-- ============================================================

-- Usuarios_acesso ainda orfaos depois da reconciliacao automatica.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.pessoa_id,
  ua.igreja_id,
  ua.auth_user_id
from usuarios_acesso ua
where ua.pessoa_id is null
   or ua.igreja_id is null
order by ua.nome;

-- Usuarios sem vinculo em usuarios_igrejas depois da reconciliacao.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.pessoa_id,
  ua.igreja_id
from usuarios_acesso ua
left join usuarios_igrejas ui on ui.usuario_id = ua.id
where ua.igreja_id is not null
  and ui.id is null
order by ua.nome;

-- Estado da ICPB depois da reconciliacao.
select
  'pessoas' as origem,
  p.id,
  p.nome,
  p.email,
  p.cargo,
  p.igreja_id,
  null::uuid as usuario_acesso_id
from pessoas p
where p.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'

union all

select
  'pessoas_igrejas' as origem,
  p.id,
  p.nome,
  p.email,
  pi.cargo,
  pi.igreja_id,
  null::uuid as usuario_acesso_id
from pessoas_igrejas pi
join pessoas p on p.id = pi.pessoa_id
where pi.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'

union all

select
  'usuarios_acesso' as origem,
  ua.pessoa_id as id,
  ua.nome,
  ua.email,
  ua.cargo,
  ua.igreja_id,
  ua.id as usuario_acesso_id
from usuarios_acesso ua
where ua.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'

union all

select
  'usuarios_igrejas' as origem,
  ua.pessoa_id as id,
  ua.nome,
  ua.email,
  ui.cargo,
  ui.igreja_id,
  ua.id as usuario_acesso_id
from usuarios_igrejas ui
join usuarios_acesso ua on ua.id = ui.usuario_id
where ui.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
order by origem, nome;


-- ============================================================
-- BLOCO 4. CASO MANUAL: REV. MANUEL LUZIA
-- Este bloco NAO deve ser rodado no escuro.
-- Use quando voce confirmar o igreja_id correto e, se existir,
-- o auth_user_id correspondente no auth.users.
-- ============================================================

-- 4.1. Descobrir se ja existe pessoa correspondente.
select
  p.*
from pessoas p
where lower(trim(p.email)) = 'mluziapastor@gmail.com'
   or lower(trim(p.nome)) like '%manuel%';

-- 4.2. Se NAO existir pessoa, criar na ICPB.
-- Descomente apenas apos confirmar.
/*
insert into pessoas (
  nome,
  cargo,
  email,
  ativo,
  tem_acesso,
  status_membro,
  igreja_id,
  criado_em,
  atualizado_em
)
values (
  'Rev. Manuel Luzia',
  'pastor',
  'mluziapastor@gmail.com',
  true,
  true,
  'ativo',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  now(),
  now()
);
*/

-- 4.3. Garantir vinculo da pessoa dele na ICPB.
-- Troque :pessoa_id pelo id correto antes de rodar.
/*
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
values (
  ':pessoa_id',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'ativo',
  'pastor',
  true,
  'Vinculo criado para reconciliacao do Rev. Manuel Luzia',
  now(),
  now()
)
on conflict do nothing;
*/

-- 4.4. Atualizar o usuarios_acesso dele.
-- Troque :pessoa_id e :auth_user_id antes de rodar.
/*
update usuarios_acesso
set
  pessoa_id = ':pessoa_id',
  igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  cargo = 'pastor',
  auth_user_id = ':auth_user_id',
  ativo = true,
  atualizado_em = now()
where id = '85148040-44f9-4bf6-b22c-4349a617c853';
*/

-- 4.5. Garantir o vinculo dele em usuarios_igrejas.
/*
insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
values (
  '85148040-44f9-4bf6-b22c-4349a617c853',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'pastor',
  true,
  now()
)
on conflict (usuario_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo;
*/


-- ============================================================
-- BLOCO 5. NORMALIZACAO DE CARGOS
-- Regra sugerida:
-- 1. usuarios_igrejas.cargo = fonte de verdade para acesso por igreja
-- 2. pessoas_igrejas.cargo = fonte de verdade para cadastro ministerial por igreja
-- 3. usuarios_acesso.cargo = espelho da igreja principal do usuario
-- 4. pessoas.cargo = espelho da igreja principal da pessoa
-- ============================================================

-- 5.1. Sincronizar usuarios_acesso.cargo com o vinculo da igreja principal.
update usuarios_acesso ua
set
  cargo = ui.cargo,
  atualizado_em = now()
from usuarios_igrejas ui
where ui.usuario_id = ua.id
  and ui.igreja_id = ua.igreja_id
  and ua.igreja_id is not null
  and ua.cargo is distinct from ui.cargo;

-- 5.2. Sincronizar pessoas.cargo com o vinculo da igreja principal da pessoa.
update pessoas p
set
  cargo = pi.cargo,
  atualizado_em = now()
from pessoas_igrejas pi
where pi.pessoa_id = p.id
  and pi.igreja_id = p.igreja_id
  and p.igreja_id is not null
  and p.cargo is distinct from pi.cargo;

-- 5.3. Relatorio de divergencias restantes de cargo.
select
  ua.nome,
  ua.email,
  ua.cargo as cargo_usuario,
  ua.igreja_id as igreja_principal_usuario,
  ui.cargo as cargo_vinculo_usuario,
  p.cargo as cargo_pessoa,
  p.igreja_id as igreja_principal_pessoa,
  pi.cargo as cargo_vinculo_pessoa
from usuarios_acesso ua
left join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = ua.igreja_id
left join pessoas p on p.id = ua.pessoa_id
left join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = p.igreja_id
where ua.cargo is distinct from ui.cargo
   or p.cargo is distinct from pi.cargo
order by ua.nome;


-- ============================================================
-- BLOCO 6. ICPB E ORFAOS MANUAIS
-- Preencha os IDs antes de descomentar os updates/inserts.
-- ============================================================

-- 6.1. Orfaos ligados a ICPB.
select
  ua.id as usuario_acesso_id,
  ua.nome,
  ua.email,
  ua.cargo as cargo_usuario,
  ua.auth_user_id,
  ua.igreja_id as igreja_principal_usuario,
  ui.igreja_id as igreja_vinculo_usuario,
  ui.cargo as cargo_vinculo_usuario,
  ua.pessoa_id
from usuarios_acesso ua
left join usuarios_igrejas ui on ui.usuario_id = ua.id
where ua.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
   or ui.igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77'
order by ua.nome;

-- 6.2. Criar pessoa da Barbara na ICPB, se necessario.
-- Executavel: cria a pessoa se ainda nao existir por e-mail.
with barbara_pessoa as (
  insert into pessoas (
    id,
    nome,
    cargo,
    email,
    ativo,
    tem_acesso,
    status_membro,
    igreja_id,
    criado_em,
    atualizado_em
  )
  select
    gen_random_uuid(),
    'Bárbara Brasil',
    'membro'::cargo_tipo,
    'barby.brasil@gmail.com',
    true,
    true,
    'ativo',
    '00c83302-5027-4fc8-a8ff-cc5387a62b77',
    now(),
    now()
  where not exists (
    select 1
    from pessoas p
    where lower(trim(p.email)) = 'barby.brasil@gmail.com'
  )
  returning id
)
select id as pessoa_id_barbara_criada
from barbara_pessoa;

-- 6.3. Vincular Barbara na ICPB.
with barbara_pessoa as (
  select p.id
  from pessoas p
  where lower(trim(p.email)) = 'barby.brasil@gmail.com'
  order by p.atualizado_em desc nulls last, p.criado_em desc nulls last
  limit 1
)
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
select
  bp.id,
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'ativo',
  'membro'::cargo_tipo,
  true,
  'Vinculo criado na reconciliacao da ICPB',
  now(),
  now()
from barbara_pessoa bp
on conflict (pessoa_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo,
  atualizado_em = now();

-- 6.4. Atualizar usuarios_acesso da Barbara.
with barbara_pessoa as (
  select p.id
  from pessoas p
  where lower(trim(p.email)) = 'barby.brasil@gmail.com'
  order by p.atualizado_em desc nulls last, p.criado_em desc nulls last
  limit 1
)
update usuarios_acesso ua
set
  pessoa_id = bp.id,
  igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  cargo = 'membro'::cargo_tipo,
  atualizado_em = now()
from barbara_pessoa bp
where ua.id = 'e410818a-5e7e-4ebd-a816-0f59d01c8c17';

-- 6.5. Garantir usuarios_igrejas da Barbara apenas na ICPB.
delete from usuarios_igrejas
where usuario_id = 'e410818a-5e7e-4ebd-a816-0f59d01c8c17'
  and igreja_id <> '00c83302-5027-4fc8-a8ff-cc5387a62b77';

insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
values (
  'e410818a-5e7e-4ebd-a816-0f59d01c8c17',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'membro'::cargo_tipo,
  true,
  now()
)
on conflict (usuario_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo;

-- 6.6. Criar pessoa do Patrick na ICPB, se necessario.
with patrick_pessoa as (
  insert into pessoas (
    id,
    nome,
    cargo,
    email,
    ativo,
    tem_acesso,
    status_membro,
    igreja_id,
    criado_em,
    atualizado_em
  )
  select
    gen_random_uuid(),
    'Patrick Félix',
    'membro'::cargo_tipo,
    'patrick.ffelix@gmail.com',
    true,
    true,
    'ativo',
    '00c83302-5027-4fc8-a8ff-cc5387a62b77',
    now(),
    now()
  where not exists (
    select 1
    from pessoas p
    where lower(trim(p.email)) = 'patrick.ffelix@gmail.com'
  )
  returning id
)
select id as pessoa_id_patrick_criada
from patrick_pessoa;

-- 6.7. Vincular Patrick na ICPB.
with patrick_pessoa as (
  select p.id
  from pessoas p
  where lower(trim(p.email)) = 'patrick.ffelix@gmail.com'
  order by p.atualizado_em desc nulls last, p.criado_em desc nulls last
  limit 1
)
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
select
  pp.id,
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'ativo',
  'membro'::cargo_tipo,
  true,
  'Vinculo criado na reconciliacao da ICPB',
  now(),
  now()
from patrick_pessoa pp
on conflict (pessoa_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo,
  atualizado_em = now();

-- 6.8. Atualizar usuarios_acesso do Patrick.
with patrick_pessoa as (
  select p.id
  from pessoas p
  where lower(trim(p.email)) = 'patrick.ffelix@gmail.com'
  order by p.atualizado_em desc nulls last, p.criado_em desc nulls last
  limit 1
)
update usuarios_acesso ua
set
  pessoa_id = pp.id,
  igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  cargo = 'membro'::cargo_tipo,
  atualizado_em = now()
from patrick_pessoa pp
where ua.id = 'f2e2762e-ec42-42b5-a75d-decaf0f6c976';

-- 6.9. Garantir usuarios_igrejas do Patrick.
insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
values (
  'f2e2762e-ec42-42b5-a75d-decaf0f6c976',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'membro'::cargo_tipo,
  true,
  now()
)
on conflict (usuario_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo;

-- 6.10. Criar pessoa do Rev. Manuel Luzia na ICPB, se necessario.
with manuel_pessoa as (
  insert into pessoas (
    id,
    nome,
    cargo,
    email,
    ativo,
    tem_acesso,
    status_membro,
    igreja_id,
    criado_em,
    atualizado_em
  )
  select
    gen_random_uuid(),
    'Rev. Manuel Luzia',
    'pastor'::cargo_tipo,
    'mluziapastor@gmail.com',
    true,
    true,
    'ativo',
    '00c83302-5027-4fc8-a8ff-cc5387a62b77',
    now(),
    now()
  where not exists (
    select 1
    from pessoas p
    where lower(trim(p.email)) = 'mluziapastor@gmail.com'
  )
  returning id
)
select id as pessoa_id_manuel_criada
from manuel_pessoa;

-- 6.11. Vincular Rev. Manuel Luzia na ICPB.
with manuel_pessoa as (
  select p.id
  from pessoas p
  where lower(trim(p.email)) = 'mluziapastor@gmail.com'
  order by p.atualizado_em desc nulls last, p.criado_em desc nulls last
  limit 1
)
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
select
  mp.id,
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'ativo',
  'pastor'::cargo_tipo,
  true,
  'Vinculo criado na reconciliacao da ICPB',
  now(),
  now()
from manuel_pessoa mp
on conflict (pessoa_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo,
  atualizado_em = now();

-- 6.12. Atualizar usuarios_acesso do Rev. Manuel Luzia.
-- Se ele ja tiver usuario no auth.users, preencha auth_user_id depois.
with manuel_pessoa as (
  select p.id
  from pessoas p
  where lower(trim(p.email)) = 'mluziapastor@gmail.com'
  order by p.atualizado_em desc nulls last, p.criado_em desc nulls last
  limit 1
)
update usuarios_acesso ua
set
  pessoa_id = mp.id,
  igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  cargo = 'pastor'::cargo_tipo,
  ativo = true,
  atualizado_em = now()
from manuel_pessoa mp
where ua.id = '85148040-44f9-4bf6-b22c-4349a617c853';

-- 6.13. Garantir usuarios_igrejas do Rev. Manuel Luzia.
insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
values (
  '85148040-44f9-4bf6-b22c-4349a617c853',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'pastor'::cargo_tipo,
  true,
  now()
)
on conflict (usuario_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo;

/*
insert into pessoas (
  id,
  nome,
  cargo,
  email,
  ativo,
  tem_acesso,
  status_membro,
  igreja_id,
  criado_em,
  atualizado_em
)
values (
  ':pessoa_id_barbara',
  'Bárbara Brasil',
  'membro',
  'barby.brasil@gmail.com',
  true,
  true,
  'ativo',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  now(),
  now()
);
*/

-- 6.3. Vincular Barbara na ICPB.
/*
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
values (
  ':pessoa_id_barbara',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'ativo',
  'membro',
  true,
  'Vinculo criado na reconciliacao da ICPB',
  now(),
  now()
)
on conflict (pessoa_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo,
  atualizado_em = now();
*/

-- 6.4. Atualizar usuarios_acesso da Barbara.
/*
update usuarios_acesso
set
  pessoa_id = ':pessoa_id_barbara',
  igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  cargo = 'membro',
  atualizado_em = now()
where id = 'e410818a-5e7e-4ebd-a816-0f59d01c8c17';
*/

-- 6.5. Garantir usuarios_igrejas da Barbara apenas na ICPB.
/*
delete from usuarios_igrejas
where usuario_id = 'e410818a-5e7e-4ebd-a816-0f59d01c8c17'
  and igreja_id <> '00c83302-5027-4fc8-a8ff-cc5387a62b77';

insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
values (
  'e410818a-5e7e-4ebd-a816-0f59d01c8c17',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'membro',
  true,
  now()
)
on conflict (usuario_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo;
*/

-- 6.6. Criar pessoa do Patrick na ICPB, se necessario.
/*
insert into pessoas (
  id,
  nome,
  cargo,
  email,
  ativo,
  tem_acesso,
  status_membro,
  igreja_id,
  criado_em,
  atualizado_em
)
values (
  ':pessoa_id_patrick',
  'Patrick Félix',
  'membro',
  'patrick.ffelix@gmail.com',
  true,
  true,
  'ativo',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  now(),
  now()
);
*/

-- 6.7. Vincular Patrick na ICPB.
/*
insert into pessoas_igrejas (
  pessoa_id,
  igreja_id,
  status_membro,
  cargo,
  ativo,
  observacoes,
  criado_em,
  atualizado_em
)
values (
  ':pessoa_id_patrick',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'ativo',
  'membro',
  true,
  'Vinculo criado na reconciliacao da ICPB',
  now(),
  now()
)
on conflict (pessoa_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo,
  atualizado_em = now();
*/

-- 6.8. Atualizar usuarios_acesso do Patrick.
/*
update usuarios_acesso
set
  pessoa_id = ':pessoa_id_patrick',
  igreja_id = '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  cargo = 'membro',
  atualizado_em = now()
where id = 'f2e2762e-ec42-42b5-a75d-decaf0f6c976';
*/

-- 6.9. Garantir usuarios_igrejas do Patrick.
/*
insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
values (
  'f2e2762e-ec42-42b5-a75d-decaf0f6c976',
  '00c83302-5027-4fc8-a8ff-cc5387a62b77',
  'membro',
  true,
  now()
)
on conflict (usuario_id, igreja_id)
do update set
  cargo = excluded.cargo,
  ativo = excluded.ativo;
*/


-- ============================================================
-- BLOCO 7. CONSULTA FINAL DE AUDITORIA
-- ============================================================

select
  ua.nome as usuario_nome,
  ua.email as usuario_email,
  ua.cargo as cargo_usuario,
  ua.auth_user_id,
  ua.igreja_id as igreja_principal_usuario,
  p.id as pessoa_id,
  p.nome as pessoa_nome,
  p.cargo as cargo_pessoa,
  p.igreja_id as igreja_principal_pessoa,
  ui.igreja_id as igreja_vinculo_usuario,
  ui.cargo as cargo_vinculo_usuario,
  pi.igreja_id as igreja_vinculo_pessoa,
  pi.cargo as cargo_vinculo_pessoa
from usuarios_acesso ua
left join pessoas p on p.id = ua.pessoa_id
left join usuarios_igrejas ui on ui.usuario_id = ua.id
left join pessoas_igrejas pi on pi.pessoa_id = p.id
order by ua.nome, ui.igreja_id nulls last, pi.igreja_id nulls last;

rollback;

-- Quando revisar o resultado e estiver satisfeito, troque o rollback por commit.
