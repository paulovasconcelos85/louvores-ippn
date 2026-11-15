-- Módulo Finanças / Tesouraria
-- Data: 2026-10-24
--
-- Segue o modelo de estatuto da igreja local da IPB (CI/IPB):
--   - o Conselho elege o Tesoureiro (art. 2º §4) -> fin_equipe.papel = 'tesoureiro'
--   - comissão de exame de contas de 3 pessoas, balancete trimestral e anual (art. 11)
--     -> fin_equipe.papel = 'comissao' e fin_exames
--   - relatório estatístico, seção IV (receitas e despesas por grupo) -> fin_categorias.grupo
--
-- Segurança: RLS ligado e SEM políticas. Nenhum cliente do navegador lê estas
-- tabelas; tudo passa pelas rotas /api/financas/* com a service role, que
-- aplicam as permissões (inclusive o sigilo do nome de quem dizima).

create table if not exists public.fin_contas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'banco' check (tipo in ('caixa', 'banco', 'aplicacao')),
  banco text,
  agencia text,
  numero text,
  saldo_inicial numeric(14,2) not null default 0,
  data_saldo_inicial date not null default current_date,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists fin_contas_igreja_idx on public.fin_contas (igreja_id);

create table if not exists public.fin_categorias (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  -- Grupo da seção IV do relatório estatístico da IPB.
  grupo text not null check (grupo in (
    'dizimos_ofertas', 'especificas_outras',
    'patrimonio', 'causas_locais', 'evangelismo', 'missoes',
    'sustento_pastoral', 'verba_presbiterial', 'dizimo_sc'
  )),
  -- Receita nominal (dízimo de uma pessoa): pede o contribuinte no lançamento.
  nominal boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists fin_categorias_igreja_idx on public.fin_categorias (igreja_id);

create table if not exists public.fin_lancamentos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa', 'transferencia')),
  data date not null,
  valor numeric(14,2) not null check (valor > 0),
  conta_id uuid not null references public.fin_contas(id),
  conta_destino_id uuid references public.fin_contas(id),
  categoria_id uuid references public.fin_categorias(id),
  pessoa_id uuid references public.pessoas(id) on delete set null,
  descricao text,
  forma_pagamento text check (forma_pagamento in ('dinheiro', 'pix', 'transferencia', 'cartao', 'cheque', 'boleto', 'outro')),
  documento_tipo text check (documento_tipo in ('nota_fiscal', 'recibo', 'rpa', 'comprovante', 'outro')),
  documento_numero text,
  comprovante_path text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint fin_lancamentos_transferencia_ck check (
    (tipo = 'transferencia' and conta_destino_id is not null and categoria_id is null and conta_destino_id <> conta_id)
    or (tipo <> 'transferencia' and categoria_id is not null and conta_destino_id is null)
  )
);
create index if not exists fin_lancamentos_igreja_data_idx on public.fin_lancamentos (igreja_id, data);
create index if not exists fin_lancamentos_pessoa_idx on public.fin_lancamentos (pessoa_id) where pessoa_id is not null;

-- Quem trabalha na tesouraria, por igreja e por ano (o Conselho elege anualmente).
create table if not exists public.fin_equipe (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  papel text not null check (papel in ('tesoureiro', 'auxiliar', 'comissao')),
  ano integer not null,
  criado_em timestamptz not null default now(),
  unique (igreja_id, pessoa_id, papel, ano)
);
create index if not exists fin_equipe_igreja_ano_idx on public.fin_equipe (igreja_id, ano);

create table if not exists public.fin_orcamentos (
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  ano integer not null,
  categoria_id uuid not null references public.fin_categorias(id) on delete cascade,
  valor_previsto numeric(14,2) not null default 0 check (valor_previsto >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (igreja_id, ano, categoria_id)
);

-- Exame de contas por trimestre (1-4) e do exercício (0).
-- aberto -> enviado (período travado) -> parecer emitido ou devolvido -> aprovado pelo Conselho.
create table if not exists public.fin_exames (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  ano integer not null,
  periodo integer not null check (periodo between 0 and 4),
  status text not null default 'aberto' check (status in ('aberto', 'enviado', 'devolvido', 'parecer', 'aprovado')),
  parecer text check (parecer in ('favoravel', 'ressalvas', 'desfavoravel')),
  observacoes text,
  enviado_em timestamptz,
  enviado_por uuid,
  examinado_em timestamptz,
  examinado_por uuid,
  aprovado_em timestamptz,
  aprovado_por uuid,
  ata_conselho text,
  atualizado_em timestamptz not null default now(),
  unique (igreja_id, ano, periodo)
);

alter table public.fin_contas enable row level security;
alter table public.fin_categorias enable row level security;
alter table public.fin_lancamentos enable row level security;
alter table public.fin_equipe enable row level security;
alter table public.fin_orcamentos enable row level security;
alter table public.fin_exames enable row level security;

-- Comprovantes (NF, recibo, RPA) ficam num bucket privado, lido por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financas-comprovantes', 'financas-comprovantes', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
