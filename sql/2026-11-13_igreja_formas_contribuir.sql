-- Substitui a tentativa anterior de PIX (colunas pix_* em igrejas, nunca
-- aplicada em produção e sem persistência real no código -- a rota de
-- PATCH /api/admin/igrejas/[id] nunca chegou a gravá-las).
-- Generaliza para qualquer forma de contribuição: PIX só existe no Brasil,
-- e o sistema também atende igrejas em Portugal/EUA/Canadá (IBAN, MB WAY,
-- transferência bancária, etc.).
create table if not exists public.igreja_formas_contribuir (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  tipo text not null check (tipo in ('pix', 'iban', 'mbway', 'banco', 'outro')),
  label text not null,
  valor text not null,
  beneficiario text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamp with time zone not null default now()
);

create index if not exists igreja_formas_contribuir_igreja_idx
  on public.igreja_formas_contribuir (igreja_id, ativo, ordem);

alter table public.igreja_formas_contribuir enable row level security;

-- Leitura pública: informação de doação é para qualquer visitante, igual às
-- colunas públicas de igrejas (NÃO copiar a política de igreja_redes_sociais,
-- que está sem policy de select nenhuma e bloqueia anon/authenticated).
drop policy if exists "igreja_formas_contribuir_select_publico" on public.igreja_formas_contribuir;
create policy "igreja_formas_contribuir_select_publico"
  on public.igreja_formas_contribuir
  for select
  to anon, authenticated
  using (true);

-- Sem política de insert/update/delete: escrita só pelo servidor (service role).
