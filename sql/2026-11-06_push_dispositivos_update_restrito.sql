-- push_dispositivos_update_public permitia que qualquer pessoa (inclusive anon)
-- alterasse QUALQUER aparelho: trocar push_token, desativar ou religar o
-- aparelho a outro usuário.
--
-- As políticas abertas existiam para o app iOS registrar o aparelho direto no
-- banco. O app foi descontinuado; hoje só o servidor (service role, que ignora
-- RLS) usa a tabela, em /api/internal/notifications/dispatch. Sem políticas,
-- anon/authenticated ficam bloqueados.

begin;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_dispositivos'
  loop
    execute format('drop policy %I on public.push_dispositivos', pol.policyname);
  end loop;
end $$;

alter table public.push_dispositivos enable row level security;

commit;

notify pgrst, 'reload schema';
