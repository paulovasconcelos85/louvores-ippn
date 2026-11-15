create table if not exists public.oikos_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text not null,
  mensagem text,
  igreja text,
  funcao text,
  locale text,
  origem text not null default 'landing_oikos',
  status text not null default 'novo',
  user_agent text,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);

create index if not exists oikos_leads_status_idx
  on public.oikos_leads (status, criado_em desc);

create index if not exists oikos_leads_contato_idx
  on public.oikos_leads (lower(contato));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'oikos_leads_status_ck'
  ) then
    alter table public.oikos_leads
      add constraint oikos_leads_status_ck
      check (status in ('novo', 'em_contato', 'demo_agendada', 'convertido', 'perdido'));
  end if;
end $$;

create or replace function public.atualizar_oikos_leads_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists oikos_leads_atualizado_em_bu on public.oikos_leads;

create trigger oikos_leads_atualizado_em_bu
before update on public.oikos_leads
for each row
execute function public.atualizar_oikos_leads_atualizado_em();
