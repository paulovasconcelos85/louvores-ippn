-- Correções dos alertas de segurança do linter do Supabase (06/11/2026).
--
-- Premissas verificadas no código do app web:
--   * Rotas de API (src/app/api/**) usam SUPABASE_SERVICE_ROLE_KEY, que ignora RLS.
--   * O navegador (anon key + sessão) lê diretamente apenas: igrejas,
--     hinario_novo_cantico, canticos_unificados, modelos_liturgia e
--     relacionamentos (este último também com upsert/delete).
--   * O app web não chama nenhuma RPC (.rpc) — as funções SECURITY DEFINER
--     não precisam ser executáveis por anon.
--
-- ATENÇÃO: se o app iOS acessar tabelas/RPCs diretamente como anon, revisar
-- os itens 5 e 7 antes de aplicar.

begin;

-- 1. search_path fixo nas funções apontadas (todas as sobrecargas).
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_pedidos_pastorais_updated_at', 'set_push_dispositivos_updated_at',
        'set_push_notificacoes_fila_updated_at', 'email_permitido', 'is_musico',
        'get_tipo_inverso', 'fn_relacionamento_inverso', 'set_updated_at',
        'notification_channel_enabled', 'enqueue_notification_delivery',
        'create_notification_event', 'handle_new_user', 'marcar_convites_expirados',
        'update_pessoas_updated_at', 'sync_pessoas_igrejas_updated_at',
        'update_notas_pastorais_updated_at', 'is_admin', 'verificar_email_permitido',
        'ranking_canticos'
      )
  loop
    execute format('alter function %s set search_path = public, extensions', f);
  end loop;
end $$;

-- 2. Funções que gravam em tabelas internas (que passam a ter RLS sem
--    políticas) rodam como dono, para que triggers disparados por usuários
--    logados continuem funcionando.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not p.prosecdef
      and p.prokind = 'f'
      and p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?(audit_log|notification_events|notification_preferences|convites_acesso)\b'
  loop
    raise notice 'security definer: %', f;
    execute format('alter function %s security definer set search_path = public, extensions', f);
  end loop;
end $$;

-- 3. RLS nas tabelas públicas.

-- 3a. Tabelas só usadas pelo servidor (service role): RLS sem políticas
--     bloqueia anon/authenticated.
alter table public.audit_log enable row level security;
alter table public.convites_acesso enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.igreja_cultos enable row level security;
alter table public.igreja_redes_sociais enable row level security;
alter table public.modelo_culto_padrao enable row level security;

-- 3b. igrejas: leitura pública (nome/slug/apresentação já aparecem nos
--     boletins públicos e em /escala/[id]); escrita só pelo servidor.
alter table public.igrejas enable row level security;

drop policy if exists "igrejas_select_publico" on public.igrejas;
create policy "igrejas_select_publico"
  on public.igrejas
  for select
  to anon, authenticated
  using (true);

-- 3c. hinario_novo_cantico: catálogo público, somente leitura.
alter table public.hinario_novo_cantico enable row level security;

drop policy if exists "hinario_novo_cantico_select_publico" on public.hinario_novo_cantico;
create policy "hinario_novo_cantico_select_publico"
  on public.hinario_novo_cantico
  for select
  to anon, authenticated
  using (true);

-- 3d. modelos_liturgia: leitura pelos usuários da igreja; escrita pelo servidor.
alter table public.modelos_liturgia enable row level security;

drop policy if exists "modelos_liturgia_select_por_igreja" on public.modelos_liturgia;
create policy "modelos_liturgia_select_por_igreja"
  on public.modelos_liturgia
  for select
  to authenticated
  using (igreja_id is null or public.usuario_tem_acesso_igreja(igreja_id));

-- 3e. relacionamentos: CRUD pelo navegador (RelacionamentosCard), limitado a
--     pessoas vinculadas a uma igreja que o usuário acessa.
create or replace function public.usuario_tem_acesso_pessoa(p_pessoa_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.pessoas_igrejas pi
    where pi.pessoa_id = p_pessoa_id
      and public.usuario_tem_acesso_igreja(pi.igreja_id)
  );
$$;

revoke execute on function public.usuario_tem_acesso_pessoa(uuid) from public, anon;
grant execute on function public.usuario_tem_acesso_pessoa(uuid) to authenticated, service_role;

alter table public.relacionamentos enable row level security;

drop policy if exists "relacionamentos_select_por_igreja" on public.relacionamentos;
create policy "relacionamentos_select_por_igreja"
  on public.relacionamentos
  for select
  to authenticated
  using (public.usuario_tem_acesso_pessoa(pessoa_id));

drop policy if exists "relacionamentos_insert_por_igreja" on public.relacionamentos;
create policy "relacionamentos_insert_por_igreja"
  on public.relacionamentos
  for insert
  to authenticated
  with check (
    public.usuario_tem_acesso_pessoa(pessoa_id)
    and public.usuario_tem_acesso_pessoa(pessoa_relacionada_id)
  );

drop policy if exists "relacionamentos_update_por_igreja" on public.relacionamentos;
create policy "relacionamentos_update_por_igreja"
  on public.relacionamentos
  for update
  to authenticated
  using (public.usuario_tem_acesso_pessoa(pessoa_id))
  with check (
    public.usuario_tem_acesso_pessoa(pessoa_id)
    and public.usuario_tem_acesso_pessoa(pessoa_relacionada_id)
  );

drop policy if exists "relacionamentos_delete_por_igreja" on public.relacionamentos;
create policy "relacionamentos_delete_por_igreja"
  on public.relacionamentos
  for delete
  to authenticated
  using (public.usuario_tem_acesso_pessoa(pessoa_id));

-- 4. Views passam a respeitar as permissões/RLS de quem consulta.
do $$
declare
  v text;
begin
  foreach v in array array[
    'canticos_unificados', 'igrejas_endereco_view', 'vw_cultos_com_escalas',
    'vw_cultos_incompletos', 'vw_ranking_tons', 'vw_estatisticas_canticos',
    'vw_evolucao_mensal', 'vw_execucoes_louvores', 'view_familias'
  ]
  loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v);
    end if;
  end loop;
end $$;

-- 5. pessoas: o cadastro público passa pela API (/api/cadastro-publico, service
--    role); o navegador não insere pessoas diretamente, e o vínculo com a
--    igreja fica em pessoas_igrejas, então não há o que checar no INSERT.
drop policy if exists "pessoas_insert_public" on public.pessoas;

-- 6. Bucket público não precisa de SELECT amplo para servir URLs públicas;
--    o upload (upsert: false) usa só a política de INSERT.
drop policy if exists "Allow public to view 1uuagf2_0" on storage.objects;

-- 7. Funções SECURITY DEFINER deixam de ser executáveis por anon.
--    Mantidas: as usadas em políticas RLS que valem para anon/public (senão
--    essas leituras quebram) e email_permitido (checagem pré-login).
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
      and p.proname <> 'email_permitido'
      and not exists (
        select 1
        from pg_policies pol
        where (pol.roles && array['anon', 'public']::name[])
          and (
            coalesce(pol.qual, '') ~ ('\m' || p.proname || '\s*\(')
            or coalesce(pol.with_check, '') ~ ('\m' || p.proname || '\s*\(')
          )
      )
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated, service_role', r.fn);
  end loop;
end $$;

-- Novas funções criadas em public não ficam executáveis por anon por padrão.
alter default privileges in schema public revoke execute on functions from public, anon;

commit;

notify pgrst, 'reload schema';
