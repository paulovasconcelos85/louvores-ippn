-- Calendário de eventos futuros da igreja (conferências, encontros, datas
-- especiais), exibido na área do membro. Diferente de recursos_multimidia:
-- aqui o que importa é "o que vem a seguir" (leitura padrão = futuro,
-- ordem ascendente), não "o que saiu por último".
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid references public.igrejas(id) on delete set null,
  titulo text not null,
  data_evento date not null,
  hora time,
  local text,
  descricao text not null default '',
  imagem_url text,
  responsavel text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);

create index if not exists eventos_publico_idx
  on public.eventos (ativo, data_evento asc, ordem asc);

create index if not exists eventos_igreja_idx
  on public.eventos (igreja_id, ativo, data_evento asc);

create or replace function public.atualizar_eventos_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists eventos_atualizado_em_bu on public.eventos;

create trigger eventos_atualizado_em_bu
before update on public.eventos
for each row
execute function public.atualizar_eventos_atualizado_em();

alter table public.eventos enable row level security;

drop policy if exists "eventos_select_publico" on public.eventos;
create policy "eventos_select_publico"
  on public.eventos
  for select
  to anon, authenticated
  using (true);

-- Sem política de insert/update/delete: escrita só pelo servidor (service role),
-- igual a recursos_multimidia.
