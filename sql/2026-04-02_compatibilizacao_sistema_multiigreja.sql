-- Compatibilizacao de dados do modelo multi-igreja
-- com o comportamento atual do sistema Next.js
-- Data: 2026-04-02
--
-- Este script NAO altera a estrutura do banco.
-- Ele apenas ajusta os dados para o formato que o sistema atual espera:
-- 1. pessoas_igrejas = fonte de verdade do cadastro por igreja
-- 2. usuarios_igrejas = fonte de verdade do acesso por igreja
-- 3. pessoas.igreja_id / cargo / status_membro / ativo = espelho da igreja principal
-- 4. usuarios_acesso.igreja_id / cargo / ativo = espelho da igreja principal
-- 5. pessoas.tem_acesso / usuario_id e usuarios_acesso.pessoa_id / auth_user_id ficam coerentes
--
-- Fluxo sugerido:
-- 1. Rode inteiro com rollback
-- 2. Revise os SELECTs finais
-- 3. Se estiver tudo certo, troque rollback por commit

begin;

-- ============================================================
-- BLOCO 1. DIAGNOSTICO ANTES DO AJUSTE
-- ============================================================

-- E-mails duplicados em pessoas.
select
  lower(trim(p.email)) as email_normalizado,
  count(*) as total,
  array_agg(p.id order by p.atualizado_em desc nulls last, p.criado_em desc nulls last) as pessoa_ids
from pessoas p
where coalesce(trim(p.email), '') <> ''
group by lower(trim(p.email))
having count(*) > 1
order by total desc, email_normalizado;

-- E-mails duplicados em usuarios_acesso.
select
  lower(trim(ua.email)) as email_normalizado,
  count(*) as total,
  array_agg(ua.id order by ua.atualizado_em desc nulls last, ua.criado_em desc nulls last) as usuario_ids
from usuarios_acesso ua
where coalesce(trim(ua.email), '') <> ''
group by lower(trim(ua.email))
having count(*) > 1
order by total desc, email_normalizado;

-- auth_user_id duplicado em usuarios_acesso.
select
  ua.auth_user_id,
  count(*) as total,
  array_agg(ua.id order by ua.atualizado_em desc nulls last, ua.criado_em desc nulls last) as usuario_ids
from usuarios_acesso ua
where ua.auth_user_id is not null
group by ua.auth_user_id
having count(*) > 1
order by total desc, ua.auth_user_id;

-- Pessoas com igreja espelho mas sem vinculo em pessoas_igrejas.
select
  p.id,
  p.nome,
  p.email,
  p.igreja_id,
  p.cargo,
  p.status_membro,
  p.ativo
from pessoas p
left join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = p.igreja_id
where p.igreja_id is not null
  and pi.id is null
order by p.nome;

-- Usuarios com igreja espelho mas sem vinculo em usuarios_igrejas.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.pessoa_id,
  ua.auth_user_id,
  ua.igreja_id,
  ua.cargo,
  ua.ativo
from usuarios_acesso ua
left join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = ua.igreja_id
where ua.igreja_id is not null
  and ui.usuario_id is null
order by ua.nome;

-- Pessoas com acesso liberado mas sem usuario_acesso vinculado.
select
  p.id,
  p.nome,
  p.email,
  p.usuario_id,
  p.igreja_id,
  p.tem_acesso
from pessoas p
left join usuarios_acesso ua on ua.pessoa_id = p.id
where coalesce(p.tem_acesso, false) = true
  and ua.id is null
order by p.nome;

-- Pessoas com acesso liberado mas sem e-mail valido para criar usuarios_acesso.
select
  p.id,
  p.nome,
  p.email,
  p.usuario_id,
  p.igreja_id
from pessoas p
where coalesce(p.tem_acesso, false) = true
  and coalesce(trim(p.email), '') = ''
order by p.nome;

-- Usuarios de acesso sem pessoa vinculada.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.auth_user_id,
  ua.igreja_id,
  ua.cargo
from usuarios_acesso ua
where ua.pessoa_id is null
order by ua.nome;


-- ============================================================
-- BLOCO 2. NORMALIZACAO BASICA
-- ============================================================

update pessoas
set
  email = lower(trim(email)),
  atualizado_em = now()
where coalesce(trim(email), '') <> ''
  and email is distinct from lower(trim(email));

