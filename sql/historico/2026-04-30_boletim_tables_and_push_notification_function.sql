create extension if not exists pgcrypto;

create table if not exists public.boletim_secoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  culto_id bigint not null,
  tipo text not null,
  titulo text not null,
  titulo_i18n jsonb,
  icone text,
  ordem integer not null default 0,
  visivel boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.boletim_itens (
  id uuid primary key default gen_random_uuid(),
  secao_id uuid not null references public.boletim_secoes(id) on delete cascade,
  conteudo text not null,
  conteudo_i18n jsonb,
  destaque boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists boletim_secoes_igreja_culto_ordem_idx
  on public.boletim_secoes (igreja_id, culto_id, ordem);

create index if not exists boletim_itens_secao_ordem_idx
  on public.boletim_itens (secao_id, ordem);

create or replace function public.usuario_tem_acesso_igreja(p_igreja_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.usuarios_acesso ua
    where ua.auth_user_id = auth.uid()
      and ua.ativo is true
      and (
        ua.igreja_id = p_igreja_id
        or exists (
          select 1
          from public.usuarios_igrejas ui
          where ui.usuario_id = ua.id
            and ui.igreja_id = p_igreja_id
            and ui.ativo is true
        )
      )
  );
$$;

alter table public.boletim_secoes enable row level security;
alter table public.boletim_itens enable row level security;

drop policy if exists "boletim_secoes_select_por_igreja" on public.boletim_secoes;
create policy "boletim_secoes_select_por_igreja"
  on public.boletim_secoes
  for select
  to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "boletim_secoes_insert_por_igreja" on public.boletim_secoes;
create policy "boletim_secoes_insert_por_igreja"
  on public.boletim_secoes
  for insert
  to authenticated
  with check (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "boletim_secoes_update_por_igreja" on public.boletim_secoes;
create policy "boletim_secoes_update_por_igreja"
  on public.boletim_secoes
  for update
  to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id))
  with check (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "boletim_secoes_delete_por_igreja" on public.boletim_secoes;
create policy "boletim_secoes_delete_por_igreja"
  on public.boletim_secoes
  for delete
  to authenticated
  using (public.usuario_tem_acesso_igreja(igreja_id));

drop policy if exists "boletim_itens_select_por_secao" on public.boletim_itens;
create policy "boletim_itens_select_por_secao"
  on public.boletim_itens
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.boletim_secoes bs
      where bs.id = secao_id
        and public.usuario_tem_acesso_igreja(bs.igreja_id)
    )
  );

drop policy if exists "boletim_itens_insert_por_secao" on public.boletim_itens;
create policy "boletim_itens_insert_por_secao"
  on public.boletim_itens
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.boletim_secoes bs
      where bs.id = secao_id
        and public.usuario_tem_acesso_igreja(bs.igreja_id)
    )
  );

drop policy if exists "boletim_itens_update_por_secao" on public.boletim_itens;
create policy "boletim_itens_update_por_secao"
  on public.boletim_itens
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.boletim_secoes bs
      where bs.id = secao_id
        and public.usuario_tem_acesso_igreja(bs.igreja_id)
    )
  )
  with check (
    exists (
      select 1
      from public.boletim_secoes bs
      where bs.id = secao_id
        and public.usuario_tem_acesso_igreja(bs.igreja_id)
    )
  );

drop policy if exists "boletim_itens_delete_por_secao" on public.boletim_itens;
create policy "boletim_itens_delete_por_secao"
  on public.boletim_itens
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.boletim_secoes bs
      where bs.id = secao_id
        and public.usuario_tem_acesso_igreja(bs.igreja_id)
    )
  );

alter table public.louvor_itens
  add column if not exists conteudo_publico_i18n jsonb;

alter table public.boletim_secoes
  add column if not exists titulo_i18n jsonb;

alter table public.boletim_itens
  add column if not exists conteudo_i18n jsonb;

update public.louvor_itens
set conteudo_publico_i18n = jsonb_build_object('pt', conteudo_publico)
where coalesce(conteudo_publico, '') <> ''
  and (
    conteudo_publico_i18n is null
    or conteudo_publico_i18n = '{}'::jsonb
  );

update public.boletim_secoes
set titulo_i18n = jsonb_build_object('pt', titulo)
where coalesce(titulo, '') <> ''
  and (
    titulo_i18n is null
    or titulo_i18n = '{}'::jsonb
  );

