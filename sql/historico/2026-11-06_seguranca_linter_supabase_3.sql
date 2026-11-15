-- Terceira rodada do linter (06/11/2026): tem_acesso_louvor() e
-- current_access_user_id() ainda executáveis por anon.
--
-- As duas dependem de auth.uid(); para anon devolvem false/null, então uma
-- política que só as usa nunca libera nada para anon. Passar essas políticas
-- para "to authenticated" não muda o comportamento e permite revogar o EXECUTE
-- de anon.
--
-- Políticas que combinam a função com OR (ex.: "tem_acesso_louvor() or
-- publicado") podem liberar linhas para anon pelo outro lado do OR (a página
-- pública /escala/[id] lê escalas sem login). Essas são puladas e listadas
-- via NOTICE; nesse caso a função continua executável por anon.

begin;

do $$
declare
  pol record;
  fn text;
begin
  for pol in
    select schemaname, tablename, policyname,
           coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
    from pg_policies
    where roles && array['anon', 'public']::name[]
      and (
        coalesce(qual, '') || ' ' || coalesce(with_check, '')
      ) ~ '\m(tem_acesso_louvor|current_access_user_id)\s*\('
  loop
    if pol.expr ~* '\mor\M' then
      raise notice 'mantida (usa OR): %.% / %', pol.schemaname, pol.tablename, pol.policyname;
    else
      raise notice 'para authenticated: %.% / %', pol.schemaname, pol.tablename, pol.policyname;
      execute format('alter policy %I on %I.%I to authenticated',
        pol.policyname, pol.schemaname, pol.tablename);
    end if;
  end loop;

  foreach fn in array array['tem_acesso_louvor', 'current_access_user_id'] loop
    if not exists (
      select 1
      from pg_policies
      where roles && array['anon', 'public']::name[]
        and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ ('\m' || fn || '\s*\(')
    ) then
      execute format('revoke execute on function public.%I() from public, anon', fn);
      execute format('grant execute on function public.%I() to authenticated, service_role', fn);
    end if;
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