update usuarios_acesso
set
  email = lower(trim(email)),
  atualizado_em = now()
where coalesce(trim(email), '') <> ''
  and email is distinct from lower(trim(email));


-- ============================================================
-- BLOCO 3. GARANTIR VINCULOS BASE
-- ============================================================

-- 3.1. Criar pessoas_igrejas a partir de pessoas.igreja_id quando faltar.
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
  'Vinculo criado automaticamente para compatibilizar com o sistema Next.js em 2026-04-02',
  coalesce(p.criado_em, now()),
  now()
from pessoas p
left join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = p.igreja_id
where p.igreja_id is not null
  and pi.id is null;

-- 3.2. Tentar vincular usuarios_acesso a pessoas por e-mail quando houver match unico.
with pessoas_por_email as (
  select
    lower(trim(p.email)) as email_normalizado,
    min(p.id) as pessoa_id,
    count(*) as total
  from pessoas p
  where coalesce(trim(p.email), '') <> ''
  group by lower(trim(p.email))
),
usuarios_por_email as (
  select
    ua.id as usuario_id,
    lower(trim(ua.email)) as email_normalizado,
    count(*) over (partition by lower(trim(ua.email))) as total_usuarios
  from usuarios_acesso ua
  where ua.pessoa_id is null
    and coalesce(trim(ua.email), '') <> ''
)
update usuarios_acesso ua
set
  pessoa_id = pe.pessoa_id,
  atualizado_em = now()
from usuarios_por_email ue
join pessoas_por_email pe on pe.email_normalizado = ue.email_normalizado
where ua.id = ue.usuario_id
  and pe.total = 1
  and ue.total_usuarios = 1
  and ua.pessoa_id is null;

-- 3.3. Sincronizar usuario_id de pessoas a partir do auth_user_id de usuarios_acesso.
update pessoas p
set
  usuario_id = ua.auth_user_id,
  atualizado_em = now()
from usuarios_acesso ua
where ua.pessoa_id = p.id
  and ua.auth_user_id is not null
  and p.usuario_id is null;

-- 3.4. Sincronizar auth_user_id de usuarios_acesso a partir de pessoas.usuario_id.
update usuarios_acesso ua
set
  auth_user_id = p.usuario_id,
  atualizado_em = now()
from pessoas p
where ua.pessoa_id = p.id
  and p.usuario_id is not null
  and ua.auth_user_id is null;