update public.boletim_itens
set conteudo_i18n = jsonb_build_object('pt', conteudo)
where coalesce(conteudo, '') <> ''
  and (
    conteudo_i18n is null
    or conteudo_i18n = '{}'::jsonb
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null default gen_random_uuid(),
  igreja_id uuid references public.igrejas(id) on delete cascade,
  usuario_acesso_id uuid references public.usuarios_acesso(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text not null,
  payload jsonb not null default '{}'::jsonb,
  deep_link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
declare
  v_event_id_type text;
begin
  alter table public.notifications
    drop constraint if exists notifications_event_id_fkey;

  select format_type(a.atttypid, a.atttypmod)
  into v_event_id_type
  from pg_attribute a
  where a.attrelid = 'public.notifications'::regclass
    and a.attname = 'event_id'
    and not a.attisdropped;

  if v_event_id_type is null then
    alter table public.notifications
      add column event_id uuid not null default gen_random_uuid();
  elsif v_event_id_type = 'uuid' then
    update public.notifications
    set event_id = gen_random_uuid()
    where event_id is null;

    alter table public.notifications
      alter column event_id set default gen_random_uuid();
  elsif v_event_id_type = 'text' then
    update public.notifications
    set event_id = gen_random_uuid()::text
    where event_id is null;

    alter table public.notifications
      alter column event_id set default gen_random_uuid()::text;
  end if;
end $$;

alter table public.notifications
  alter column igreja_id drop not null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  canal text not null default 'push',
  status text not null default 'pending',
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  tentativas integer not null default 0,
  last_error text,
  provider text,
  provider_message_id text,
  destino text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (igreja_id, usuario_acesso_id, tipo, read_at);

create index if not exists notification_deliveries_pending_idx
  on public.notification_deliveries (status, canal, scheduled_at);

create or replace function public.resolve_notification_igreja_id(
  p_usuario_acesso_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_igreja_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_igreja_id uuid;
begin
  if p_igreja_id is not null then
    return p_igreja_id;
  end if;

  if p_payload ? 'igreja_id' then
    begin
      v_igreja_id := nullif(p_payload->>'igreja_id', '')::uuid;
      if v_igreja_id is not null then
        return v_igreja_id;
      end if;
    exception when invalid_text_representation then
      v_igreja_id := null;
    end;
  end if;

  select ua.igreja_id
  into v_igreja_id
  from public.usuarios_acesso ua
  where ua.id = p_usuario_acesso_id
  limit 1;

  if v_igreja_id is not null then
    return v_igreja_id;
  end if;

  select ui.igreja_id
  into v_igreja_id
  from public.usuarios_igrejas ui
  where ui.usuario_id = p_usuario_acesso_id
    and ui.ativo is true
  order by ui.igreja_id
  limit 1;

  return v_igreja_id;
end;
$$;

create or replace function public.enqueue_push_notification(
  p_tipo text,
  p_igreja_id uuid,
  p_usuario_acesso_id uuid,
  p_titulo text,
  p_payload jsonb default '{}'::jsonb,
  p_corpo text default '',
  p_deep_link text default null,
  p_delay_seconds bigint default 0,
  p_canal text default 'push'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
  v_igreja_id uuid;
begin
  if p_usuario_acesso_id is null then
    return null;
  end if;

  v_igreja_id := public.resolve_notification_igreja_id(
    p_usuario_acesso_id,
    p_payload,
    p_igreja_id
  );

  insert into public.notifications (
    igreja_id,
    usuario_acesso_id,
    tipo,
    titulo,
    corpo,
    payload,
    deep_link
  )
  values (
    v_igreja_id,
    p_usuario_acesso_id,
    p_tipo,
    coalesce(nullif(p_titulo, ''), 'Notificação'),
    coalesce(p_corpo, ''),
    coalesce(p_payload, '{}'::jsonb),
    p_deep_link
  )
  returning id into v_notification_id;

  insert into public.notification_deliveries (
    notification_id,
    canal,
    status,
    scheduled_at
  )
  values (
    v_notification_id,
    coalesce(nullif(p_canal, ''), 'push'),
    'pending',
    now() + make_interval(secs => greatest(coalesce(p_delay_seconds, 0), 0)::integer)
  );

  return v_notification_id;
end;
$$;

create or replace function public.enqueue_push_notification(
  p_tipo text,
  p_usuario_acesso_id uuid,
  p_titulo text,
  p_corpo text,
  p_payload jsonb default '{}'::jsonb,
  p_deep_link text default null,
  p_igreja_id uuid default null,
  p_delay_seconds bigint default 0,
  p_canal text default 'push'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja_id uuid;
begin
  if p_usuario_acesso_id is null then
    return null;
  end if;

  v_igreja_id := public.resolve_notification_igreja_id(
    p_usuario_acesso_id,
    p_payload,
    p_igreja_id
  );

  return public.enqueue_push_notification(
    p_tipo,
    v_igreja_id,
    p_usuario_acesso_id,
    p_titulo,
    p_payload,
    p_corpo,
    p_deep_link,
    p_delay_seconds,
    p_canal
  );
end;
$$;

create or replace function public.enqueue_push_notification(
  p_tipo text,
  p_usuario_acesso_id uuid,
  p_titulo text,
  p_corpo text,
  p_payload jsonb,
  p_deep_link text,
  p_locale text,
  p_delay_seconds bigint,
  p_canal text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja_id uuid;
begin
  if p_usuario_acesso_id is null then
    return null;
  end if;

  v_igreja_id := public.resolve_notification_igreja_id(
    p_usuario_acesso_id,
    p_payload,
    null
  );

  return public.enqueue_push_notification(
    p_tipo,
    v_igreja_id,
    p_usuario_acesso_id,
    p_titulo,
    case
      when p_locale is null or p_locale = '' then coalesce(p_payload, '{}'::jsonb)
      else coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('locale', p_locale)
    end,
    p_corpo,
    p_deep_link,
    p_delay_seconds,
    p_canal
  );
end;
$$;

create or replace function public.enqueue_push_notification(
  p_tipo text,
  p_usuario_acesso_id uuid,
  p_titulo text,
  p_corpo text,
  p_payload jsonb,
  p_deep_link text,
  p_delay_seconds bigint,
  p_canal text
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.enqueue_push_notification(
    p_tipo,
    p_usuario_acesso_id,
    p_titulo,
    p_corpo,
    p_payload,
    p_deep_link,
    null::uuid,
    p_delay_seconds,
    p_canal
  );
$$;
