create table if not exists public.recursos_multimidia (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid references public.igrejas(id) on delete set null,
  titulo text not null,
  categoria text not null default 'culto',
  data_recurso date not null,
  descricao text not null default '',
  responsavel text,
  youtube_url text,
  video_url text,
  thumbnail_url text,
  plataforma text not null default 'youtube',
  duracao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_por uuid,
  atualizado_por uuid,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);

create index if not exists recursos_multimidia_publico_idx
  on public.recursos_multimidia (ativo, data_recurso desc, ordem asc);

create index if not exists recursos_multimidia_igreja_idx
  on public.recursos_multimidia (igreja_id, ativo, data_recurso desc);

alter table public.recursos_multimidia
  add column if not exists video_url text,
  add column if not exists thumbnail_url text,
  add column if not exists plataforma text not null default 'youtube';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recursos_multimidia_categoria_ck'
  ) then
    alter table public.recursos_multimidia
      add constraint recursos_multimidia_categoria_ck
      check (categoria in ('culto', 'ebd', 'estudo', 'especial'));
  end if;
end $$;

create or replace function public.atualizar_recursos_multimidia_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists recursos_multimidia_atualizado_em_bu on public.recursos_multimidia;

create trigger recursos_multimidia_atualizado_em_bu
before update on public.recursos_multimidia
for each row
execute function public.atualizar_recursos_multimidia_atualizado_em();