-- 3.5. Criar usuarios_acesso faltantes para pessoas com acesso.
insert into usuarios_acesso (
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
select
  p.id,
  p.igreja_id,
  p.usuario_id,
  p.email,
  p.nome,
  coalesce(nullif(p.cargo::text, ''), 'membro')::cargo_tipo,
  p.telefone,
  coalesce(p.ativo, true),
  coalesce(p.criado_em, now()),
  now()
from pessoas p
where coalesce(p.tem_acesso, false) = true
  and coalesce(trim(p.email), '') <> ''
  and not exists (
    select 1
    from usuarios_acesso ua
    where ua.pessoa_id = p.id
  );

-- 3.6. Criar usuarios_igrejas a partir do espelho atual de usuarios_acesso quando faltar.
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
  coalesce(nullif(ua.cargo::text, ''), 'membro')::cargo_tipo,
  coalesce(ua.ativo, true),
  coalesce(ua.criado_em, now())
from usuarios_acesso ua
left join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = ua.igreja_id
where ua.igreja_id is not null
  and ui.usuario_id is null;

-- 3.7. Se a pessoa tem acesso e existe usuario_acesso vinculado, garantir flag.
update pessoas p
set
  tem_acesso = true,
  usuario_id = coalesce(p.usuario_id, ua.auth_user_id),
  atualizado_em = now()
from usuarios_acesso ua
where ua.pessoa_id = p.id
  and (
    coalesce(p.tem_acesso, false) = false
    or (p.usuario_id is null and ua.auth_user_id is not null)
  );


-- ============================================================
-- BLOCO 4. ELEGER IGREJA PRINCIPAL DE CADA PESSOA
-- ============================================================
--
-- Regra para o sistema atual:
-- 1. Se a igreja espelho atual ainda existe em pessoas_igrejas, ela continua principal
-- 2. Senao, prioriza vinculo ativo
-- 3. Depois o vinculo atualizado mais recentemente

with principal_pessoa as (
  select
    p.id as pessoa_id,
    pi.igreja_id,
    pi.cargo,
    pi.status_membro,
    pi.ativo,
    row_number() over (
      partition by p.id
      order by
        case when pi.igreja_id = p.igreja_id then 0 else 1 end,
        case when coalesce(pi.ativo, true) then 0 else 1 end,
        coalesce(pi.atualizado_em, pi.criado_em, now()) desc,
        pi.igreja_id
    ) as rn
  from pessoas p
  join pessoas_igrejas pi on pi.pessoa_id = p.id
)
update pessoas p
set
  igreja_id = pp.igreja_id,
  cargo = pp.cargo,
  status_membro = pp.status_membro,
  ativo = pp.ativo,
  atualizado_em = now()
from principal_pessoa pp
where p.id = pp.pessoa_id
  and pp.rn = 1
  and (
    p.igreja_id is distinct from pp.igreja_id
    or p.cargo is distinct from pp.cargo
    or p.status_membro is distinct from pp.status_membro
    or p.ativo is distinct from pp.ativo
  );


-- ============================================================
-- BLOCO 5. ELEGER IGREJA PRINCIPAL DE CADA USUARIO
-- ============================================================
--
-- Regra para o sistema atual:
-- 1. Se a igreja espelho atual ainda existe em usuarios_igrejas, ela continua principal
-- 2. Senao, prioriza vinculo ativo
-- 3. Depois a igreja da pessoa vinculada
-- 4. Depois ordena pelo proprio vinculo

with principal_usuario as (
  select
    ua.id as usuario_id,
    ui.igreja_id,
    ui.cargo,
    ui.ativo,
    row_number() over (
      partition by ua.id
      order by
        case when ui.igreja_id = ua.igreja_id then 0 else 1 end,
        case when coalesce(ui.ativo, true) then 0 else 1 end,
        case when ui.igreja_id = p.igreja_id then 0 else 1 end,
        ui.igreja_id
    ) as rn
  from usuarios_acesso ua
  join usuarios_igrejas ui on ui.usuario_id = ua.id
  left join pessoas p on p.id = ua.pessoa_id
)
update usuarios_acesso ua
set
  igreja_id = pu.igreja_id,
  cargo = pu.cargo,
  ativo = pu.ativo,
  atualizado_em = now()
from principal_usuario pu
where ua.id = pu.usuario_id
  and pu.rn = 1
  and (
    ua.igreja_id is distinct from pu.igreja_id
    or ua.cargo is distinct from pu.cargo
    or ua.ativo is distinct from pu.ativo
  );


-- ============================================================
-- BLOCO 6. SINCRONISMO ENTRE PESSOA E ACESSO
-- ============================================================

-- 6.1. Completar dados basicos de usuarios_acesso a partir da pessoa vinculada.
update usuarios_acesso ua
set
  pessoa_id = p.id,
  auth_user_id = coalesce(ua.auth_user_id, p.usuario_id),
  email = coalesce(nullif(trim(ua.email), ''), p.email),
  nome = coalesce(nullif(trim(ua.nome), ''), p.nome),
  telefone = coalesce(nullif(trim(ua.telefone), ''), p.telefone),
  igreja_id = coalesce(ua.igreja_id, p.igreja_id),
  cargo = coalesce(ua.cargo, p.cargo),
  ativo = coalesce(ua.ativo, p.ativo, true),
  atualizado_em = now()
from pessoas p
where ua.pessoa_id = p.id
  and (
    ua.auth_user_id is null
    or coalesce(trim(ua.email), '') = ''
    or coalesce(trim(ua.nome), '') = ''
    or ua.igreja_id is null
    or ua.cargo is null
    or ua.ativo is null
  );

-- 6.2. Garantir vinculo do usuario na igreja principal da pessoa quando houver acesso.
insert into usuarios_igrejas (
  usuario_id,
  igreja_id,
  cargo,
  ativo,
  criado_em
)
select
  ua.id,
  p.igreja_id,
  coalesce(nullif(ua.cargo::text, ''), nullif(p.cargo::text, ''), 'membro')::cargo_tipo,
  coalesce(ua.ativo, p.ativo, true),
  coalesce(ua.criado_em, now())
from usuarios_acesso ua
join pessoas p on p.id = ua.pessoa_id
left join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = p.igreja_id
where p.igreja_id is not null
  and coalesce(p.tem_acesso, false) = true
  and ui.usuario_id is null;

-- 6.3. Para o sistema atual, espelho de acesso segue o vinculo principal.
update usuarios_acesso ua
set
  cargo = ui.cargo,
  ativo = ui.ativo,
  atualizado_em = now()
from usuarios_igrejas ui
where ui.usuario_id = ua.id
  and ui.igreja_id = ua.igreja_id
  and (
    ua.cargo is distinct from ui.cargo
    or ua.ativo is distinct from ui.ativo
  );

-- 6.4. Para o sistema atual, espelho de pessoa segue o vinculo principal.
update pessoas p
set
  cargo = pi.cargo,
  status_membro = pi.status_membro,
  ativo = pi.ativo,
  atualizado_em = now()
from pessoas_igrejas pi
where pi.pessoa_id = p.id
  and pi.igreja_id = p.igreja_id
  and (
    p.cargo is distinct from pi.cargo
    or p.status_membro is distinct from pi.status_membro
    or p.ativo is distinct from pi.ativo
  );


-- ============================================================
-- BLOCO 7. AUDITORIA FINAL PARA O NEXT.JS
-- ============================================================

-- O sistema atual espera que a igreja espelho da pessoa exista em pessoas_igrejas.
select
  p.id,
  p.nome,
  p.email,
  p.igreja_id,
  p.cargo,
  p.status_membro,
  p.ativo
from pessoas p
left join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = p.igreja_id
where p.igreja_id is not null
  and pi.id is null
order by p.nome;

-- O sistema atual espera que a igreja espelho do acesso exista em usuarios_igrejas.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.auth_user_id,
  ua.pessoa_id,
  ua.igreja_id,
  ua.cargo,
  ua.ativo
from usuarios_acesso ua
left join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = ua.igreja_id
where ua.igreja_id is not null
  and ui.usuario_id is null
order by ua.nome;

-- Divergencias de espelho de pessoa.
select
  p.id,
  p.nome,
  p.email,
  p.igreja_id as igreja_espelho,
  pi.igreja_id as igreja_vinculo,
  p.cargo as cargo_espelho,
  pi.cargo as cargo_vinculo,
  p.status_membro as status_espelho,
  pi.status_membro as status_vinculo,
  p.ativo as ativo_espelho,
  pi.ativo as ativo_vinculo
from pessoas p
join pessoas_igrejas pi
  on pi.pessoa_id = p.id
 and pi.igreja_id = p.igreja_id
where p.cargo is distinct from pi.cargo
   or p.status_membro is distinct from pi.status_membro
   or p.ativo is distinct from pi.ativo
order by p.nome;

-- Divergencias de espelho de usuario.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.igreja_id as igreja_espelho,
  ui.igreja_id as igreja_vinculo,
  ua.cargo as cargo_espelho,
  ui.cargo as cargo_vinculo,
  ua.ativo as ativo_espelho,
  ui.ativo as ativo_vinculo
from usuarios_acesso ua
join usuarios_igrejas ui
  on ui.usuario_id = ua.id
 and ui.igreja_id = ua.igreja_id
where ua.cargo is distinct from ui.cargo
   or ua.ativo is distinct from ui.ativo
order by ua.nome;

-- Pessoas com acesso liberado sem usuario_acesso correspondente.
select
  p.id,
  p.nome,
  p.email,
  p.usuario_id,
  p.igreja_id
from pessoas p
left join usuarios_acesso ua on ua.pessoa_id = p.id
where coalesce(p.tem_acesso, false) = true
  and ua.id is null
order by p.nome;

-- Pessoas com acesso liberado mas sem e-mail valido para login.
select
  p.id,
  p.nome,
  p.email,
  p.usuario_id,
  p.igreja_id
from pessoas p
where coalesce(p.tem_acesso, false) = true
  and coalesce(trim(p.email), '') = ''
order by p.nome;

-- Usuarios de acesso ainda sem pessoa vinculada.
select
  ua.id,
  ua.nome,
  ua.email,
  ua.auth_user_id,
  ua.igreja_id
from usuarios_acesso ua
where ua.pessoa_id is null
order by ua.nome;

rollback;
