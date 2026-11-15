-- Notícias do Mês: matérias grandes (ex.: jornal Brasil Presbiteriano) que se
-- repetem em todos os boletins publicados dentro do mesmo mês/ano, sem
-- precisar ser recadastradas a cada culto. Independentes de boletim_secoes
-- (que são amarradas a um culto_id específico).
-- Data: 2026-09-02

create table if not exists public.noticias_mensais (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  titulo text not null,
  corpo text not null default '',
  imagem_url text,
  mes_referencia integer not null,
  ano_referencia integer not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists noticias_mensais_igreja_mes_idx
  on public.noticias_mensais (igreja_id, ano_referencia, mes_referencia, ordem);

alter table public.noticias_mensais enable row level security;

drop policy if exists "noticias_mensais_select_por_igreja" on public.noticias_mensais;
create policy "noticias_mensais_select_por_igreja"
  on public.noticias_mensais
  for select
  to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "noticias_mensais_insert_por_igreja" on public.noticias_mensais;
create policy "noticias_mensais_insert_por_igreja"
  on public.noticias_mensais
  for insert
  to authenticated
  with check (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "noticias_mensais_update_por_igreja" on public.noticias_mensais;
create policy "noticias_mensais_update_por_igreja"
  on public.noticias_mensais
  for update
  to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id))
  with check (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "noticias_mensais_delete_por_igreja" on public.noticias_mensais;
create policy "noticias_mensais_delete_por_igreja"
  on public.noticias_mensais
  for delete
  to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id));

notify pgrst, 'reload schema';
