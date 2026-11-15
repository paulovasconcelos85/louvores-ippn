-- Segunda rodada do linter (06/11/2026): funções SECURITY DEFINER executáveis
-- por usuários logados (authenticated).
--
-- Ficam executáveis por authenticated, de propósito (o aviso continua):
--   * funções usadas em políticas RLS ou views (can_manage_church,
--     current_person_id, is_admin, tem_acesso_louvor, usuario_tem_acesso_igreja...),
--     porque a política roda com as permissões de quem consulta;
--   * funções chamadas por funções que não são SECURITY DEFINER.
--
-- O app iOS foi descontinuado, então as RPCs que só ele chamava
-- (claim_access_user_by_email, self_service_upsert_access_user,
-- email_permitido) também são fechadas.

begin;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (
        -- Funções de trigger: disparar o trigger não exige EXECUTE.
        p.prorettype = 'trigger'::regtype
        -- RPCs administrativas/internas que o app web não chama (só o servidor).
        or p.proname in (
          'admin_create_access_user', 'admin_set_user_church_access',
          'admin_set_user_tag_for_church', 'admin_upsert_access_user',
          'enqueue_notifications_for_scale_assignments', 'enqueue_push_notification',
          'resolve_notification_igreja_id', 'sincronizar_acesso_pessoa_por_email',
          'active_access_count_for_church', 'can_add_active_access_for_church',
          'handle_new_user', 'claim_access_user_by_email',
          'self_service_upsert_access_user', 'email_permitido'
        )
      )
      and not exists (
        select 1
        from pg_policies pol
        where coalesce(pol.qual, '') ~ ('\m' || p.proname || '\s*\(')
           or coalesce(pol.with_check, '') ~ ('\m' || p.proname || '\s*\(')
      )
      and not exists (
        select 1
        from pg_views v
        where v.schemaname = 'public'
          and v.definition ~ ('\m' || p.proname || '\s*\(')
      )
      and not exists (
        select 1
        from pg_proc caller
        join pg_namespace cn on cn.oid = caller.pronamespace
        where cn.nspname = 'public'
          and not caller.prosecdef
          and caller.oid <> p.oid
          and caller.prosrc ~ ('\m' || p.proname || '\s*\(')
      )
  loop
    raise notice 'revogando authenticated: %', r.fn;
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
