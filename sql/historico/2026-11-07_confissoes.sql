-- Confissões e catecismos (Westminster e Dort) para leitura pública:
-- biblioteca do sistema e "texto do dia" no boletim, junto do versículo do dia.
-- Textos importados de monergismo.com (dados em 2026-11-07_confissoes_dados.sql).
-- Conteúdo comum a todas as igrejas: leitura pública, escrita só pelo servidor.

begin;

create table if not exists public.confissoes_documentos (
  id text primary key,
  titulo text not null,
  sigla text not null,
  ano text,
  descricao text,
  -- Ordem do documento no ciclo diário do boletim.
  ordem_ciclo integer not null unique,
  fonte_url text not null
);

create table if not exists public.confissoes_itens (
  id text primary key,
  documento_id text not null references public.confissoes_documentos(id) on delete cascade,
  ordem integer not null,
  -- Capítulo/seção do documento ("Capítulo I — Da Escritura Sagrada"); nulo nos catecismos.
  secao text,
  -- "Pergunta 1", "Capítulo I, seção II", "Capítulo 1, artigo 3".
  rotulo text not null,
  pergunta text,
  texto text not null,
  referencias text,
  unique (documento_id, ordem)
);

create index if not exists confissoes_itens_documento_ordem_idx
  on public.confissoes_itens (documento_id, ordem);

alter table public.confissoes_documentos enable row level security;
alter table public.confissoes_itens enable row level security;

drop policy if exists "confissoes_documentos_select_publico" on public.confissoes_documentos;
create policy "confissoes_documentos_select_publico"
  on public.confissoes_documentos
  for select
  to anon, authenticated
  using (true);

drop policy if exists "confissoes_itens_select_publico" on public.confissoes_itens;
create policy "confissoes_itens_select_publico"
  on public.confissoes_itens
  for select
  to anon, authenticated
  using (true);

commit;

notify pgrst, 'reload schema';
