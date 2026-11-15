-- Admin da plataforma separado do superadmin da igreja (15/11/2026).
--
-- Problema: is_global_admin() devolvia true para quem tinha o cargo
-- 'superadmin' em QUALQUER igreja. Quatro superadmins só da IPPN eram tratados
-- pelo banco como admins de todas as igrejas: liam e alteravam pessoas,
-- vínculos (pessoas_igrejas), convites e acessos (usuarios_acesso) da ICPB e da
-- ICPT, e criavam/alteravam o catálogo de tags.
--
-- Correção: a tabela plataforma_admins diz quem administra a plataforma (hoje
-- só o dono do Oikos, o mesmo e-mail de src/lib/admin-config.ts, que as rotas
-- /api já usam). O cargo 'superadmin' continua valendo dentro da própria
-- igreja, por meio de can_manage_church().
--
-- As políticas e funções que chamam is_global_admin() não precisam mudar.
-- O app grava usuarios_acesso e tags_funcoes só pelo servidor (service role).

begin;

create table if not exists public.plataforma_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.plataforma_admins enable row level security;
revoke all on public.plataforma_admins from anon, authenticated;

insert into public.plataforma_admins (auth_user_id)
values ('55c289ba-95fb-4249-a0c8-1807ceb4bce8')
on conflict do nothing;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.plataforma_admins pa
    join public.usuarios_acesso ua
      on ua.auth_user_id = pa.auth_user_id
     and coalesce(ua.ativo, true) = true
    where pa.auth_user_id = auth.uid()
  );
$$;

commit;
