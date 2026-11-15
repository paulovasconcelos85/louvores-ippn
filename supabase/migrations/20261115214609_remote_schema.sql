


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."cargo_tipo" AS ENUM (
    'superadmin',
    'pastor',
    'seminarista',
    'presbitero',
    'diacono',
    'secretario',
    'tesoureiro',
    'membro',
    'congregado',
    'visitante',
    'admin',
    'staff',
    'musico'
);


ALTER TYPE "public"."cargo_tipo" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'in_app',
    'push',
    'email',
    'whatsapp',
    'web_push'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_status" AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."notification_status" OWNER TO "postgres";


CREATE TYPE "public"."sexo_tipo" AS ENUM (
    'M',
    'F'
);


ALTER TYPE "public"."sexo_tipo" OWNER TO "postgres";


CREATE TYPE "public"."status_convite" AS ENUM (
    'pendente',
    'aceito',
    'expirado',
    'cancelado'
);


ALTER TYPE "public"."status_convite" OWNER TO "postgres";


CREATE TYPE "public"."tipo_liturgia" AS ENUM (
    'Prelúdio',
    'Cântico',
    'Oferta',
    'Ceia',
    'Salmo',
    'Pregação',
    'Pósludio',
    'Saudação e Acolhida',
    'Cânticos Congregacionais',
    'Confissão de Pecados',
    'Dízimos e Ofertas',
    'Cântico para as Ofertas',
    'Oração pelas Crianças',
    'Pregação da Palavra',
    'Cântico Final',
    'Lembretes',
    'Oração'
);


ALTER TYPE "public"."tipo_liturgia" OWNER TO "postgres";


CREATE TYPE "public"."tipo_relacionamento" AS ENUM (
    'conjuge',
    'pai',
    'mae',
    'filho',
    'filha',
    'irmao',
    'irma',
    'avo_paterno',
    'avo_paterna',
    'avo_materno',
    'avo_materna',
    'neto',
    'neta',
    'cunhado',
    'cunhada',
    'sogro',
    'sogra',
    'genro',
    'nora',
    'tio',
    'tia',
    'sobrinho',
    'sobrinha',
    'primo',
    'prima'
);


ALTER TYPE "public"."tipo_relacionamento" OWNER TO "postgres";


CREATE TYPE "public"."tom_musical" AS ENUM (
    'C',
    'C#',
    'Db',
    'D',
    'D#',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'G#',
    'Ab',
    'A',
    'A#',
    'Bb',
    'B',
    'Cm',
    'C#m',
    'Dm',
    'D#m',
    'Em',
    'Fm',
    'F#m',
    'Gm',
    'G#m',
    'Am',
    'A#m',
    'Bm'
);


ALTER TYPE "public"."tom_musical" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."active_access_count_for_church"("p_igreja_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select count(*)::integer
    from public.usuarios_igrejas ui
    where ui.igreja_id = p_igreja_id
      and ui.ativo = true
$$;


ALTER FUNCTION "public"."active_access_count_for_church"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_access_user"("p_igreja_id" "uuid", "p_email" "text", "p_nome" "text" DEFAULT NULL::"text", "p_telefone" "text" DEFAULT NULL::"text", "p_cargo" "public"."cargo_tipo" DEFAULT 'membro'::"public"."cargo_tipo", "p_pessoa_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_access_user_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Usuário autenticado é obrigatório';
    end if;

    if not exists (
        select 1
        from public.usuarios_acesso ua
        join public.usuarios_igrejas ui
          on ui.usuario_id = ua.id
        where ua.auth_user_id = auth.uid()
          and ui.igreja_id = p_igreja_id
          and ui.ativo = true
          and ui.cargo in ('superadmin', 'pastor', 'presbitero', 'seminarista', 'secretario')
    ) then
        raise exception 'Sem permissão para gerenciar usuários desta igreja';
    end if;

    insert into public.usuarios_acesso (
        email,
        nome,
        telefone,
        ativo,
        criado_por,
        pessoa_id
    )
    values (
        lower(trim(p_email)),
        nullif(trim(p_nome), ''),
        nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
        true,
        auth.uid(),
        p_pessoa_id
    )
    on conflict (email)
    do update
    set nome = excluded.nome,
        telefone = excluded.telefone,
        pessoa_id = coalesce(public.usuarios_acesso.pessoa_id, excluded.pessoa_id),
        atualizado_em = now()
    returning id into v_access_user_id;

    insert into public.usuarios_igrejas (
        usuario_id,
        igreja_id,
        cargo,
        ativo
    )
    values (
        v_access_user_id,
        p_igreja_id,
        p_cargo,
        true
    )
    on conflict do nothing;

    return v_access_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_create_access_user"("p_igreja_id" "uuid", "p_email" "text", "p_nome" "text", "p_telefone" "text", "p_cargo" "public"."cargo_tipo", "p_pessoa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_church_access"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_cargo" "public"."cargo_tipo", "p_ativo" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if auth.uid() is null then
        raise exception 'Usuário autenticado é obrigatório';
    end if;

    if not public.can_manage_church(p_igreja_id) then
        raise exception 'Sem permissão para gerenciar esta igreja';
    end if;

    if p_ativo = true and not public.can_add_active_access_for_church(p_igreja_id) then
        if not exists (
            select 1
            from public.usuarios_igrejas
            where usuario_id = p_usuario_id
              and igreja_id = p_igreja_id
              and ativo = true
        ) then
            raise exception 'Limite do plano grátis atingido: esta igreja já possui 5 usuários com acesso ativo. Apenas o superadmin pode liberar mais acessos.';
        end if;
    end if;

    insert into public.usuarios_igrejas (
        usuario_id,
        igreja_id,
        cargo,
        ativo
    )
    values (
        p_usuario_id,
        p_igreja_id,
        p_cargo,
        p_ativo
    )
    on conflict (usuario_id, igreja_id)
    do update set
        cargo = excluded.cargo,
        ativo = excluded.ativo;
end;
$$;


ALTER FUNCTION "public"."admin_set_user_church_access"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_cargo" "public"."cargo_tipo", "p_ativo" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_tag_for_church"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_tag_id" "uuid", "p_habilitado" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if auth.uid() is null then
        raise exception 'Usuário autenticado é obrigatório';
    end if;

    if not public.can_manage_church(p_igreja_id) then
        raise exception 'Sem permissão para gerenciar esta igreja';
    end if;

    if p_habilitado then
        insert into public.usuarios_tags (
            usuario_id,
            igreja_id,
            tag_id,
            nivel_habilidade
        )
        values (
            p_usuario_id,
            p_igreja_id,
            p_tag_id,
            1
        )
        on conflict do nothing;
    else
        delete from public.usuarios_tags
        where usuario_id = p_usuario_id
          and igreja_id = p_igreja_id
          and tag_id = p_tag_id;
    end if;
end;
$$;


ALTER FUNCTION "public"."admin_set_user_tag_for_church"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_tag_id" "uuid", "p_habilitado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_access_user"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_nome" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_telefone" "text" DEFAULT NULL::"text", "p_pessoa_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_user_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Usuário autenticado é obrigatório';
    end if;

    if not public.can_manage_any_church() then
        raise exception 'Sem permissão para gerenciar usuários';
    end if;

    if p_user_id is null then
        insert into public.usuarios_acesso (
            nome,
            email,
            telefone,
            ativo,
            pessoa_id,
            criado_por
        )
        values (
            nullif(trim(p_nome), ''),
            lower(trim(p_email)),
            nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
            true,
            p_pessoa_id,
            auth.uid()
        )
        on conflict (email)
        do update set
            nome = excluded.nome,
            telefone = excluded.telefone,
            pessoa_id = coalesce(public.usuarios_acesso.pessoa_id, excluded.pessoa_id),
            atualizado_em = now()
        returning id into v_user_id;
    else
        update public.usuarios_acesso
        set nome = nullif(trim(p_nome), ''),
            email = lower(trim(p_email)),
            telefone = nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
            pessoa_id = coalesce(p_pessoa_id, pessoa_id),
            atualizado_em = now()
        where id = p_user_id
        returning id into v_user_id;
    end if;

    return v_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_upsert_access_user"("p_user_id" "uuid", "p_nome" "text", "p_email" "text", "p_telefone" "text", "p_pessoa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_eventos_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_eventos_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_oikos_leads_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_oikos_leads_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_recursos_multimidia_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_recursos_multimidia_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_add_active_access_for_church"("p_igreja_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select
        public.is_global_admin()
        or public.active_access_count_for_church(p_igreja_id) < 5
$$;


ALTER FUNCTION "public"."can_add_active_access_for_church"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_any_church"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.usuarios_acesso ua
    join public.usuarios_igrejas ui on ui.usuario_id = ua.id
    where ua.auth_user_id = auth.uid()
      and coalesce(ua.ativo, true) = true
      and ui.ativo = true
      and ui.cargo = any (
        array[
          'superadmin'::cargo_tipo,
          'pastor'::cargo_tipo,
          'presbitero'::cargo_tipo,
          'seminarista'::cargo_tipo
        ]
      )
  );
$$;


ALTER FUNCTION "public"."can_manage_any_church"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_church"("p_igreja_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.usuarios_acesso ua
    join public.usuarios_igrejas ui on ui.usuario_id = ua.id
    where ua.auth_user_id = auth.uid()
      and coalesce(ua.ativo, true) = true
      and ui.ativo = true
      and ui.igreja_id = p_igreja_id
      and ui.cargo = any (
        array[
          'superadmin'::cargo_tipo,
          'pastor'::cargo_tipo,
          'presbitero'::cargo_tipo,
          'seminarista'::cargo_tipo
        ]
      )
  );
$$;


ALTER FUNCTION "public"."can_manage_church"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_access_user_by_email"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_email text;
begin
    select lower(u.email)
    into v_email
    from auth.users u
    where u.id = auth.uid();

    if v_email is null then
        return;
    end if;

    update public.usuarios_acesso
    set auth_user_id = auth.uid(),
        atualizado_em = now()
    where lower(email) = v_email
      and auth_user_id is null;
end;
$$;


ALTER FUNCTION "public"."claim_access_user_by_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_event"("p_tipo" "text", "p_igreja_id" "uuid", "p_entidade_tipo" "text", "p_entidade_id" "text", "p_chave_deduplicacao" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
    v_event_id uuid;
begin
    insert into public.notification_events (
        tipo,
        igreja_id,
        entidade_tipo,
        entidade_id,
        chave_deduplicacao,
        payload
    )
    values (
        p_tipo,
        p_igreja_id,
        p_entidade_tipo,
        p_entidade_id,
        p_chave_deduplicacao,
        coalesce(p_payload, '{}'::jsonb)
    )
    on conflict (chave_deduplicacao) do update
    set payload = excluded.payload
    returning id into v_event_id;

    return v_event_id;
end;
$$;


ALTER FUNCTION "public"."create_notification_event"("p_tipo" "text", "p_igreja_id" "uuid", "p_entidade_tipo" "text", "p_entidade_id" "text", "p_chave_deduplicacao" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_access_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select ua.id
  from public.usuarios_acesso ua
  where ua.auth_user_id = auth.uid()
    and coalesce(ua.ativo, true) = true
  limit 1;
$$;


ALTER FUNCTION "public"."current_access_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_global_role"() RETURNS "public"."cargo_tipo"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select p.cargo
    from public.pessoas p
    where p.usuario_id = auth.uid()
    limit 1
$$;


ALTER FUNCTION "public"."current_global_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_person_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select ua.pessoa_id
      from public.usuarios_acesso ua
      where ua.auth_user_id = auth.uid()
      limit 1
    ),
    (
      select p.id
      from public.pessoas p
      where p.usuario_id = auth.uid()
      limit 1
    )
  );
$$;


ALTER FUNCTION "public"."current_person_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eh_membro_igreja"("p_igreja_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.usuario_tem_acesso_igreja(p_igreja_id)
    or exists (
      select 1
      from public.usuarios_acesso ua
      join public.pessoas_igrejas pi
        on pi.pessoa_id = ua.pessoa_id
       and pi.igreja_id = p_igreja_id
      where ua.auth_user_id = auth.uid()
        and coalesce(ua.ativo, true) = true
        and coalesce(pi.ativo, true) = true
    );
$$;


ALTER FUNCTION "public"."eh_membro_igreja"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_permitido"("email_check" character varying) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$ SELECT true $$;


ALTER FUNCTION "public"."email_permitido"("email_check" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_notification_delivery"("p_notification_id" "uuid", "p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel", "p_destino" "text" DEFAULT NULL::"text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_force" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
    if not p_force and not public.notification_channel_enabled(
        p_usuario_acesso_id,
        p_igreja_id,
        p_tipo,
        p_canal
    ) then
        return;
    end if;

    insert into public.notification_deliveries (
        notification_id,
        canal,
        destino,
        payload
    )
    values (
        p_notification_id,
        p_canal,
        p_destino,
        coalesce(p_payload, '{}'::jsonb)
    )
    on conflict (notification_id, canal) do nothing;
end;
$$;


ALTER FUNCTION "public"."enqueue_notification_delivery"("p_notification_id" "uuid", "p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel", "p_destino" "text", "p_payload" "jsonb", "p_force" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_notifications_for_scale_assignments"("p_escala_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    escala_row record;
    funcao_row record;
begin
    select e.id, e.igreja_id, e.data, e.hora_inicio, e.status
    into escala_row
    from public.escalas e
    where e.id = p_escala_id;

    if escala_row.id is null or escala_row.status is distinct from 'publicada' then
        return;
    end if;

    for funcao_row in
        select
            ef.pessoa_id,
            coalesce(tf.nome, 'Ministério') as funcao_nome
        from public.escalas_funcoes ef
        left join public.tags_funcoes tf
            on tf.id = ef.tag_id
        where ef.escala_id = p_escala_id
          and ef.pessoa_id is not null
    loop
        perform public.enqueue_push_notification(
            'escala_publicada_pessoa',
            escala_row.igreja_id,
            'Você foi escalado para tocar',
            'Sua escala do dia ' || escala_row.data || ' às ' || escala_row.hora_inicio || ' já está disponível.',
            jsonb_build_object(
                'kind', 'escala_publicada_pessoa',
                'igreja_id', escala_row.igreja_id,
                'escala_id', escala_row.id,
                'pessoa_id', funcao_row.pessoa_id,
                'funcao', funcao_row.funcao_nome
            ),
            funcao_row.pessoa_id,
            escala_row.id,
            null,
            'escala:' || escala_row.id::text || ':pessoa:' || funcao_row.pessoa_id::text
        );
    end loop;
end;
$$;


ALTER FUNCTION "public"."enqueue_notifications_for_scale_assignments"("p_escala_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_locale" "text", "p_delay_seconds" bigint, "p_canal" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_locale" "text", "p_delay_seconds" bigint, "p_canal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_deep_link" "text" DEFAULT NULL::"text", "p_igreja_id" "uuid" DEFAULT NULL::"uuid", "p_delay_seconds" bigint DEFAULT 0, "p_canal" "text" DEFAULT 'push'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_igreja_id" "uuid", "p_delay_seconds" bigint, "p_canal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_titulo" "text", "p_mensagem" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_pessoa_id" "uuid" DEFAULT NULL::"uuid", "p_escala_id" "uuid" DEFAULT NULL::"uuid", "p_culto_id" integer DEFAULT NULL::integer, "p_chave_deduplicacao" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    insert into public.push_notificacoes_fila (
        tipo,
        igreja_id,
        pessoa_id,
        escala_id,
        culto_id,
        titulo,
        mensagem,
        payload,
        chave_deduplicacao
    )
    values (
        p_tipo,
        p_igreja_id,
        p_pessoa_id,
        p_escala_id,
        p_culto_id,
        p_titulo,
        p_mensagem,
        coalesce(p_payload, '{}'::jsonb),
        p_chave_deduplicacao
    )
    on conflict (chave_deduplicacao) do update
    set
        titulo = excluded.titulo,
        mensagem = excluded.mensagem,
        payload = excluded.payload,
        status = case
            when public.push_notificacoes_fila.status = 'enviada' then public.push_notificacoes_fila.status
            else 'pendente'
        end,
        agendada_para = timezone('utc', now()),
        atualizado_em = timezone('utc', now());
end;
$$;


ALTER FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_titulo" "text", "p_mensagem" "text", "p_payload" "jsonb", "p_pessoa_id" "uuid", "p_escala_id" "uuid", "p_culto_id" integer, "p_chave_deduplicacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_corpo" "text" DEFAULT ''::"text", "p_deep_link" "text" DEFAULT NULL::"text", "p_delay_seconds" bigint DEFAULT 0, "p_canal" "text" DEFAULT 'push'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_payload" "jsonb", "p_corpo" "text", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_relacionamento_inverso"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  tipo_inv public.tipo_relacionamento;
begin
  tipo_inv := public.get_tipo_inverso(NEW.tipo);

  insert into public.relacionamentos (pessoa_id, pessoa_relacionada_id, tipo, criado_por)
  values (NEW.pessoa_relacionada_id, NEW.pessoa_id, tipo_inv, NEW.criado_por)
  on conflict (pessoa_id, pessoa_relacionada_id, tipo) do nothing;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_relacionamento_inverso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tipo_inverso"("tipo" "public"."tipo_relacionamento") RETURNS "public"."tipo_relacionamento"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  return case tipo
    when 'conjuge'      then 'conjuge'
    when 'pai'          then 'filho'
    when 'mae'          then 'filho'
    when 'filho'        then 'pai'
    when 'filha'        then 'pai'
    when 'irmao'        then 'irmao'
    when 'irma'         then 'irmao'
    when 'avo_paterno'  then 'neto'
    when 'avo_paterna'  then 'neto'
    when 'avo_materno'  then 'neto'
    when 'avo_materna'  then 'neto'
    when 'neto'         then 'avo_paterno'
    when 'neta'         then 'avo_paterno'
    when 'cunhado'      then 'cunhado'
    when 'cunhada'      then 'cunhado'
    when 'sogro'        then 'genro'
    when 'sogra'        then 'genro'
    when 'genro'        then 'sogro'
    when 'nora'         then 'sogro'
    when 'tio'          then 'sobrinho'
    when 'tia'          then 'sobrinho'
    when 'sobrinho'     then 'tio'
    when 'sobrinha'     then 'tio'
    when 'primo'        then 'primo'
    when 'prima'        then 'primo'
    else tipo
  end;
end;
$$;


ALTER FUNCTION "public"."get_tipo_inverso"("tipo" "public"."tipo_relacionamento") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM pessoas 
    WHERE usuario_id = auth.uid() 
    AND cargo IN ('superadmin', 'pastor', 'presbitero', 'seminarista')
    AND ativo = true 
    AND tem_acesso = true
  )
  OR
  EXISTS (
    SELECT 1
    FROM pessoas p
    JOIN usuarios_tags ut ON ut.pessoa_id = p.id
    JOIN tags_funcoes tf ON tf.id = ut.tag_id
    WHERE p.usuario_id = auth.uid()
    AND tf.categoria = 'louvor_lideranca'
    AND tf.ativo = true
    AND p.ativo = true
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_global_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.plataforma_admins pa
    join public.usuarios_acesso ua
      on ua.auth_user_id = pa.auth_user_id
     and coalesce(ua.ativo, true) = true
    where pa.auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_global_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_musico"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM pessoas 
    WHERE usuario_id = auth.uid() 
    AND cargo = 'musico'
    AND ativo = true 
    AND tem_acesso = true
  );
$$;


ALTER FUNCTION "public"."is_musico"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marcar_convites_expirados"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  UPDATE convites
  SET status = 'expirado'
  WHERE status = 'pendente'
    AND expira_em < NOW();
END;
$$;


ALTER FUNCTION "public"."marcar_convites_expirados"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notification_channel_enabled"("p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
    select coalesce((
        select np.enabled
        from public.notification_preferences np
        where np.usuario_acesso_id = p_usuario_acesso_id
          and np.igreja_id = p_igreja_id
          and np.tipo = p_tipo
          and np.canal = p_canal
        limit 1
    ), true);
$$;


ALTER FUNCTION "public"."notification_channel_enabled"("p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_boletim_available"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    has_visible_sections boolean;
begin
    if new.visivel is not true then
        return new;
    end if;

    if tg_op = 'UPDATE' and coalesce(old.visivel, false) = true then
        return new;
    end if;

    select exists (
        select 1
        from public.boletim_secoes bs
        where bs.igreja_id = new.igreja_id
          and bs.culto_id = new.culto_id
          and bs.visivel = true
    )
    into has_visible_sections;

    if has_visible_sections then
        perform public.enqueue_push_notification(
            'boletim_disponivel',
            new.igreja_id,
            'Novo boletim disponível',
            'O boletim deste culto já está disponível no app.',
            jsonb_build_object(
                'kind', 'boletim_disponivel',
                'igreja_id', new.igreja_id,
                'culto_id', new.culto_id
            ),
            null,
            null,
            new.culto_id,
            'boletim:' || new.igreja_id::text || ':' || new.culto_id::text
        );
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."notify_boletim_available"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_escala_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_escala record;
    v_usuario public.usuarios_acesso%rowtype;
    v_event_id uuid;
    v_notification_id uuid;
    v_tipo constant text := 'escala.usuario_alistado';
    v_new_row jsonb;
    v_pessoa_id uuid;
    v_corpo text;
    v_payload jsonb;
    v_dedup_key text;
begin
    v_new_row := to_jsonb(new);

    v_pessoa_id := coalesce(
        nullif(v_new_row ->> 'pessoa_id', '')::uuid,
        nullif(v_new_row ->> 'usuario_id', '')::uuid
    );

    if v_pessoa_id is null then
        return new;
    end if;

    select e.id, e.igreja_id, e.titulo, e.data, e.hora_inicio
    into v_escala
    from public.escalas e
    where e.id = new.escala_id;

    if v_escala.id is null then
        return new;
    end if;

    select ua.*
    into v_usuario
    from public.usuarios_acesso ua
    where ua.pessoa_id = v_pessoa_id
      and coalesce(ua.ativo, true) = true
    order by ua.id
    limit 1;

    if v_usuario.id is null then
        return new;
    end if;

    v_payload := jsonb_build_object(
        'escala_id', v_escala.id,
        'escala_funcao_id', new.id,
        'pessoa_id', v_pessoa_id,
        'usuario_acesso_id', v_usuario.id,
        'tag_id', new.tag_id,
        'data', v_escala.data,
        'hora_inicio', v_escala.hora_inicio,
        'titulo', v_escala.titulo,
        'confirmado', coalesce((v_new_row ->> 'confirmado')::boolean, false)
    );

    v_dedup_key := format(
        'escala.usuario_alistado:%s:%s:%s',
        new.escala_id,
        v_pessoa_id,
        coalesce(new.tag_id::text, 'sem_tag')
    );

    v_corpo := format(
        'Culto %s às %sh%s',
        to_char(v_escala.data::date, 'DD/MM/YYYY'),
        to_char(v_escala.hora_inicio::time, 'HH24'),
        to_char(v_escala.hora_inicio::time, 'MI')
    );

    v_event_id := public.create_notification_event(
        v_tipo,
        v_escala.igreja_id,
        'escala_funcao',
        new.id::text,
        v_dedup_key,
        v_payload
    );

    insert into public.notifications (
        event_id,
        igreja_id,
        usuario_acesso_id,
        pessoa_id,
        tipo,
        titulo,
        corpo,
        deep_link,
        payload,
        prioridade
    )
    values (
        v_event_id,
        v_escala.igreja_id,
        v_usuario.id,
        v_pessoa_id,
        v_tipo,
        'Voce foi escalado nesta semana',
        v_corpo,
        'escala:' || v_escala.id::text,
        v_payload,
        5
    )
    on conflict (event_id, usuario_acesso_id, pessoa_id) do nothing
    returning id into v_notification_id;

    if v_notification_id is null then
        return new;
    end if;

    perform public.enqueue_notification_delivery(
        v_notification_id,
        v_usuario.id,
        v_escala.igreja_id,
        v_tipo,
        'in_app',
        null,
        jsonb_build_object('source', 'db_trigger'),
        true
    );

    perform public.enqueue_notification_delivery(
        v_notification_id,
        v_usuario.id,
        v_escala.igreja_id,
        v_tipo,
        'push',
        null,
        jsonb_build_object('source', 'db_trigger')
    );

    return new;
end;
$$;


ALTER FUNCTION "public"."notify_escala_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_pastoral_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_tipo constant text := 'pastoral.resumo_10min';
    v_bucket timestamptz;
    v_bucket_label text;
    v_event_id uuid;
    v_payload jsonb;
    v_user record;
    v_notification_id uuid;
    v_quantidade integer;
begin
    v_bucket := to_timestamp(floor(extract(epoch from timezone('utc', now())) / 600) * 600);
    v_bucket_label := to_char(v_bucket, 'YYYYMMDDHH24MI');

    v_payload := jsonb_build_object(
        'bucket_key', format('pastoral.resumo_10min:%s:%s', new.igreja_id, v_bucket_label),
        'bucket_start', v_bucket,
        'bucket_end', v_bucket + interval '10 minutes',
        'pedido_id', new.id,
        'categoria', new.categoria
    );

    v_event_id := public.create_notification_event(
        v_tipo,
        new.igreja_id,
        'pedido_pastoral',
        new.id::text,
        format('pedido_pastoral:%s', new.id),
        v_payload
    );

    for v_user in
        select distinct ua.id as usuario_acesso_id, ua.pessoa_id
        from public.usuarios_igrejas ui
        join public.usuarios_acesso ua
          on ua.id = ui.usuario_id
        where ui.igreja_id = new.igreja_id
          and ui.ativo = true
          and ui.cargo in ('pastor', 'seminarista')
          and coalesce(ua.ativo, true) = true
          and ua.id is not null
    loop
        v_notification_id := null;

        insert into public.notifications (
            event_id,
            igreja_id,
            usuario_acesso_id,
            pessoa_id,
            tipo,
            titulo,
            corpo,
            deep_link,
            payload,
            prioridade,
            pastoral_bucket
        )
        values (
            v_event_id,
            new.igreja_id,
            v_user.usuario_acesso_id,
            v_user.pessoa_id,
            v_tipo,
            'Novos pedidos pastorais',
            '1 novo pedido aguardando atencao',
            '/admin/pedidos-pastorais',
            jsonb_build_object(
                'quantidade', 1,
                'bucket_key', format('pastoral.resumo_10min:%s:%s', new.igreja_id, v_bucket_label),
                'bucket_start', v_bucket,
                'bucket_end', v_bucket + interval '10 minutes',
                'ultima_categoria', new.categoria
            ),
            7,
            v_bucket
        )
        on conflict (tipo, igreja_id, usuario_acesso_id, pastoral_bucket)
        do update
        set payload = jsonb_build_object(
                'quantidade',
                coalesce((public.notifications.payload ->> 'quantidade')::integer, 0) + 1,
                'bucket_key',
                format('pastoral.resumo_10min:%s:%s', new.igreja_id, v_bucket_label),
                'bucket_start',
                excluded.pastoral_bucket,
                'bucket_end',
                excluded.pastoral_bucket + interval '10 minutes',
                'ultima_categoria',
                new.categoria
            ),
            corpo = format(
                '%s novos pedidos aguardando atencao',
                coalesce((public.notifications.payload ->> 'quantidade')::integer, 0) + 1
            ),
            created_at = timezone('utc', now())
        returning id into v_notification_id;

        if v_notification_id is null then
            continue;
        end if;

        select coalesce((n.payload ->> 'quantidade')::integer, 1)
        into v_quantidade
        from public.notifications n
        where n.id = v_notification_id;

        perform public.enqueue_notification_delivery(
            v_notification_id,
            v_user.usuario_acesso_id,
            new.igreja_id,
            v_tipo,
            'in_app',
            null,
            jsonb_build_object('quantidade', v_quantidade),
            true
        );

        perform public.enqueue_notification_delivery(
            v_notification_id,
            v_user.usuario_acesso_id,
            new.igreja_id,
            v_tipo,
            'push',
            null,
            jsonb_build_object('quantidade', v_quantidade)
        );
    end loop;

    return new;
end;
$$;


ALTER FUNCTION "public"."notify_pastoral_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_scale_assignments_after_upsert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    perform public.enqueue_notifications_for_scale_assignments(new.escala_id);
    return new;
end;
$$;


ALTER FUNCTION "public"."notify_scale_assignments_after_upsert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_scale_published"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if new.status = 'publicada' and coalesce(old.status, '') <> 'publicada' then
        perform public.enqueue_notifications_for_scale_assignments(new.id);
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."notify_scale_published"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pessoa_visivel_em_escala"("p_pessoa_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.escalas_funcoes ef
    join public.escalas e on e.id = ef.escala_id
    where ef.pessoa_id = p_pessoa_id
      and (e.status = 'publicada' or public.tem_acesso_louvor())
      and public.usuario_tem_acesso_igreja(e.igreja_id)
  );
$$;


ALTER FUNCTION "public"."pessoa_visivel_em_escala"("p_pessoa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pode_gerenciar_escalas"("p_igreja_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.usuarios_acesso ua
    join public.pessoas_igrejas pi
      on pi.pessoa_id = ua.pessoa_id
     and pi.igreja_id = p_igreja_id
    where ua.auth_user_id = auth.uid()
      and coalesce(ua.ativo, true) = true
      and coalesce(pi.ativo, true) = true
      and pi.cargo in (
        'superadmin',
        'pastor',
        'presbitero',
        'seminarista'
      )
  );
$$;


ALTER FUNCTION "public"."pode_gerenciar_escalas"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pode_gerenciar_pessoa"("p_pessoa_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.pessoas_igrejas pi
      where pi.pessoa_id = p_pessoa_id
        and public.can_manage_church(pi.igreja_id)
    );
$$;


ALTER FUNCTION "public"."pode_gerenciar_pessoa"("p_pessoa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pode_gerenciar_usuario_acesso"("p_usuario_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.usuarios_acesso ua
      where ua.id = p_usuario_id
        and ua.igreja_id is not null
        and public.can_manage_church(ua.igreja_id)
    )
    or exists (
      select 1
      from public.usuarios_igrejas ui
      where ui.usuario_id = p_usuario_id
        and public.can_manage_church(ui.igreja_id)
    );
$$;


ALTER FUNCTION "public"."pode_gerenciar_usuario_acesso"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ranking_canticos"("p_ano" integer, "p_mes" integer DEFAULT NULL::integer) RETURNS TABLE("cantico" "text", "total" bigint)
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select cantico, count(*) as total
  from vw_execucoes
  where ano = p_ano
    and (p_mes is null or mes = p_mes)
  group by cantico
  order by total desc
  limit 10;
$$;


ALTER FUNCTION "public"."ranking_canticos"("p_ano" integer, "p_mes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_notification_igreja_id"("p_usuario_acesso_id" "uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_igreja_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."resolve_notification_igreja_id"("p_usuario_acesso_id" "uuid", "p_payload" "jsonb", "p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."self_service_upsert_access_user"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_auth_user_id uuid := auth.uid();
    v_email text;
    v_nome text;
    v_telefone text;
    v_foto_url text;
    v_pessoa_id uuid;
    v_usuario_id uuid;
    v_email_access_user_id uuid;
    v_auth_access_user_id uuid;
    v_email_access_user_count integer := 0;
    v_auth_access_user_count integer := 0;
    v_email_pessoa_id uuid;
    v_auth_pessoa_id uuid;
    v_email_pessoa_count integer := 0;
    v_auth_pessoa_count integer := 0;
begin
    if v_auth_user_id is null then
        raise exception 'Usuário autenticado é obrigatório';
    end if;

    select
        lower(nullif(trim(u.email), '')),
        nullif(trim(
            coalesce(
                u.raw_user_meta_data ->> 'full_name',
                u.raw_user_meta_data ->> 'name',
                u.raw_user_meta_data ->> 'display_name',
                u.raw_user_meta_data ->> 'user_name',
                u.raw_user_meta_data ->> 'preferred_username',
                u.raw_user_meta_data ->> 'given_name'
            )
        ), ''),
        nullif(regexp_replace(
            coalesce(
                u.raw_user_meta_data ->> 'phone',
                u.raw_user_meta_data ->> 'phone_number',
                u.phone,
                ''
            ),
            '\D',
            '',
            'g'
        ), ''),
        nullif(trim(
            coalesce(
                u.raw_user_meta_data ->> 'avatar_url',
                u.raw_user_meta_data ->> 'picture',
                u.raw_user_meta_data ->> 'photo_url',
                u.raw_user_meta_data ->> 'image',
                u.raw_user_meta_data ->> 'profile_photo'
            )
        ), '')
    into v_email, v_nome, v_telefone, v_foto_url
    from auth.users u
    where u.id = v_auth_user_id;

    if v_email is null then
        raise exception 'Email do usuário autenticado não encontrado';
    end if;

    select count(*), min(ua.id)
    into v_auth_access_user_count, v_auth_access_user_id
    from public.usuarios_acesso ua
    where ua.auth_user_id = v_auth_user_id;

    if v_auth_access_user_count > 1 then
        raise exception 'Conflito: mais de um usuário de acesso vinculado à conta autenticada';
    end if;

    select count(*), min(ua.id)
    into v_email_access_user_count, v_email_access_user_id
    from public.usuarios_acesso ua
    where lower(ua.email) = v_email;

    if v_email_access_user_count > 1 then
        raise exception 'Conflito: mais de um usuário de acesso com este email';
    end if;

    if v_email_access_user_id is not null and v_auth_access_user_id is not null and v_email_access_user_id <> v_auth_access_user_id then
        raise exception 'Conflito: conta autenticada já está associada a outro usuário de acesso';
    end if;

    if exists (
        select 1
        from public.usuarios_acesso ua
        where ua.id = v_email_access_user_id
          and ua.auth_user_id is not null
          and ua.auth_user_id <> v_auth_user_id
    ) then
        raise exception 'Conflito: email já vinculado a outra conta autenticada';
    end if;

    select count(*), min(p.id)
    into v_auth_pessoa_count, v_auth_pessoa_id
    from public.pessoas p
    where p.usuario_id = v_auth_user_id;

    if v_auth_pessoa_count > 1 then
        raise exception 'Conflito: mais de uma pessoa vinculada à conta autenticada';
    end if;

    select count(*), min(p.id)
    into v_email_pessoa_count, v_email_pessoa_id
    from public.pessoas p
    where lower(coalesce(p.email, '')) = v_email;

    if v_email_pessoa_count > 1 then
        raise exception 'Conflito: mais de uma pessoa com este email';
    end if;

    if v_email_pessoa_id is not null and v_auth_pessoa_id is not null and v_email_pessoa_id <> v_auth_pessoa_id then
        raise exception 'Conflito: conta autenticada já está associada a outra pessoa';
    end if;

    if exists (
        select 1
        from public.pessoas p
        where p.id = v_email_pessoa_id
          and p.usuario_id is not null
          and p.usuario_id <> v_auth_user_id
    ) then
        raise exception 'Conflito: pessoa com este email já vinculada a outra conta autenticada';
    end if;

    v_pessoa_id := coalesce(v_auth_pessoa_id, v_email_pessoa_id);
    v_usuario_id := coalesce(v_auth_access_user_id, v_email_access_user_id);

    if v_pessoa_id is not null then
        update public.pessoas
        set usuario_id = v_auth_user_id,
            foto_url = coalesce(v_foto_url, foto_url)
        where id = v_pessoa_id
          and (usuario_id is null or usuario_id = v_auth_user_id);
    end if;

    if v_usuario_id is null then
        insert into public.usuarios_acesso (
            auth_user_id,
            email,
            nome,
            telefone,
            foto_url,
            ativo,
            pessoa_id,
            criado_por
        )
        values (
            v_auth_user_id,
            v_email,
            v_nome,
            v_telefone,
            v_foto_url,
            true,
            v_pessoa_id,
            v_auth_user_id
        )
        returning id into v_usuario_id;
    else
        update public.usuarios_acesso
        set auth_user_id = v_auth_user_id,
            email = v_email,
            nome = coalesce(v_nome, nome),
            telefone = coalesce(v_telefone, telefone),
            foto_url = coalesce(v_foto_url, foto_url),
            ativo = true,
            pessoa_id = coalesce(pessoa_id, v_pessoa_id),
            atualizado_em = now()
        where id = v_usuario_id;
    end if;

    return v_usuario_id;
end;
$$;


ALTER FUNCTION "public"."self_service_upsert_access_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_pedidos_pastorais_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
    new.atualizado_em = timezone('utc', now());
    return new;
end;
$$;


ALTER FUNCTION "public"."set_pedidos_pastorais_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_push_dispositivos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
    new.atualizado_em = timezone('utc', now());
    return new;
end;
$$;


ALTER FUNCTION "public"."set_push_dispositivos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_push_notificacoes_fila_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
    new.atualizado_em = timezone('utc', now());
    return new;
end;
$$;


ALTER FUNCTION "public"."set_push_notificacoes_fila_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_acesso_pessoa_por_email"("p_pessoa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pessoa record;
  v_email text;
  v_usuario_acesso_id uuid;
  v_principal record;
  v_vinculo record;
begin
  select
    p.id,
    p.nome,
    p.email,
    p.telefone,
    p.cargo,
    p.ativo,
    p.usuario_id
  into v_pessoa
  from public.pessoas p
  where p.id = p_pessoa_id;

  if not found then
    return;
  end if;

  v_email := lower(trim(coalesce(v_pessoa.email, '')));

  if v_email = '' then
    return;
  end if;

  select
    pi.igreja_id,
    coalesce(pi.cargo, v_pessoa.cargo, 'membro'::cargo_tipo) as cargo,
    coalesce(pi.ativo, v_pessoa.ativo, true) as ativo,
    coalesce(pi.criado_em, now()) as criado_em
  into v_principal
  from public.pessoas_igrejas pi
  where pi.pessoa_id = v_pessoa.id
  order by
    coalesce(pi.ativo, true) desc,
    pi.atualizado_em desc nulls last,
    pi.criado_em desc nulls last
  limit 1;

  if not found then
    return;
  end if;

  select ua.id
  into v_usuario_acesso_id
  from public.usuarios_acesso ua
  where ua.pessoa_id = v_pessoa.id
  order by ua.atualizado_em desc nulls last, ua.criado_em desc nulls last
  limit 1;

  if v_usuario_acesso_id is null then
    select ua.id
    into v_usuario_acesso_id
    from public.usuarios_acesso ua
    where lower(trim(ua.email)) = v_email
    order by
      (ua.pessoa_id is null) desc,
      ua.atualizado_em desc nulls last,
      ua.criado_em desc nulls last
    limit 1;

    -- E-mail já usado pelo acesso de outra pessoa: não mexe nele.
    if v_usuario_acesso_id is not null and exists (
      select 1
      from public.usuarios_acesso ua
      where ua.id = v_usuario_acesso_id
        and ua.pessoa_id is not null
        and ua.pessoa_id <> v_pessoa.id
    ) then
      return;
    end if;
  end if;

  if v_usuario_acesso_id is null then
    insert into public.usuarios_acesso (
      pessoa_id,
      igreja_id,
      auth_user_id,
      email,
      nome,
      cargo,
      telefone,
      ativo,
      criado_em,
      atualizado_em
    )
    values (
      v_pessoa.id,
      v_principal.igreja_id,
      v_pessoa.usuario_id,
      v_email,
      v_pessoa.nome,
      v_principal.cargo,
      v_pessoa.telefone,
      v_principal.ativo,
      now(),
      now()
    )
    returning id into v_usuario_acesso_id;
  else
    update public.usuarios_acesso
    set
      pessoa_id = v_pessoa.id,
      igreja_id = v_principal.igreja_id,
      auth_user_id = coalesce(auth_user_id, v_pessoa.usuario_id),
      email = v_email,
      nome = coalesce(nullif(trim(v_pessoa.nome), ''), nome),
      cargo = v_principal.cargo,
      telefone = coalesce(v_pessoa.telefone, telefone),
      ativo = v_principal.ativo,
      atualizado_em = now()
    where id = v_usuario_acesso_id;
  end if;

  for v_vinculo in
    select
      pi.igreja_id,
      coalesce(pi.cargo, v_pessoa.cargo, 'membro'::cargo_tipo) as cargo,
      coalesce(pi.ativo, v_pessoa.ativo, true) as ativo,
      coalesce(pi.criado_em, now()) as criado_em
    from public.pessoas_igrejas pi
    where pi.pessoa_id = v_pessoa.id
  loop
    insert into public.usuarios_igrejas (
      usuario_id,
      igreja_id,
      cargo,
      ativo,
      criado_em
    )
    values (
      v_usuario_acesso_id,
      v_vinculo.igreja_id,
      v_vinculo.cargo,
      v_vinculo.ativo,
      v_vinculo.criado_em
    )
    on conflict (usuario_id, igreja_id)
    do update set
      cargo = excluded.cargo,
      ativo = excluded.ativo;
  end loop;
end;
$$;


ALTER FUNCTION "public"."sincronizar_acesso_pessoa_por_email"("p_pessoa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_pessoas_igrejas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."sync_pessoas_igrejas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tag_autoatribuivel"("p_tag_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.tags_funcoes tf
    where tf.id = p_tag_id
      and coalesce(tf.ativo, true) = true
      and tf.categoria not in (
        'louvor_lideranca',
        'lideranca',
        'lideranca_pastor',
        'lideranca_presbitero',
        'lideranca_diacono'
      )
  );
$$;


ALTER FUNCTION "public"."tag_autoatribuivel"("p_tag_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tem_acesso_louvor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.usuarios_acesso ua
    left join public.usuarios_igrejas ui
      on ui.usuario_id = ua.id
     and ui.ativo = true
    left join public.usuarios_tags ut
      on ut.usuario_id = ua.id
    left join public.tags_funcoes tf
      on tf.id = ut.tag_id
    where ua.auth_user_id = auth.uid()
      and coalesce(ua.ativo, true) = true
      and (
        ui.cargo = any (
          array[
            'superadmin'::cargo_tipo,
            'pastor'::cargo_tipo,
            'presbitero'::cargo_tipo,
            'seminarista'::cargo_tipo
          ]
        )
        or tf.categoria = 'louvor_lideranca'
      )
  );
$$;


ALTER FUNCTION "public"."tem_acesso_louvor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tem_acesso_louvor_igreja"("p_igreja_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_igreja_id is not null and (
    public.can_manage_church(p_igreja_id)
    or public.pode_gerenciar_escalas(p_igreja_id)
    or exists (
      select 1
      from public.usuarios_acesso ua
      join public.usuarios_tags ut
        on (ut.usuario_id = ua.id or ut.pessoa_id = ua.pessoa_id)
       and ut.igreja_id = p_igreja_id
      join public.tags_funcoes tf
        on tf.id = ut.tag_id
       and tf.categoria = 'louvor_lideranca'
       and coalesce(tf.ativo, true) = true
      where ua.auth_user_id = auth.uid()
        and coalesce(ua.ativo, true) = true
        and public.eh_membro_igreja(p_igreja_id)
    )
  );
$$;


ALTER FUNCTION "public"."tem_acesso_louvor_igreja"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_escalas_funcoes_igreja"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  select e.igreja_id into new.igreja_id
  from public.escalas e
  where e.id = new.escala_id;

  -- Quem não lidera o louvor da igreja (o músico confirmando a própria
  -- presença) só pode mudar confirmado, status e observacoes.
  if tg_op = 'UPDATE'
     and not public.tem_acesso_louvor_igreja(old.igreja_id)
     and auth.uid() is not null
     and (new.escala_id is distinct from old.escala_id
          or new.pessoa_id is distinct from old.pessoa_id
          or new.tag_id is distinct from old.tag_id
          or new.ordem is distinct from old.ordem) then
    raise exception 'Sem permissão para alterar esta função da escala'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_escalas_funcoes_igreja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_louvor_itens_igreja"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  select c.igreja_id into new.igreja_id
  from public."Louvores IPPN" c
  where c."Culto nr." = new.culto_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_louvor_itens_igreja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sincronizar_acesso_pessoas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.sincronizar_acesso_pessoa_por_email(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sincronizar_acesso_pessoas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sincronizar_acesso_pessoas_igrejas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.sincronizar_acesso_pessoa_por_email(new.pessoa_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sincronizar_acesso_pessoas_igrejas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_usuarios_tags_igreja"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.igreja_id is null then
    select pi.igreja_id into new.igreja_id
    from public.pessoas_igrejas pi
    where pi.pessoa_id = new.pessoa_id
      and coalesce(pi.ativo, true) = true
    order by pi.igreja_id
    limit 1;
  end if;

  if new.igreja_id is null then
    select ua.igreja_id into new.igreja_id
    from public.usuarios_acesso ua
    where ua.id = new.usuario_id
       or (new.pessoa_id is not null and ua.pessoa_id = new.pessoa_id)
    limit 1;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_usuarios_tags_igreja"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notas_pastorais_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notas_pastorais_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pessoas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pessoas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tem_acesso_igreja"("p_igreja_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."usuario_tem_acesso_igreja"("p_igreja_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_tem_acesso_pessoa"("p_pessoa_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.pessoas_igrejas pi
    where pi.pessoa_id = p_pessoa_id
      and public.usuario_tem_acesso_igreja(pi.igreja_id)
  );
$$;


ALTER FUNCTION "public"."usuario_tem_acesso_pessoa"("p_pessoa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_email_permitido"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$-- Este código já está bom:
BEGIN
  IF NOT public.email_permitido(NEW.email) THEN
    RAISE EXCEPTION 'Email não autorizado para acessar o sistema.';
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."verificar_email_permitido"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Louvores IPPN" (
    "Culto nr." bigint NOT NULL,
    "Dia" "date",
    "imagem_url" "text",
    "palavra_pastoral" "text",
    "palavra_pastoral_autor" "text" DEFAULT 'Pastor Paulo César Diniz'::"text",
    "igreja_id" "uuid",
    "palavra_pastoral_i18n" "jsonb"
);


ALTER TABLE "public"."Louvores IPPN" OWNER TO "postgres";


ALTER TABLE "public"."Louvores IPPN" ALTER COLUMN "Culto nr." ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Louvores IPPN_Culto nr._seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text",
    "record_id" "uuid",
    "action" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "user_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boletim_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "secao_id" "uuid",
    "conteudo" "text" NOT NULL,
    "destaque" boolean DEFAULT false,
    "ordem" integer DEFAULT 0,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "conteudo_i18n" "jsonb",
    "imagem_url" "text"
);


ALTER TABLE "public"."boletim_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boletim_secoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid",
    "culto_id" bigint,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "icone" "text",
    "ordem" integer DEFAULT 0,
    "visivel" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "titulo_i18n" "jsonb"
);


ALTER TABLE "public"."boletim_secoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."canticos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "letra" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" "text",
    "referencia" "text",
    "tags" "text"[],
    "youtube_url" "text",
    "spotify_url" "text",
    "holyrics_paragraphs" "jsonb",
    "holyrics_artist" "text",
    "holyrics_key" "text",
    "holyrics_bpm" numeric,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."canticos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hinario_novo_cantico" (
    "id" bigint NOT NULL,
    "numero" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "letra" "text",
    "assunto" "text",
    "origem_letra" "text",
    "origem_musica" "text",
    "referencia_biblica" "text",
    "autor_letra" "text",
    "compositor" "text",
    "link_audio" "text",
    "link_pagina" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "holyrics_paragraphs" "jsonb",
    "holyrics_artist" "text",
    "holyrics_key" "text",
    "holyrics_bpm" numeric
);


ALTER TABLE "public"."hinario_novo_cantico" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."canticos_unificados" WITH ("security_invoker"='true') AS
 SELECT 'cantico'::"text" AS "tipo",
    ("canticos"."id")::"text" AS "id",
    NULL::"text" AS "numero",
    "canticos"."nome",
    "canticos"."letra",
    "canticos"."tags",
    "canticos"."referencia",
    NULL::"text" AS "autor_letra",
    NULL::"text" AS "compositor",
    NULL::"text" AS "audio_url",
    "canticos"."youtube_url",
    "canticos"."spotify_url",
    "canticos"."created_at",
    "canticos"."holyrics_paragraphs",
    "canticos"."holyrics_artist",
    "canticos"."holyrics_key",
    "canticos"."holyrics_bpm",
    "canticos"."igreja_id"
   FROM "public"."canticos"
UNION ALL
 SELECT 'hinario'::"text" AS "tipo",
    ("hinario_novo_cantico"."id")::"text" AS "id",
    "hinario_novo_cantico"."numero",
    "hinario_novo_cantico"."titulo" AS "nome",
    "hinario_novo_cantico"."letra",
    NULL::"text"[] AS "tags",
    "hinario_novo_cantico"."referencia_biblica" AS "referencia",
    "hinario_novo_cantico"."autor_letra",
    "hinario_novo_cantico"."compositor",
    "hinario_novo_cantico"."link_audio" AS "audio_url",
    NULL::"text" AS "youtube_url",
    NULL::"text" AS "spotify_url",
    "hinario_novo_cantico"."created_at",
    "hinario_novo_cantico"."holyrics_paragraphs",
    "hinario_novo_cantico"."holyrics_artist",
    "hinario_novo_cantico"."holyrics_key",
    "hinario_novo_cantico"."holyrics_bpm",
    NULL::"uuid" AS "igreja_id"
   FROM "public"."hinario_novo_cantico";


ALTER VIEW "public"."canticos_unificados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."confissoes_documentos" (
    "id" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "sigla" "text" NOT NULL,
    "ano" "text",
    "descricao" "text",
    "ordem_ciclo" integer NOT NULL,
    "fonte_url" "text" NOT NULL
);


ALTER TABLE "public"."confissoes_documentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."confissoes_itens" (
    "id" "text" NOT NULL,
    "documento_id" "text" NOT NULL,
    "ordem" integer NOT NULL,
    "secao" "text",
    "rotulo" "text" NOT NULL,
    "pergunta" "text",
    "texto" "text" NOT NULL,
    "referencias" "text"
);


ALTER TABLE "public"."confissoes_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."convites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "telefone" "text",
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "public"."status_convite" DEFAULT 'pendente'::"public"."status_convite" NOT NULL,
    "convidado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "expira_em" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "aceito_em" timestamp with time zone,
    "tentativas_envio" integer DEFAULT 0,
    "ultimo_envio" timestamp with time zone,
    "pessoa_id" "uuid",
    "igreja_id" "uuid"
);


ALTER TABLE "public"."convites" OWNER TO "postgres";


COMMENT ON TABLE "public"."convites" IS 'Gerenciamento de convites para novos usuários do sistema';



COMMENT ON COLUMN "public"."convites"."token" IS 'Token único para aceitar o convite via URL';



COMMENT ON COLUMN "public"."convites"."expira_em" IS 'Data de expiração do convite (7 dias por padrão)';



COMMENT ON COLUMN "public"."convites"."pessoa_id" IS 'Pessoa que está sendo convidada a ter acesso';



CREATE TABLE IF NOT EXISTS "public"."convites_acesso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text",
    "pessoa_id" "uuid",
    "usuario_acesso_legado_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL
);


ALTER TABLE "public"."convites_acesso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "data" "date" NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fim" time without time zone,
    "tipo_culto" "text",
    "observacoes" "text",
    "status" "text" DEFAULT 'rascunho'::"text",
    "criado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "culto_id" bigint,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."escalas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalas_funcoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escala_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "ordem" integer DEFAULT 0,
    "confirmado" boolean DEFAULT false,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'pendente'::character varying,
    "pessoa_id" "uuid",
    "igreja_id" "uuid",
    CONSTRAINT "escalas_funcoes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pendente'::character varying, 'confirmado'::character varying, 'recusado'::character varying])::"text"[])))
);


ALTER TABLE "public"."escalas_funcoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid",
    "titulo" "text" NOT NULL,
    "data_evento" "date" NOT NULL,
    "hora" time without time zone,
    "local" "text",
    "descricao" "text" DEFAULT ''::"text" NOT NULL,
    "imagem_url" "text",
    "responsavel" "text",
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_por" "uuid",
    "atualizado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."eventos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fin_categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "grupo" "text" NOT NULL,
    "nominal" boolean DEFAULT false NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fin_categorias_grupo_check" CHECK (("grupo" = ANY (ARRAY['dizimos_ofertas'::"text", 'especificas_outras'::"text", 'patrimonio'::"text", 'causas_locais'::"text", 'evangelismo'::"text", 'missoes'::"text", 'sustento_pastoral'::"text", 'verba_presbiterial'::"text", 'dizimo_sc'::"text"]))),
    CONSTRAINT "fin_categorias_tipo_check" CHECK (("tipo" = ANY (ARRAY['receita'::"text", 'despesa'::"text"])))
);


ALTER TABLE "public"."fin_categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fin_contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" DEFAULT 'banco'::"text" NOT NULL,
    "banco" "text",
    "agencia" "text",
    "numero" "text",
    "saldo_inicial" numeric(14,2) DEFAULT 0 NOT NULL,
    "data_saldo_inicial" "date" DEFAULT CURRENT_DATE NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fin_contas_tipo_check" CHECK (("tipo" = ANY (ARRAY['caixa'::"text", 'banco'::"text", 'aplicacao'::"text"])))
);


ALTER TABLE "public"."fin_contas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fin_equipe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "pessoa_id" "uuid" NOT NULL,
    "papel" "text" NOT NULL,
    "ano" integer NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fin_equipe_papel_check" CHECK (("papel" = ANY (ARRAY['tesoureiro'::"text", 'auxiliar'::"text", 'comissao'::"text"])))
);


ALTER TABLE "public"."fin_equipe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fin_exames" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "ano" integer NOT NULL,
    "periodo" integer NOT NULL,
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "parecer" "text",
    "observacoes" "text",
    "enviado_em" timestamp with time zone,
    "enviado_por" "uuid",
    "examinado_em" timestamp with time zone,
    "examinado_por" "uuid",
    "aprovado_em" timestamp with time zone,
    "aprovado_por" "uuid",
    "ata_conselho" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fin_exames_parecer_check" CHECK (("parecer" = ANY (ARRAY['favoravel'::"text", 'ressalvas'::"text", 'desfavoravel'::"text"]))),
    CONSTRAINT "fin_exames_periodo_check" CHECK ((("periodo" >= 0) AND ("periodo" <= 4))),
    CONSTRAINT "fin_exames_status_check" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'enviado'::"text", 'devolvido'::"text", 'parecer'::"text", 'aprovado'::"text"])))
);


ALTER TABLE "public"."fin_exames" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fin_lancamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "data" "date" NOT NULL,
    "valor" numeric(14,2) NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "conta_destino_id" "uuid",
    "categoria_id" "uuid",
    "pessoa_id" "uuid",
    "descricao" "text",
    "forma_pagamento" "text",
    "documento_tipo" "text",
    "documento_numero" "text",
    "comprovante_path" "text",
    "criado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fin_lancamentos_documento_tipo_check" CHECK (("documento_tipo" = ANY (ARRAY['nota_fiscal'::"text", 'recibo'::"text", 'rpa'::"text", 'comprovante'::"text", 'outro'::"text"]))),
    CONSTRAINT "fin_lancamentos_forma_pagamento_check" CHECK (("forma_pagamento" = ANY (ARRAY['dinheiro'::"text", 'pix'::"text", 'transferencia'::"text", 'cartao'::"text", 'cheque'::"text", 'boleto'::"text", 'outro'::"text"]))),
    CONSTRAINT "fin_lancamentos_tipo_check" CHECK (("tipo" = ANY (ARRAY['receita'::"text", 'despesa'::"text", 'transferencia'::"text"]))),
    CONSTRAINT "fin_lancamentos_transferencia_ck" CHECK (((("tipo" = 'transferencia'::"text") AND ("conta_destino_id" IS NOT NULL) AND ("categoria_id" IS NULL) AND ("conta_destino_id" <> "conta_id")) OR (("tipo" <> 'transferencia'::"text") AND ("categoria_id" IS NOT NULL) AND ("conta_destino_id" IS NULL)))),
    CONSTRAINT "fin_lancamentos_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."fin_lancamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fin_orcamentos" (
    "igreja_id" "uuid" NOT NULL,
    "ano" integer NOT NULL,
    "categoria_id" "uuid" NOT NULL,
    "valor_previsto" numeric(14,2) DEFAULT 0 NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fin_orcamentos_valor_previsto_check" CHECK (("valor_previsto" >= (0)::numeric))
);


ALTER TABLE "public"."fin_orcamentos" OWNER TO "postgres";


ALTER TABLE "public"."hinario_novo_cantico" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."hinario_novo_cantico_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."igreja_cultos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "dia_semana" "text" NOT NULL,
    "horario" time without time zone NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."igreja_cultos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."igreja_formas_contribuir" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "label" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "beneficiario" "text",
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "igreja_formas_contribuir_tipo_check" CHECK (("tipo" = ANY (ARRAY['pix'::"text", 'iban'::"text", 'mbway'::"text", 'banco'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."igreja_formas_contribuir" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."igreja_redes_sociais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "url" "text" NOT NULL,
    "ativo" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."igreja_redes_sociais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."igrejas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "cidade" "text",
    "uf" character(2),
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "nome_abreviado" "text",
    "nome_completo" "text",
    "logradouro" "text",
    "bairro" "text",
    "cep" character(9),
    "site" "text",
    "visivel_publico" boolean DEFAULT true,
    "endereco_completo" "text",
    "instagram" "text",
    "youtube" "text",
    "whatsapp" "text",
    "telefone" "text",
    "complemento" "text",
    "tipos_liturgicos" "jsonb",
    "modelo_liturgico_padrao" "jsonb",
    "modo_repertorio" "text" DEFAULT 'canticos'::"text",
    "permite_cadastro_canticos" boolean DEFAULT true,
    "pais" "text" DEFAULT 'BR'::"text" NOT NULL,
    "regiao" "text",
    "email" "text",
    "horario_publicacao_boletim" "text",
    "dia_publicacao_boletim" integer,
    "timezone_boletim" "text",
    "apresentacao_titulo" "text",
    "apresentacao_texto" "text",
    "apresentacao_imagem_url" "text",
    "apresentacao_youtube_url" "text",
    "apresentacao_galeria" "jsonb",
    "apresentacao_titulo_i18n" "jsonb",
    "apresentacao_texto_i18n" "jsonb",
    "logo_url" "text",
    "pix_tipo" "text",
    "pix_chave" "text",
    "pix_beneficiario" "text",
    CONSTRAINT "igrejas_pais_check" CHECK (("pais" = ANY (ARRAY['BR'::"text", 'PT'::"text", 'US'::"text", 'CA'::"text"]))),
    CONSTRAINT "igrejas_pix_tipo_check" CHECK ((("pix_tipo" IS NULL) OR ("pix_tipo" = ANY (ARRAY['cpf'::"text", 'cnpj'::"text", 'email'::"text", 'telefone'::"text", 'aleatoria'::"text"]))))
);


ALTER TABLE "public"."igrejas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."igrejas"."pais" IS 'Código ISO do país da igreja: BR, PT, US, CA';



COMMENT ON COLUMN "public"."igrejas"."regiao" IS 'Estado, província, distrito ou região administrativa da igreja';



COMMENT ON COLUMN "public"."igrejas"."email" IS 'E-mail principal de contato da igreja';



COMMENT ON COLUMN "public"."igrejas"."horario_publicacao_boletim" IS 'Horario local da igreja em que o boletim passa a ficar visivel para a comunidade, formato HH24:MI:SS';



COMMENT ON COLUMN "public"."igrejas"."dia_publicacao_boletim" IS 'Dia da semana da publicacao do boletim: 1=Domingo, 2=Segunda, 3=Terca, 4=Quarta, 5=Quinta, 6=Sexta, 7=Sabado';



COMMENT ON COLUMN "public"."igrejas"."timezone_boletim" IS 'Timezone IANA usada para decidir a liberacao do boletim da igreja';



COMMENT ON COLUMN "public"."igrejas"."logo_url" IS 'URL da imagem de logo da igreja, exibida antes do nome no cabeçalho do boletim público.';



COMMENT ON COLUMN "public"."igrejas"."pix_tipo" IS 'Tipo da chave PIX da igreja: cpf, cnpj, email, telefone ou aleatoria.';



COMMENT ON COLUMN "public"."igrejas"."pix_chave" IS 'Valor da chave PIX da igreja (conforme pix_tipo).';



COMMENT ON COLUMN "public"."igrejas"."pix_beneficiario" IS 'Nome do titular/beneficiário exibido no QR Code PIX (campo "Merchant Name" do BR Code, máx. 25 caracteres).';



CREATE OR REPLACE VIEW "public"."igrejas_endereco_view" WITH ("security_invoker"='true') AS
 SELECT "id",
    "nome",
    "nome_abreviado",
    "nome_completo",
    "slug",
    "pais",
    "cidade",
    COALESCE("regiao", ("uf")::"text") AS "regiao",
    "uf",
    "logradouro",
    "complemento",
    "bairro",
    "cep",
    "telefone",
    "site",
    "ativo"
   FROM "public"."igrejas";


ALTER VIEW "public"."igrejas_endereco_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."louvor_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "culto_id" bigint NOT NULL,
    "cantico_id" "text",
    "tipo" "text" NOT NULL,
    "ordem" integer NOT NULL,
    "tom" "public"."tom_musical",
    "descricao" "text",
    "parent_id" "uuid",
    "conteudo_publico" "text",
    "visibilidade" "text" DEFAULT 'publico'::"text" NOT NULL,
    "horario" "text",
    "igreja_id" "uuid",
    "conteudo_publico_i18n" "jsonb"
);


ALTER TABLE "public"."louvor_itens" OWNER TO "postgres";


COMMENT ON COLUMN "public"."louvor_itens"."cantico_id" IS 'ID textual do item musical usado na liturgia. Pode ser UUID de canticos ou ID textual de hino do hinario.';



CREATE TABLE IF NOT EXISTS "public"."modelo_culto_padrao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ordem" integer NOT NULL,
    "bloco" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "descricao_padrao" "text" NOT NULL,
    "tem_cantico" boolean DEFAULT false,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."modelo_culto_padrao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modelos_liturgia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bloco" "text" NOT NULL,
    "ordem" integer NOT NULL,
    "tipo" "text" NOT NULL,
    "descricao_padrao" "text" NOT NULL,
    "tem_cantico" boolean DEFAULT false,
    "igreja_id" "uuid",
    "conteudo_publico_padrao_i18n" "jsonb",
    "descricao_interna_padrao_i18n" "jsonb"
);


ALTER TABLE "public"."modelos_liturgia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas_pastorais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "membro_id" "uuid" NOT NULL,
    "autor_id" "uuid" NOT NULL,
    "tipo" character varying(50) DEFAULT 'nota'::character varying,
    "titulo" "text",
    "conteudo" "text" NOT NULL,
    "privado" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "igreja_id" "uuid",
    CONSTRAINT "notas_pastorais_tipo_check" CHECK ((("tipo")::"text" = ANY ((ARRAY['nota'::character varying, 'visita'::character varying, 'ligacao'::character varying, 'oracao'::character varying, 'aconselhamento'::character varying, 'urgente'::character varying])::"text"[])))
);


ALTER TABLE "public"."notas_pastorais" OWNER TO "postgres";


COMMENT ON TABLE "public"."notas_pastorais" IS 'Histórico de acompanhamento pastoral e notas sobre membros';



COMMENT ON COLUMN "public"."notas_pastorais"."membro_id" IS 'Referência ao membro sendo acompanhado';



COMMENT ON COLUMN "public"."notas_pastorais"."autor_id" IS 'Quem criou a nota (pastor, presbítero, etc)';



COMMENT ON COLUMN "public"."notas_pastorais"."tipo" IS 'Tipo da nota: nota, visita, ligacao, oracao, aconselhamento, urgente';



COMMENT ON COLUMN "public"."notas_pastorais"."privado" IS 'Se TRUE, apenas pastor e liderança podem ver';



CREATE TABLE IF NOT EXISTS "public"."noticias_mensais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "corpo" "text" DEFAULT ''::"text" NOT NULL,
    "imagem_url" "text",
    "mes_referencia" integer NOT NULL,
    "ano_referencia" integer NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."noticias_mensais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "canal" "public"."notification_channel" NOT NULL,
    "status" "public"."notification_status" DEFAULT 'pending'::"public"."notification_status" NOT NULL,
    "destino" "text",
    "scheduled_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "sent_at" timestamp with time zone,
    "tentativas" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "provider" "text",
    "provider_message_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notification_deliveries" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_deliveries" IS 'Queued channel deliveries to be processed by workers.';



CREATE TABLE IF NOT EXISTS "public"."notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "entidade_tipo" "text",
    "entidade_id" "text",
    "chave_deduplicacao" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notification_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_events" IS 'Event log for notifications. Shared source for iOS, Next.js, email and WhatsApp.';



CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "usuario_acesso_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "canal" "public"."notification_channel" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid",
    "usuario_acesso_id" "uuid",
    "pessoa_id" "uuid",
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "corpo" "text" NOT NULL,
    "deep_link" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "prioridade" smallint DEFAULT 0 NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pastoral_bucket" timestamp with time zone,
    CONSTRAINT "notifications_recipient_ck" CHECK ((("usuario_acesso_id" IS NOT NULL) OR ("pessoa_id" IS NOT NULL)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Per-recipient notification rows. Works as web/iOS inbox.';



CREATE TABLE IF NOT EXISTS "public"."oikos_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "contato" "text" NOT NULL,
    "mensagem" "text",
    "igreja" "text",
    "funcao" "text",
    "locale" "text",
    "origem" "text" DEFAULT 'landing_oikos'::"text" NOT NULL,
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "user_agent" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "oikos_leads_status_ck" CHECK (("status" = ANY (ARRAY['novo'::"text", 'em_contato'::"text", 'demo_agendada'::"text", 'convertido'::"text", 'perdido'::"text"])))
);


ALTER TABLE "public"."oikos_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedidos_pastorais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "usuario_acesso_id" "uuid",
    "pessoa_id" "uuid",
    "nome_solicitante" "text" NOT NULL,
    "email_solicitante" "text",
    "telefone_solicitante" "text",
    "categoria" "text" DEFAULT 'oracao'::"text" NOT NULL,
    "assunto" "text",
    "mensagem" "text" NOT NULL,
    "deseja_retorno" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "pedidos_pastorais_categoria_check" CHECK (("categoria" = ANY (ARRAY['oracao'::"text", 'aconselhamento'::"text", 'visita'::"text", 'outro'::"text"]))),
    CONSTRAINT "pedidos_pastorais_status_check" CHECK (("status" = ANY (ARRAY['novo'::"text", 'em_andamento'::"text", 'concluido'::"text"])))
);


ALTER TABLE "public"."pedidos_pastorais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pessoas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "cargo" "public"."cargo_tipo",
    "email" "text",
    "telefone" "text",
    "ativo" boolean DEFAULT true,
    "usuario_id" "uuid",
    "foto_url" "text",
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "criado_por" "uuid",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "migrado_de" "uuid",
    "data_nascimento" "date",
    "data_casamento" "date",
    "data_batismo" "date",
    "situacao_saude" "text",
    "endereco_completo" "text",
    "status_membro" "text",
    "nome_pai" "text",
    "nome_mae" "text",
    "sexo" "public"."sexo_tipo",
    "naturalidade_cidade" "text",
    "naturalidade_uf" character(2),
    "nacionalidade" "text" DEFAULT 'Brasileira'::"text",
    "escolaridade" "text",
    "profissao" "text",
    "logradouro" "text",
    "bairro" "text",
    "cep" "text",
    "cidade" "text" DEFAULT 'Sua Cidade'::"text",
    "uf" character(2) DEFAULT 'UF'::"bpchar",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "google_place_id" "text",
    "estado_civil" "text",
    "conjuge_nome" "text",
    "conjuge_religiao" "text",
    "grupo_familiar_nome" "text",
    "grupo_familiar_lider" "text",
    "batizado" boolean DEFAULT false,
    "data_profissao_fe" "date",
    "transferido_ipb" boolean DEFAULT false,
    "transferido_outra_denominacao" "text",
    "cursos_discipulado" "text"[],
    "apelido" "text",
    "transferido_ipb_origem" "text",
    "cadastro_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_teste" boolean DEFAULT false NOT NULL,
    "classificacao_membro" character varying(30),
    "nome_familia_customizado" "text",
    "atividade_atual" "text",
    "pais_origem" "text",
    "uniao_estavel_tempo" "text",
    "igreja_sede_congregacao" "text",
    "congregacao_nome" "text",
    "transferencia_ipb_origem" "text",
    "transferencia_jurisdicao_sem_carta" "text",
    "transferencia_observacao" "text",
    "proposito_entrevista" "text",
    "assinatura_ficha" "text",
    "assinatura_ficha_em" timestamp with time zone,
    CONSTRAINT "pessoas_classificacao_membro_check" CHECK ((("classificacao_membro")::"text" = ANY ((ARRAY['comungante'::character varying, 'nao_comungante'::character varying, 'aderente_comungante'::character varying, 'aderente_nao_comungante'::character varying])::"text"[]))),
    CONSTRAINT "pessoas_status_membro_check" CHECK (("status_membro" = ANY (ARRAY['ativo'::"text", 'afastado'::"text", 'falecido'::"text", 'visitante'::"text", 'congregado'::"text"])))
);


ALTER TABLE "public"."pessoas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pessoas"."cargo" IS 'LEGADO: cargo eclesiastico global. Use public.pessoas_igrejas.cargo para o papel da pessoa em cada igreja.';



COMMENT ON COLUMN "public"."pessoas"."data_nascimento" IS 'Data de nascimento do membro';



COMMENT ON COLUMN "public"."pessoas"."data_casamento" IS 'Data de casamento do membro';



COMMENT ON COLUMN "public"."pessoas"."data_batismo" IS 'Data de batismo do membro';



COMMENT ON COLUMN "public"."pessoas"."situacao_saude" IS 'Informações de saúde para acompanhamento pastoral';



COMMENT ON COLUMN "public"."pessoas"."endereco_completo" IS 'Endereço completo do membro';



COMMENT ON COLUMN "public"."pessoas"."status_membro" IS 'LEGADO: status global da pessoa. Use public.pessoas_igrejas.status_membro para o status por igreja.';



COMMENT ON COLUMN "public"."pessoas"."is_teste" IS 'Cadastro de teste — não contabiliza em totais e relatórios.';



COMMENT ON COLUMN "public"."pessoas"."classificacao_membro" IS 'Classificação eclesiástica presbiteriana: comungante (profissão de fé, rol transferido), nao_comungante (batizado na infância sem profissão), aderente_comungante (frequenta mas mantém vínculo em outra igreja), aderente_nao_comungante (frequenta sem vínculo formal em nenhuma igreja).';



CREATE TABLE IF NOT EXISTS "public"."pessoas_igrejas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pessoa_id" "uuid" NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "status_membro" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "cargo" "public"."cargo_tipo",
    "ativo" boolean DEFAULT true NOT NULL,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pessoas_igrejas_status_check" CHECK (("status_membro" = ANY (ARRAY['ativo'::"text", 'afastado'::"text", 'falecido'::"text", 'visitante'::"text", 'congregado'::"text"])))
);


ALTER TABLE "public"."pessoas_igrejas" OWNER TO "postgres";


COMMENT ON TABLE "public"."pessoas_igrejas" IS 'Representa o papel e vínculo eclesiástico da pessoa em cada igreja.';



CREATE TABLE IF NOT EXISTS "public"."plataforma_admins" (
    "auth_user_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plataforma_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_dispositivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "installation_id" "uuid" NOT NULL,
    "push_token" "text" NOT NULL,
    "plataforma" "text" DEFAULT 'ios'::"text" NOT NULL,
    "ambiente" "text" DEFAULT 'development'::"text" NOT NULL,
    "authorization_status" "text" DEFAULT 'not_determined'::"text" NOT NULL,
    "igreja_id" "uuid",
    "usuario_acesso_id" "uuid",
    "pessoa_id" "uuid",
    "ativo" boolean DEFAULT true NOT NULL,
    "ultimo_registro_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "locale" "text",
    CONSTRAINT "push_dispositivos_ambiente_check" CHECK (("ambiente" = ANY (ARRAY['development'::"text", 'production'::"text"]))),
    CONSTRAINT "push_dispositivos_authorization_status_check" CHECK (("authorization_status" = ANY (ARRAY['not_determined'::"text", 'denied'::"text", 'authorized'::"text", 'provisional'::"text", 'ephemeral'::"text", 'unknown'::"text"]))),
    CONSTRAINT "push_dispositivos_locale_ck" CHECK ((("locale" IS NULL) OR ("locale" = ANY (ARRAY['pt'::"text", 'es'::"text", 'en'::"text"])))),
    CONSTRAINT "push_dispositivos_plataforma_check" CHECK (("plataforma" = 'ios'::"text"))
);


ALTER TABLE "public"."push_dispositivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notificacoes_fila" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "pessoa_id" "uuid",
    "escala_id" "uuid",
    "culto_id" integer,
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "chave_deduplicacao" "text",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "tentativas" integer DEFAULT 0 NOT NULL,
    "agendada_para" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "processada_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "push_notificacoes_fila_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'processando'::"text", 'enviada'::"text", 'erro'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "push_notificacoes_fila_tipo_check" CHECK (("tipo" = ANY (ARRAY['boletim_disponivel'::"text", 'escala_publicada_pessoa'::"text"])))
);


ALTER TABLE "public"."push_notificacoes_fila" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recursos_multimidia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "igreja_id" "uuid",
    "titulo" "text" NOT NULL,
    "categoria" "text" DEFAULT 'culto'::"text" NOT NULL,
    "data_recurso" "date" NOT NULL,
    "descricao" "text" DEFAULT ''::"text" NOT NULL,
    "responsavel" "text",
    "youtube_url" "text",
    "duracao" "text",
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_por" "uuid",
    "atualizado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "video_url" "text",
    "thumbnail_url" "text",
    "plataforma" "text" DEFAULT 'youtube'::"text" NOT NULL,
    CONSTRAINT "recursos_multimidia_categoria_ck" CHECK (("categoria" = ANY (ARRAY['culto'::"text", 'ebd'::"text", 'estudo'::"text", 'especial'::"text"])))
);


ALTER TABLE "public"."recursos_multimidia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relacionamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pessoa_id" "uuid" NOT NULL,
    "pessoa_relacionada_id" "uuid" NOT NULL,
    "tipo" "public"."tipo_relacionamento" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "criado_por" "uuid",
    "igreja_id" "uuid",
    CONSTRAINT "relacionamentos_no_self" CHECK (("pessoa_id" <> "pessoa_relacionada_id"))
);


ALTER TABLE "public"."relacionamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags_funcoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "cor" "text",
    "icone" "text",
    "ordem" integer DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "ordem_categoria" integer DEFAULT 50,
    "igreja_id" "uuid"
);


ALTER TABLE "public"."tags_funcoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_acesso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text",
    "cargo" "public"."cargo_tipo",
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "criado_por" "uuid",
    "telefone" "text",
    "foto_url" "text",
    "observacoes" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "migrado" boolean DEFAULT true,
    "motivo_inativo" "text",
    "pessoa_id" "uuid",
    "igreja_id" "uuid",
    "auth_user_id" "uuid"
);


ALTER TABLE "public"."usuarios_acesso" OWNER TO "postgres";


COMMENT ON TABLE "public"."usuarios_acesso" IS 'Registro de usuários que têm acesso ao sistema (vinculados ao auth.users)';



COMMENT ON COLUMN "public"."usuarios_acesso"."cargo" IS 'LEGADO: manter apenas para transição. O cargo efetivo do app deve viver em usuarios_igrejas.';



COMMENT ON COLUMN "public"."usuarios_acesso"."igreja_id" IS 'LEGADO: manter apenas para transição. O vínculo com igrejas deve viver em usuarios_igrejas.';



COMMENT ON COLUMN "public"."usuarios_acesso"."auth_user_id" IS 'Conta real do Supabase Auth. Nulo enquanto o acesso foi apenas provisionado.';



CREATE TABLE IF NOT EXISTS "public"."usuarios_igrejas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "igreja_id" "uuid" NOT NULL,
    "cargo" "public"."cargo_tipo" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."usuarios_igrejas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "nivel_habilidade" integer DEFAULT 1,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "pessoa_id" "uuid",
    "igreja_id" "uuid",
    "usuario_id" "uuid"
);


ALTER TABLE "public"."usuarios_tags" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuarios_tags"."pessoa_id" IS 'LEGADO: manter apenas para transição. Permissões do app devem referenciar usuario_id.';



COMMENT ON COLUMN "public"."usuarios_tags"."igreja_id" IS 'Permissões do app passam a ser por igreja.';



COMMENT ON COLUMN "public"."usuarios_tags"."usuario_id" IS 'Novo vínculo de permissões do app com a identidade de acesso.';



CREATE OR REPLACE VIEW "public"."view_familias" WITH ("security_invoker"='true') AS
 WITH "nucleos" AS (
         SELECT "p"."id",
            "p"."nome"
           FROM "public"."pessoas" "p"
          WHERE (("p"."ativo" = true) AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."relacionamentos" "r"
                  WHERE (("r"."pessoa_id" = "p"."id") AND ("r"."tipo" = ANY (ARRAY['pai'::"public"."tipo_relacionamento", 'mae'::"public"."tipo_relacionamento", 'conjuge'::"public"."tipo_relacionamento"])))))))
        ), "membros_com_nucleo" AS (
         SELECT "p"."id" AS "pessoa_id",
            COALESCE(( SELECT "r"."pessoa_relacionada_id"
                   FROM "public"."relacionamentos" "r"
                  WHERE (("r"."pessoa_id" = "p"."id") AND ("r"."tipo" = ANY (ARRAY['pai'::"public"."tipo_relacionamento", 'mae'::"public"."tipo_relacionamento", 'conjuge'::"public"."tipo_relacionamento"])))
                  ORDER BY "r"."criado_em"
                 LIMIT 1), "p"."id") AS "nucleo_id"
           FROM "public"."pessoas" "p"
          WHERE ("p"."ativo" = true)
        )
 SELECT "mn"."nucleo_id",
    "n"."nome" AS "nome_familia",
    "mn"."pessoa_id"
   FROM ("membros_com_nucleo" "mn"
     LEFT JOIN "public"."pessoas" "n" ON (("n"."id" = "mn"."nucleo_id")));


ALTER VIEW "public"."view_familias" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_cultos_com_escalas" WITH ("security_invoker"='true') AS
 SELECT "l"."Culto nr.",
    "l"."Dia",
    "count"(DISTINCT "e"."id") AS "total_escalas",
    "count"(DISTINCT "li"."id") AS "total_louvores",
    "array_agg"(DISTINCT "e"."tipo_culto") FILTER (WHERE ("e"."tipo_culto" IS NOT NULL)) AS "tipos_culto",
    "max"("e"."status") AS "status_escala"
   FROM (("public"."Louvores IPPN" "l"
     LEFT JOIN "public"."escalas" "e" ON (("e"."culto_id" = "l"."Culto nr.")))
     LEFT JOIN "public"."louvor_itens" "li" ON (("li"."culto_id" = "l"."Culto nr.")))
  GROUP BY "l"."Culto nr.", "l"."Dia"
  ORDER BY "l"."Dia" DESC;


ALTER VIEW "public"."vw_cultos_com_escalas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_cultos_incompletos" WITH ("security_invoker"='true') AS
 SELECT "l"."Culto nr.",
    "l"."Dia",
        CASE
            WHEN ("count"("e"."id") = 0) THEN 'Sem escala'::"text"
            WHEN ("count"("li"."id") = 0) THEN 'Sem louvores'::"text"
            ELSE 'OK'::"text"
        END AS "status",
    "count"("e"."id") AS "num_escalas",
    "count"("li"."id") AS "num_louvores"
   FROM (("public"."Louvores IPPN" "l"
     LEFT JOIN "public"."escalas" "e" ON (("e"."culto_id" = "l"."Culto nr.")))
     LEFT JOIN "public"."louvor_itens" "li" ON (("li"."culto_id" = "l"."Culto nr.")))
  WHERE ("l"."Dia" >= CURRENT_DATE)
  GROUP BY "l"."Culto nr.", "l"."Dia"
 HAVING (("count"("e"."id") = 0) OR ("count"("li"."id") = 0))
  ORDER BY "l"."Dia";


ALTER VIEW "public"."vw_cultos_incompletos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_estatisticas_canticos" WITH ("security_invoker"='true') AS
 SELECT ("c"."id")::"text" AS "cantico_id",
    "c"."nome" AS "cantico",
    "count"("li"."id") AS "total_execucoes",
    "max"("l"."Dia") AS "ultima_execucao",
    "min"("l"."Dia") AS "primeira_execucao",
    "count"(DISTINCT "l"."Culto nr.") AS "total_cultos",
    "round"((("count"("li"."id"))::numeric / (NULLIF("count"(DISTINCT ((EXTRACT(year FROM "l"."Dia") || '-'::"text") || EXTRACT(month FROM "l"."Dia"))), 0))::numeric), 2) AS "media_por_mes"
   FROM (("public"."canticos" "c"
     LEFT JOIN "public"."louvor_itens" "li" ON (("li"."cantico_id" = ("c"."id")::"text")))
     LEFT JOIN "public"."Louvores IPPN" "l" ON (("li"."culto_id" = "l"."Culto nr.")))
  WHERE ("l"."Dia" IS NOT NULL)
  GROUP BY "c"."id", "c"."nome"
  ORDER BY ("count"("li"."id")) DESC;


ALTER VIEW "public"."vw_estatisticas_canticos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_evolucao_mensal" WITH ("security_invoker"='true') AS
 SELECT (EXTRACT(year FROM "l"."Dia"))::integer AS "ano",
    (EXTRACT(month FROM "l"."Dia"))::integer AS "mes",
    "to_char"(("l"."Dia")::timestamp with time zone, 'Mon/YY'::"text") AS "mes_label",
    "count"("li"."id") AS "total_execucoes",
    "count"(DISTINCT "c"."id") AS "canticos_unicos",
    "count"(DISTINCT "l"."Culto nr.") AS "total_cultos"
   FROM (("public"."Louvores IPPN" "l"
     LEFT JOIN "public"."louvor_itens" "li" ON (("li"."culto_id" = "l"."Culto nr.")))
     LEFT JOIN "public"."canticos" "c" ON (("li"."cantico_id" = ("c"."id")::"text")))
  WHERE ("l"."Dia" IS NOT NULL)
  GROUP BY (EXTRACT(year FROM "l"."Dia")), (EXTRACT(month FROM "l"."Dia")), ("to_char"(("l"."Dia")::timestamp with time zone, 'Mon/YY'::"text"))
  ORDER BY ((EXTRACT(year FROM "l"."Dia"))::integer) DESC, ((EXTRACT(month FROM "l"."Dia"))::integer) DESC;


ALTER VIEW "public"."vw_evolucao_mensal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_execucoes_louvores" WITH ("security_invoker"='true') AS
 SELECT "li"."id" AS "execucao_id",
    "c"."nome" AS "cantico",
    "l"."Dia" AS "data",
    (EXTRACT(year FROM "l"."Dia"))::integer AS "ano",
    (EXTRACT(month FROM "l"."Dia"))::integer AS "mes",
    "l"."Culto nr." AS "culto_nr",
    "li"."ordem",
    "li"."tom"
   FROM (("public"."louvor_itens" "li"
     JOIN "public"."Louvores IPPN" "l" ON (("li"."culto_id" = "l"."Culto nr.")))
     JOIN "public"."canticos" "c" ON (("li"."cantico_id" = ("c"."id")::"text")))
  WHERE ("l"."Dia" IS NOT NULL)
  ORDER BY "l"."Dia" DESC, "li"."ordem";


ALTER VIEW "public"."vw_execucoes_louvores" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_ranking_tons" WITH ("security_invoker"='true') AS
 SELECT "tom",
    "count"("id") AS "total_execucoes",
    "count"(DISTINCT "cantico_id") AS "canticos_diferentes",
    "count"(DISTINCT "culto_id") AS "total_cultos",
    "round"(((("count"("id"))::numeric * 100.0) / ( SELECT ("count"(*))::numeric AS "count"
           FROM "public"."louvor_itens"
          WHERE ("louvor_itens"."tom" IS NOT NULL))), 2) AS "percentual"
   FROM "public"."louvor_itens" "li"
  WHERE ("tom" IS NOT NULL)
  GROUP BY "tom"
  ORDER BY ("count"("id")) DESC;


ALTER VIEW "public"."vw_ranking_tons" OWNER TO "postgres";


ALTER TABLE ONLY "public"."Louvores IPPN"
    ADD CONSTRAINT "Louvores IPPN_Culto nr._key" UNIQUE ("Culto nr.");



ALTER TABLE ONLY "public"."Louvores IPPN"
    ADD CONSTRAINT "Louvores IPPN_pkey" PRIMARY KEY ("Culto nr.");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boletim_itens"
    ADD CONSTRAINT "boletim_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boletim_secoes"
    ADD CONSTRAINT "boletim_secoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."canticos"
    ADD CONSTRAINT "canticos_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."canticos"
    ADD CONSTRAINT "canticos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."confissoes_documentos"
    ADD CONSTRAINT "confissoes_documentos_ordem_ciclo_key" UNIQUE ("ordem_ciclo");



ALTER TABLE ONLY "public"."confissoes_documentos"
    ADD CONSTRAINT "confissoes_documentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."confissoes_itens"
    ADD CONSTRAINT "confissoes_itens_documento_id_ordem_key" UNIQUE ("documento_id", "ordem");



ALTER TABLE ONLY "public"."confissoes_itens"
    ADD CONSTRAINT "confissoes_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."convites_acesso"
    ADD CONSTRAINT "convites_acesso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."convites_acesso"
    ADD CONSTRAINT "convites_acesso_usuario_acesso_legado_id_key" UNIQUE ("usuario_acesso_legado_id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_email_unique" UNIQUE ("email", "status");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."escalas_funcoes"
    ADD CONSTRAINT "escalas_funcoes_escala_id_tag_id_ordem_key" UNIQUE ("escala_id", "tag_id", "ordem");



ALTER TABLE ONLY "public"."escalas_funcoes"
    ADD CONSTRAINT "escalas_funcoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escalas"
    ADD CONSTRAINT "escalas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fin_categorias"
    ADD CONSTRAINT "fin_categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fin_contas"
    ADD CONSTRAINT "fin_contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fin_equipe"
    ADD CONSTRAINT "fin_equipe_igreja_id_pessoa_id_papel_ano_key" UNIQUE ("igreja_id", "pessoa_id", "papel", "ano");



ALTER TABLE ONLY "public"."fin_equipe"
    ADD CONSTRAINT "fin_equipe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fin_exames"
    ADD CONSTRAINT "fin_exames_igreja_id_ano_periodo_key" UNIQUE ("igreja_id", "ano", "periodo");



ALTER TABLE ONLY "public"."fin_exames"
    ADD CONSTRAINT "fin_exames_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fin_lancamentos"
    ADD CONSTRAINT "fin_lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fin_orcamentos"
    ADD CONSTRAINT "fin_orcamentos_pkey" PRIMARY KEY ("igreja_id", "ano", "categoria_id");



ALTER TABLE ONLY "public"."hinario_novo_cantico"
    ADD CONSTRAINT "hinario_novo_cantico_numero_unique" UNIQUE ("numero");



ALTER TABLE ONLY "public"."hinario_novo_cantico"
    ADD CONSTRAINT "hinario_novo_cantico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igreja_cultos"
    ADD CONSTRAINT "igreja_cultos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igreja_formas_contribuir"
    ADD CONSTRAINT "igreja_formas_contribuir_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igreja_redes_sociais"
    ADD CONSTRAINT "igreja_redes_sociais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igrejas"
    ADD CONSTRAINT "igrejas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."igrejas"
    ADD CONSTRAINT "igrejas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."louvor_itens"
    ADD CONSTRAINT "louvor_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modelo_culto_padrao"
    ADD CONSTRAINT "modelo_culto_padrao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modelos_liturgia"
    ADD CONSTRAINT "modelos_liturgia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_pastorais"
    ADD CONSTRAINT "notas_pastorais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."noticias_mensais"
    ADD CONSTRAINT "noticias_mensais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_chave_deduplicacao_key" UNIQUE ("chave_deduplicacao");



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_igreja_id_usuario_acesso_id_tipo_c_key" UNIQUE ("igreja_id", "usuario_acesso_id", "tipo", "canal");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oikos_leads"
    ADD CONSTRAINT "oikos_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos_pastorais"
    ADD CONSTRAINT "pedidos_pastorais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pessoas_igrejas"
    ADD CONSTRAINT "pessoas_igrejas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_admins"
    ADD CONSTRAINT "plataforma_admins_pkey" PRIMARY KEY ("auth_user_id");



ALTER TABLE ONLY "public"."push_dispositivos"
    ADD CONSTRAINT "push_dispositivos_installation_id_key" UNIQUE ("installation_id");



ALTER TABLE ONLY "public"."push_dispositivos"
    ADD CONSTRAINT "push_dispositivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_dispositivos"
    ADD CONSTRAINT "push_dispositivos_push_token_key" UNIQUE ("push_token");



ALTER TABLE ONLY "public"."push_notificacoes_fila"
    ADD CONSTRAINT "push_notificacoes_fila_chave_deduplicacao_key" UNIQUE ("chave_deduplicacao");



ALTER TABLE ONLY "public"."push_notificacoes_fila"
    ADD CONSTRAINT "push_notificacoes_fila_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recursos_multimidia"
    ADD CONSTRAINT "recursos_multimidia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_par_unico" UNIQUE ("pessoa_id", "pessoa_relacionada_id");



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_unique" UNIQUE ("pessoa_id", "pessoa_relacionada_id", "tipo");



ALTER TABLE ONLY "public"."tags_funcoes"
    ADD CONSTRAINT "tags_funcoes_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."tags_funcoes"
    ADD CONSTRAINT "tags_funcoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_igrejas"
    ADD CONSTRAINT "usuarios_igrejas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_acesso"
    ADD CONSTRAINT "usuarios_permitidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_tags"
    ADD CONSTRAINT "usuarios_tags_pessoa_id_tag_id_key" UNIQUE ("pessoa_id", "tag_id");



ALTER TABLE ONLY "public"."usuarios_tags"
    ADD CONSTRAINT "usuarios_tags_pkey" PRIMARY KEY ("id");



CREATE INDEX "boletim_itens_secao_ordem_idx" ON "public"."boletim_itens" USING "btree" ("secao_id", "ordem");



CREATE INDEX "boletim_secoes_igreja_culto_ordem_idx" ON "public"."boletim_secoes" USING "btree" ("igreja_id", "culto_id", "ordem");



CREATE INDEX "confissoes_itens_documento_ordem_idx" ON "public"."confissoes_itens" USING "btree" ("documento_id", "ordem");



CREATE INDEX "eventos_igreja_idx" ON "public"."eventos" USING "btree" ("igreja_id", "ativo", "data_evento");



CREATE INDEX "eventos_publico_idx" ON "public"."eventos" USING "btree" ("ativo", "data_evento", "ordem");



CREATE INDEX "fin_categorias_igreja_idx" ON "public"."fin_categorias" USING "btree" ("igreja_id");



CREATE INDEX "fin_contas_igreja_idx" ON "public"."fin_contas" USING "btree" ("igreja_id");



CREATE INDEX "fin_equipe_igreja_ano_idx" ON "public"."fin_equipe" USING "btree" ("igreja_id", "ano");



CREATE INDEX "fin_lancamentos_igreja_data_idx" ON "public"."fin_lancamentos" USING "btree" ("igreja_id", "data");



CREATE INDEX "fin_lancamentos_pessoa_idx" ON "public"."fin_lancamentos" USING "btree" ("pessoa_id") WHERE ("pessoa_id" IS NOT NULL);



CREATE INDEX "idx_boletim_itens_secao" ON "public"."boletim_itens" USING "btree" ("secao_id");



CREATE INDEX "idx_boletim_secoes_culto" ON "public"."boletim_secoes" USING "btree" ("culto_id");



CREATE INDEX "idx_boletim_secoes_igreja" ON "public"."boletim_secoes" USING "btree" ("igreja_id");



CREATE INDEX "idx_canticos_igreja" ON "public"."canticos" USING "btree" ("igreja_id");



CREATE INDEX "idx_convites_email" ON "public"."convites" USING "btree" ("email");



CREATE INDEX "idx_convites_expira_em" ON "public"."convites" USING "btree" ("expira_em");



CREATE INDEX "idx_convites_pessoa_id" ON "public"."convites" USING "btree" ("pessoa_id");



CREATE INDEX "idx_convites_status" ON "public"."convites" USING "btree" ("status");



CREATE INDEX "idx_convites_token" ON "public"."convites" USING "btree" ("token");



CREATE INDEX "idx_escalas_culto_id" ON "public"."escalas" USING "btree" ("culto_id");



CREATE INDEX "idx_escalas_data" ON "public"."escalas" USING "btree" ("data");



CREATE INDEX "idx_escalas_funcoes_escala" ON "public"."escalas_funcoes" USING "btree" ("escala_id");



CREATE INDEX "idx_escalas_funcoes_igreja" ON "public"."escalas_funcoes" USING "btree" ("igreja_id");



CREATE INDEX "idx_escalas_funcoes_pessoa" ON "public"."escalas_funcoes" USING "btree" ("pessoa_id");



CREATE INDEX "idx_escalas_igreja" ON "public"."escalas" USING "btree" ("igreja_id");



CREATE INDEX "idx_hinario_assunto" ON "public"."hinario_novo_cantico" USING "btree" ("assunto");



CREATE INDEX "idx_hinario_numero" ON "public"."hinario_novo_cantico" USING "btree" ("numero");



CREATE INDEX "idx_hinario_titulo" ON "public"."hinario_novo_cantico" USING "btree" ("titulo");



CREATE INDEX "idx_igreja_cultos_igreja" ON "public"."igreja_cultos" USING "btree" ("igreja_id");



CREATE INDEX "idx_igreja_redes_igreja" ON "public"."igreja_redes_sociais" USING "btree" ("igreja_id");



CREATE INDEX "idx_louvor_itens_igreja" ON "public"."louvor_itens" USING "btree" ("igreja_id");



CREATE INDEX "idx_notas_pastorais_autor_id" ON "public"."notas_pastorais" USING "btree" ("autor_id");



CREATE INDEX "idx_notas_pastorais_criado_em" ON "public"."notas_pastorais" USING "btree" ("criado_em" DESC);



CREATE INDEX "idx_notas_pastorais_igreja" ON "public"."notas_pastorais" USING "btree" ("igreja_id");



CREATE INDEX "idx_notas_pastorais_membro_id" ON "public"."notas_pastorais" USING "btree" ("membro_id");



CREATE INDEX "idx_notas_pastorais_tipo" ON "public"."notas_pastorais" USING "btree" ("tipo");



CREATE INDEX "idx_pessoas_ativo" ON "public"."pessoas" USING "btree" ("ativo");



CREATE INDEX "idx_pessoas_bairro" ON "public"."pessoas" USING "btree" ("bairro");



CREATE INDEX "idx_pessoas_cargo" ON "public"."pessoas" USING "btree" ("cargo");



CREATE INDEX "idx_pessoas_cep" ON "public"."pessoas" USING "btree" ("cep");



CREATE INDEX "idx_pessoas_data_casamento" ON "public"."pessoas" USING "btree" ("data_casamento") WHERE ("data_casamento" IS NOT NULL);



CREATE INDEX "idx_pessoas_data_nascimento" ON "public"."pessoas" USING "btree" ("data_nascimento") WHERE ("data_nascimento" IS NOT NULL);



CREATE INDEX "idx_pessoas_geo" ON "public"."pessoas" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_pessoas_igrejas_cargo" ON "public"."pessoas_igrejas" USING "btree" ("cargo");



CREATE INDEX "idx_pessoas_igrejas_igreja" ON "public"."pessoas_igrejas" USING "btree" ("igreja_id");



CREATE INDEX "idx_pessoas_igrejas_pessoa" ON "public"."pessoas_igrejas" USING "btree" ("pessoa_id");



CREATE INDEX "idx_pessoas_igrejas_status" ON "public"."pessoas_igrejas" USING "btree" ("status_membro");



CREATE INDEX "idx_pessoas_nome" ON "public"."pessoas" USING "btree" ("nome");



CREATE INDEX "idx_pessoas_nome_mae" ON "public"."pessoas" USING "btree" ("nome_mae") WHERE ("nome_mae" IS NOT NULL);



CREATE INDEX "idx_pessoas_nome_pai" ON "public"."pessoas" USING "btree" ("nome_pai") WHERE ("nome_pai" IS NOT NULL);



CREATE INDEX "idx_pessoas_profissao" ON "public"."pessoas" USING "btree" ("profissao");



CREATE INDEX "idx_pessoas_status_membro" ON "public"."pessoas" USING "btree" ("status_membro");



CREATE INDEX "idx_pessoas_usuario_id" ON "public"."pessoas" USING "btree" ("usuario_id") WHERE ("usuario_id" IS NOT NULL);



CREATE INDEX "idx_relacionamentos_pessoa_id" ON "public"."relacionamentos" USING "btree" ("pessoa_id");



CREATE INDEX "idx_relacionamentos_pessoa_relacionada_id" ON "public"."relacionamentos" USING "btree" ("pessoa_relacionada_id");



CREATE INDEX "idx_tags_funcoes_igreja" ON "public"."tags_funcoes" USING "btree" ("igreja_id");



CREATE INDEX "idx_usuarios_acesso_igreja" ON "public"."usuarios_acesso" USING "btree" ("igreja_id");



CREATE INDEX "idx_usuarios_acesso_pessoa_id" ON "public"."usuarios_acesso" USING "btree" ("pessoa_id");



CREATE INDEX "idx_usuarios_igrejas_igreja" ON "public"."usuarios_igrejas" USING "btree" ("igreja_id");



CREATE INDEX "idx_usuarios_igrejas_usuario" ON "public"."usuarios_igrejas" USING "btree" ("usuario_id");



CREATE INDEX "idx_usuarios_permitidos_cargo" ON "public"."usuarios_acesso" USING "btree" ("cargo");



CREATE INDEX "idx_usuarios_tags_igreja" ON "public"."usuarios_tags" USING "btree" ("igreja_id");



CREATE INDEX "idx_usuarios_tags_pessoa_id" ON "public"."usuarios_tags" USING "btree" ("pessoa_id");



CREATE INDEX "idx_usuarios_tags_tag" ON "public"."usuarios_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_usuarios_tags_usuario" ON "public"."usuarios_tags" USING "btree" ("usuario_id");



CREATE INDEX "igreja_formas_contribuir_igreja_idx" ON "public"."igreja_formas_contribuir" USING "btree" ("igreja_id", "ativo", "ordem");



CREATE UNIQUE INDEX "igrejas_slug_unico" ON "public"."igrejas" USING "btree" ("lower"("slug"));



CREATE INDEX "noticias_mensais_igreja_mes_idx" ON "public"."noticias_mensais" USING "btree" ("igreja_id", "ano_referencia", "mes_referencia", "ordem");



CREATE INDEX "notification_deliveries_pending_idx" ON "public"."notification_deliveries" USING "btree" ("status", "canal", "scheduled_at");



CREATE UNIQUE INDEX "notification_deliveries_pending_unique_idx" ON "public"."notification_deliveries" USING "btree" ("notification_id", "canal");



CREATE INDEX "notification_deliveries_status_schedule_idx" ON "public"."notification_deliveries" USING "btree" ("status", "scheduled_at");



CREATE INDEX "notification_events_igreja_tipo_idx" ON "public"."notification_events" USING "btree" ("igreja_id", "tipo", "criado_em" DESC);



CREATE INDEX "notification_preferences_lookup_idx" ON "public"."notification_preferences" USING "btree" ("usuario_acesso_id", "igreja_id", "tipo", "canal");



CREATE UNIQUE INDEX "notifications_event_recipient_unique_idx" ON "public"."notifications" USING "btree" ("event_id", "usuario_acesso_id", "pessoa_id");



CREATE UNIQUE INDEX "notifications_pastoral_bucket_unique_idx" ON "public"."notifications" USING "btree" ("tipo", "igreja_id", "usuario_acesso_id", "pastoral_bucket");



CREATE INDEX "notifications_pessoa_created_idx" ON "public"."notifications" USING "btree" ("pessoa_id", "created_at" DESC);



CREATE INDEX "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("igreja_id", "usuario_acesso_id", "tipo", "read_at");



CREATE INDEX "notifications_usuario_created_idx" ON "public"."notifications" USING "btree" ("usuario_acesso_id", "created_at" DESC);



CREATE INDEX "oikos_leads_contato_idx" ON "public"."oikos_leads" USING "btree" ("lower"("contato"));



CREATE INDEX "oikos_leads_status_idx" ON "public"."oikos_leads" USING "btree" ("status", "criado_em" DESC);



CREATE INDEX "pedidos_pastorais_igreja_criado_em_idx" ON "public"."pedidos_pastorais" USING "btree" ("igreja_id", "criado_em" DESC);



CREATE UNIQUE INDEX "pessoas_cadastro_token_key" ON "public"."pessoas" USING "btree" ("cadastro_token");



CREATE INDEX "pessoas_email_idx" ON "public"."pessoas" USING "btree" ("email");



CREATE UNIQUE INDEX "pessoas_igrejas_unique_idx" ON "public"."pessoas_igrejas" USING "btree" ("pessoa_id", "igreja_id");



CREATE INDEX "pessoas_telefone_idx" ON "public"."pessoas" USING "btree" ("telefone");



CREATE INDEX "push_dispositivos_igreja_idx" ON "public"."push_dispositivos" USING "btree" ("igreja_id");



CREATE INDEX "push_dispositivos_pessoa_idx" ON "public"."push_dispositivos" USING "btree" ("pessoa_id");



CREATE INDEX "push_notificacoes_fila_igreja_idx" ON "public"."push_notificacoes_fila" USING "btree" ("igreja_id", "criado_em" DESC);



CREATE INDEX "push_notificacoes_fila_pessoa_idx" ON "public"."push_notificacoes_fila" USING "btree" ("pessoa_id", "criado_em" DESC);



CREATE INDEX "push_notificacoes_fila_status_idx" ON "public"."push_notificacoes_fila" USING "btree" ("status", "agendada_para");



CREATE INDEX "recursos_multimidia_igreja_idx" ON "public"."recursos_multimidia" USING "btree" ("igreja_id", "ativo", "data_recurso" DESC);



CREATE INDEX "recursos_multimidia_publico_idx" ON "public"."recursos_multimidia" USING "btree" ("ativo", "data_recurso" DESC, "ordem");



CREATE UNIQUE INDEX "usuarios_acesso_auth_user_id_unique_idx" ON "public"."usuarios_acesso" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "usuarios_acesso_email_unique_idx" ON "public"."usuarios_acesso" USING "btree" ("email");



CREATE UNIQUE INDEX "usuarios_acesso_pessoa_id_unique_idx" ON "public"."usuarios_acesso" USING "btree" ("pessoa_id") WHERE ("pessoa_id" IS NOT NULL);



CREATE UNIQUE INDEX "usuarios_igrejas_unique_idx" ON "public"."usuarios_igrejas" USING "btree" ("usuario_id", "igreja_id");



CREATE UNIQUE INDEX "usuarios_tags_usuario_igreja_tag_unique_idx" ON "public"."usuarios_tags" USING "btree" ("usuario_id", "igreja_id", "tag_id") WHERE (("usuario_id" IS NOT NULL) AND ("igreja_id" IS NOT NULL));



CREATE OR REPLACE TRIGGER "escalas_funcoes_igreja" BEFORE INSERT OR UPDATE ON "public"."escalas_funcoes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_escalas_funcoes_igreja"();



CREATE OR REPLACE TRIGGER "eventos_atualizado_em_bu" BEFORE UPDATE ON "public"."eventos" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_eventos_atualizado_em"();



CREATE OR REPLACE TRIGGER "louvor_itens_igreja" BEFORE INSERT OR UPDATE OF "culto_id", "igreja_id" ON "public"."louvor_itens" FOR EACH ROW EXECUTE FUNCTION "public"."trg_louvor_itens_igreja"();



CREATE OR REPLACE TRIGGER "notas_pastorais_updated_at" BEFORE UPDATE ON "public"."notas_pastorais" FOR EACH ROW EXECUTE FUNCTION "public"."update_notas_pastorais_updated_at"();



CREATE OR REPLACE TRIGGER "notification_preferences_set_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "oikos_leads_atualizado_em_bu" BEFORE UPDATE ON "public"."oikos_leads" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_oikos_leads_atualizado_em"();



CREATE OR REPLACE TRIGGER "pedidos_pastorais_set_updated_at" BEFORE UPDATE ON "public"."pedidos_pastorais" FOR EACH ROW EXECUTE FUNCTION "public"."set_pedidos_pastorais_updated_at"();



CREATE OR REPLACE TRIGGER "pessoas_igrejas_updated_at" BEFORE UPDATE ON "public"."pessoas_igrejas" FOR EACH ROW EXECUTE FUNCTION "public"."sync_pessoas_igrejas_updated_at"();



CREATE OR REPLACE TRIGGER "pessoas_updated_at" BEFORE UPDATE ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."update_pessoas_updated_at"();



CREATE OR REPLACE TRIGGER "push_dispositivos_set_updated_at" BEFORE UPDATE ON "public"."push_dispositivos" FOR EACH ROW EXECUTE FUNCTION "public"."set_push_dispositivos_updated_at"();



CREATE OR REPLACE TRIGGER "push_notificacoes_fila_set_updated_at" BEFORE UPDATE ON "public"."push_notificacoes_fila" FOR EACH ROW EXECUTE FUNCTION "public"."set_push_notificacoes_fila_updated_at"();



CREATE OR REPLACE TRIGGER "recursos_multimidia_atualizado_em_bu" BEFORE UPDATE ON "public"."recursos_multimidia" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_recursos_multimidia_atualizado_em"();



CREATE OR REPLACE TRIGGER "sincronizar_acesso_pessoas_aiu" AFTER INSERT OR UPDATE OF "email", "nome", "telefone", "cargo", "ativo", "usuario_id" ON "public"."pessoas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sincronizar_acesso_pessoas"();



CREATE OR REPLACE TRIGGER "sincronizar_acesso_pessoas_igrejas_aiu" AFTER INSERT OR UPDATE OF "igreja_id", "cargo", "ativo" ON "public"."pessoas_igrejas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sincronizar_acesso_pessoas_igrejas"();



CREATE OR REPLACE TRIGGER "trg_relacionamento_inverso" AFTER INSERT ON "public"."relacionamentos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_relacionamento_inverso"();



CREATE OR REPLACE TRIGGER "usuarios_tags_igreja" BEFORE INSERT OR UPDATE OF "pessoa_id", "usuario_id", "igreja_id" ON "public"."usuarios_tags" FOR EACH ROW EXECUTE FUNCTION "public"."trg_usuarios_tags_igreja"();



ALTER TABLE ONLY "public"."Louvores IPPN"
    ADD CONSTRAINT "Louvores IPPN_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."boletim_itens"
    ADD CONSTRAINT "boletim_itens_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "public"."boletim_secoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boletim_secoes"
    ADD CONSTRAINT "boletim_secoes_culto_id_fkey" FOREIGN KEY ("culto_id") REFERENCES "public"."Louvores IPPN"("Culto nr.");



ALTER TABLE ONLY "public"."boletim_secoes"
    ADD CONSTRAINT "boletim_secoes_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."canticos"
    ADD CONSTRAINT "canticos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."confissoes_itens"
    ADD CONSTRAINT "confissoes_itens_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "public"."confissoes_documentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."convites_acesso"
    ADD CONSTRAINT "convites_acesso_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."convites_acesso"
    ADD CONSTRAINT "convites_acesso_usuario_acesso_legado_id_fkey" FOREIGN KEY ("usuario_acesso_legado_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_convidado_por_fkey" FOREIGN KEY ("convidado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escalas"
    ADD CONSTRAINT "escalas_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."escalas"
    ADD CONSTRAINT "escalas_culto_id_fkey" FOREIGN KEY ("culto_id") REFERENCES "public"."Louvores IPPN"("Culto nr.") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escalas_funcoes"
    ADD CONSTRAINT "escalas_funcoes_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "public"."escalas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."escalas_funcoes"
    ADD CONSTRAINT "escalas_funcoes_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."escalas_funcoes"
    ADD CONSTRAINT "escalas_funcoes_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."escalas_funcoes"
    ADD CONSTRAINT "escalas_funcoes_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags_funcoes"("id");



ALTER TABLE ONLY "public"."escalas"
    ADD CONSTRAINT "escalas_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."eventos"
    ADD CONSTRAINT "eventos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fin_categorias"
    ADD CONSTRAINT "fin_categorias_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_contas"
    ADD CONSTRAINT "fin_contas_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_equipe"
    ADD CONSTRAINT "fin_equipe_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_equipe"
    ADD CONSTRAINT "fin_equipe_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_exames"
    ADD CONSTRAINT "fin_exames_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_lancamentos"
    ADD CONSTRAINT "fin_lancamentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."fin_categorias"("id");



ALTER TABLE ONLY "public"."fin_lancamentos"
    ADD CONSTRAINT "fin_lancamentos_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "public"."fin_contas"("id");



ALTER TABLE ONLY "public"."fin_lancamentos"
    ADD CONSTRAINT "fin_lancamentos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."fin_contas"("id");



ALTER TABLE ONLY "public"."fin_lancamentos"
    ADD CONSTRAINT "fin_lancamentos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_lancamentos"
    ADD CONSTRAINT "fin_lancamentos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fin_orcamentos"
    ADD CONSTRAINT "fin_orcamentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."fin_categorias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fin_orcamentos"
    ADD CONSTRAINT "fin_orcamentos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."igreja_cultos"
    ADD CONSTRAINT "igreja_cultos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."igreja_formas_contribuir"
    ADD CONSTRAINT "igreja_formas_contribuir_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."igreja_redes_sociais"
    ADD CONSTRAINT "igreja_redes_sociais_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."louvor_itens"
    ADD CONSTRAINT "louvor_itens_culto_id_fkey" FOREIGN KEY ("culto_id") REFERENCES "public"."Louvores IPPN"("Culto nr.") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."louvor_itens"
    ADD CONSTRAINT "louvor_itens_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."modelo_culto_padrao"
    ADD CONSTRAINT "modelo_culto_padrao_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."modelos_liturgia"
    ADD CONSTRAINT "modelos_liturgia_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."notas_pastorais"
    ADD CONSTRAINT "notas_pastorais_autor_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."pessoas"("id");



ALTER TABLE ONLY "public"."notas_pastorais"
    ADD CONSTRAINT "notas_pastorais_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."notas_pastorais"
    ADD CONSTRAINT "notas_pastorais_membro_fkey" FOREIGN KEY ("membro_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."noticias_mensais"
    ADD CONSTRAINT "noticias_mensais_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_usuario_acesso_id_fkey" FOREIGN KEY ("usuario_acesso_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_usuario_acesso_id_fkey" FOREIGN KEY ("usuario_acesso_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_pastorais"
    ADD CONSTRAINT "pedidos_pastorais_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_pastorais"
    ADD CONSTRAINT "pedidos_pastorais_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos_pastorais"
    ADD CONSTRAINT "pedidos_pastorais_usuario_acesso_id_fkey" FOREIGN KEY ("usuario_acesso_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pessoas_igrejas"
    ADD CONSTRAINT "pessoas_igrejas_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pessoas_igrejas"
    ADD CONSTRAINT "pessoas_igrejas_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pessoas"
    ADD CONSTRAINT "pessoas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plataforma_admins"
    ADD CONSTRAINT "plataforma_admins_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_dispositivos"
    ADD CONSTRAINT "push_dispositivos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_dispositivos"
    ADD CONSTRAINT "push_dispositivos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_dispositivos"
    ADD CONSTRAINT "push_dispositivos_usuario_acesso_id_fkey" FOREIGN KEY ("usuario_acesso_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_notificacoes_fila"
    ADD CONSTRAINT "push_notificacoes_fila_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "public"."escalas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_notificacoes_fila"
    ADD CONSTRAINT "push_notificacoes_fila_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_notificacoes_fila"
    ADD CONSTRAINT "push_notificacoes_fila_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recursos_multimidia"
    ADD CONSTRAINT "recursos_multimidia_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relacionamentos"
    ADD CONSTRAINT "relacionamentos_pessoa_relacionada_id_fkey" FOREIGN KEY ("pessoa_relacionada_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags_funcoes"
    ADD CONSTRAINT "tags_funcoes_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."usuarios_acesso"
    ADD CONSTRAINT "usuarios_acesso_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuarios_acesso"
    ADD CONSTRAINT "usuarios_acesso_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."usuarios_acesso"
    ADD CONSTRAINT "usuarios_acesso_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_igrejas"
    ADD CONSTRAINT "usuarios_igrejas_igreja_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_igrejas"
    ADD CONSTRAINT "usuarios_igrejas_usuario_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_acesso"
    ADD CONSTRAINT "usuarios_permitidos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."usuarios_tags"
    ADD CONSTRAINT "usuarios_tags_igreja_id_fkey" FOREIGN KEY ("igreja_id") REFERENCES "public"."igrejas"("id");



ALTER TABLE ONLY "public"."usuarios_tags"
    ADD CONSTRAINT "usuarios_tags_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_tags"
    ADD CONSTRAINT "usuarios_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags_funcoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_tags"
    ADD CONSTRAINT "usuarios_tags_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_acesso"("id") ON DELETE CASCADE;



CREATE POLICY "Admin e pastor podem deletar notas" ON "public"."notas_pastorais" FOR DELETE TO "authenticated" USING ("public"."pode_gerenciar_pessoa"("membro_id"));



CREATE POLICY "Admins podem criar tags" ON "public"."tags_funcoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "Admins podem deletar tags" ON "public"."tags_funcoes" FOR DELETE TO "authenticated" USING ("public"."is_global_admin"());



CREATE POLICY "Admins podem editar tags" ON "public"."tags_funcoes" FOR UPDATE TO "authenticated" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "Admins podem gerenciar convites" ON "public"."convites" TO "authenticated" USING (("public"."is_global_admin"() OR "public"."can_manage_church"("igreja_id"))) WITH CHECK (("public"."is_global_admin"() OR "public"."can_manage_church"("igreja_id")));



CREATE POLICY "Apenas logados veem tags_funcoes" ON "public"."tags_funcoes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Autor pode editar suas notas" ON "public"."notas_pastorais" FOR UPDATE TO "authenticated" USING ((("autor_id" = "public"."current_person_id"()) AND "public"."pode_gerenciar_pessoa"("membro_id"))) WITH CHECK ((("autor_id" = "public"."current_person_id"()) AND "public"."pode_gerenciar_pessoa"("membro_id")));



CREATE POLICY "Liderança pode criar notas" ON "public"."notas_pastorais" FOR INSERT TO "authenticated" WITH CHECK ((("autor_id" = "public"."current_person_id"()) AND "public"."pode_gerenciar_pessoa"("membro_id")));



ALTER TABLE "public"."Louvores IPPN" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Notas visíveis para liderança" ON "public"."notas_pastorais" FOR SELECT TO "authenticated" USING ("public"."pode_gerenciar_pessoa"("membro_id"));



CREATE POLICY "Público vê cultos conforme configuracao da igreja" ON "public"."Louvores IPPN" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."igrejas" "i"
  WHERE (("i"."id" = "Louvores IPPN"."igreja_id") AND ("i"."ativo" = true) AND ("i"."visivel_publico" = true) AND ("Louvores IPPN"."Dia" <=
        CASE
            WHEN (EXTRACT(dow FROM ("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text"))) = (0)::numeric) THEN (("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text")))::"date"
            WHEN ((EXTRACT(dow FROM ("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text"))) > ((COALESCE("i"."dia_publicacao_boletim", 7) % 7))::numeric) OR ((EXTRACT(dow FROM ("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text"))) = ((COALESCE("i"."dia_publicacao_boletim", 7) % 7))::numeric) AND ((("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text")))::time without time zone >= COALESCE((NULLIF("i"."horario_publicacao_boletim", ''::"text"))::time without time zone, '14:00:00'::time without time zone)))) THEN ((("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text")))::"date" + ((7 - (EXTRACT(dow FROM ("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text"))))::integer) % 7))
            ELSE ((("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text")))::"date" - (EXTRACT(dow FROM ("now"() AT TIME ZONE COALESCE("i"."timezone_boletim", 'America/Manaus'::"text"))))::integer)
        END)))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boletim_itens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boletim_itens_delete_por_secao" ON "public"."boletim_itens" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."boletim_secoes" "bs"
  WHERE (("bs"."id" = "boletim_itens"."secao_id") AND "public"."usuario_tem_acesso_igreja"("bs"."igreja_id")))));



CREATE POLICY "boletim_itens_insert_por_secao" ON "public"."boletim_itens" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boletim_secoes" "bs"
  WHERE (("bs"."id" = "boletim_itens"."secao_id") AND "public"."usuario_tem_acesso_igreja"("bs"."igreja_id")))));



CREATE POLICY "boletim_itens_select_por_secao" ON "public"."boletim_itens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."boletim_secoes" "bs"
  WHERE (("bs"."id" = "boletim_itens"."secao_id") AND "public"."usuario_tem_acesso_igreja"("bs"."igreja_id")))));



CREATE POLICY "boletim_itens_update_por_secao" ON "public"."boletim_itens" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."boletim_secoes" "bs"
  WHERE (("bs"."id" = "boletim_itens"."secao_id") AND "public"."usuario_tem_acesso_igreja"("bs"."igreja_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boletim_secoes" "bs"
  WHERE (("bs"."id" = "boletim_itens"."secao_id") AND "public"."usuario_tem_acesso_igreja"("bs"."igreja_id")))));



ALTER TABLE "public"."boletim_secoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boletim_secoes_delete_por_igreja" ON "public"."boletim_secoes" FOR DELETE TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "boletim_secoes_insert_por_igreja" ON "public"."boletim_secoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "boletim_secoes_select_por_igreja" ON "public"."boletim_secoes" FOR SELECT TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "boletim_secoes_update_por_igreja" ON "public"."boletim_secoes" FOR UPDATE TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id")) WITH CHECK ("public"."usuario_tem_acesso_igreja"("igreja_id"));



ALTER TABLE "public"."canticos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "canticos_delete_louvor" ON "public"."canticos" FOR DELETE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "canticos_insert_igreja" ON "public"."canticos" FOR INSERT TO "authenticated" WITH CHECK ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "canticos_select_igreja" ON "public"."canticos" FOR SELECT TO "authenticated" USING ((("igreja_id" IS NULL) OR "public"."eh_membro_igreja"("igreja_id")));



CREATE POLICY "canticos_update_igreja" ON "public"."canticos" FOR UPDATE TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id")) WITH CHECK ("public"."usuario_tem_acesso_igreja"("igreja_id"));



ALTER TABLE "public"."confissoes_documentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "confissoes_documentos_select_publico" ON "public"."confissoes_documentos" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."confissoes_itens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "confissoes_itens_select_publico" ON "public"."confissoes_itens" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."convites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."convites_acesso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cultos_delete_louvor" ON "public"."Louvores IPPN" FOR DELETE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "cultos_insert_louvor" ON "public"."Louvores IPPN" FOR INSERT TO "authenticated" WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "cultos_select_igreja" ON "public"."Louvores IPPN" FOR SELECT TO "authenticated" USING ("public"."eh_membro_igreja"("igreja_id"));



CREATE POLICY "cultos_update_louvor" ON "public"."Louvores IPPN" FOR UPDATE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id")) WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "ef_delete_louvor" ON "public"."escalas_funcoes" FOR DELETE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "ef_insert_louvor" ON "public"."escalas_funcoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "ef_musico_confirma_presenca" ON "public"."escalas_funcoes" FOR UPDATE TO "authenticated" USING (("pessoa_id" = "public"."current_person_id"())) WITH CHECK (("pessoa_id" = "public"."current_person_id"()));



CREATE POLICY "ef_select_igreja" ON "public"."escalas_funcoes" FOR SELECT TO "authenticated" USING ("public"."eh_membro_igreja"("igreja_id"));



CREATE POLICY "ef_update_louvor" ON "public"."escalas_funcoes" FOR UPDATE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id")) WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



ALTER TABLE "public"."escalas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escalas_delete_louvor" ON "public"."escalas" FOR DELETE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id"));



ALTER TABLE "public"."escalas_funcoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "escalas_insert_louvor" ON "public"."escalas" FOR INSERT TO "authenticated" WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "escalas_select_igreja" ON "public"."escalas" FOR SELECT TO "authenticated" USING ("public"."eh_membro_igreja"("igreja_id"));



CREATE POLICY "escalas_update_louvor" ON "public"."escalas" FOR UPDATE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id")) WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



ALTER TABLE "public"."eventos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eventos_select_publico" ON "public"."eventos" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."fin_categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fin_contas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fin_equipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fin_exames" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fin_lancamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fin_orcamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hinario_novo_cantico" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hinario_novo_cantico_select_publico" ON "public"."hinario_novo_cantico" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."igreja_cultos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."igreja_formas_contribuir" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "igreja_formas_contribuir_select_publico" ON "public"."igreja_formas_contribuir" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."igreja_redes_sociais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."igrejas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "igrejas_select_publico" ON "public"."igrejas" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."louvor_itens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "louvor_itens_delete_louvor" ON "public"."louvor_itens" FOR DELETE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "louvor_itens_insert_louvor" ON "public"."louvor_itens" FOR INSERT TO "authenticated" WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



CREATE POLICY "louvor_itens_select_igreja" ON "public"."louvor_itens" FOR SELECT TO "authenticated" USING ("public"."eh_membro_igreja"("igreja_id"));



CREATE POLICY "louvor_itens_update_louvor" ON "public"."louvor_itens" FOR UPDATE TO "authenticated" USING ("public"."tem_acesso_louvor_igreja"("igreja_id")) WITH CHECK ("public"."tem_acesso_louvor_igreja"("igreja_id"));



ALTER TABLE "public"."modelo_culto_padrao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modelos_liturgia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modelos_liturgia_select_por_igreja" ON "public"."modelos_liturgia" FOR SELECT TO "authenticated" USING ((("igreja_id" IS NULL) OR "public"."usuario_tem_acesso_igreja"("igreja_id")));



ALTER TABLE "public"."notas_pastorais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."noticias_mensais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "noticias_mensais_delete_por_igreja" ON "public"."noticias_mensais" FOR DELETE TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "noticias_mensais_insert_por_igreja" ON "public"."noticias_mensais" FOR INSERT TO "authenticated" WITH CHECK ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "noticias_mensais_select_por_igreja" ON "public"."noticias_mensais" FOR SELECT TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id"));



CREATE POLICY "noticias_mensais_update_por_igreja" ON "public"."noticias_mensais" FOR UPDATE TO "authenticated" USING ("public"."usuario_tem_acesso_igreja"("igreja_id")) WITH CHECK ("public"."usuario_tem_acesso_igreja"("igreja_id"));



ALTER TABLE "public"."notification_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oikos_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos_pastorais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedidos_pastorais_insert_public" ON "public"."pedidos_pastorais" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."igrejas" "i"
  WHERE (("i"."id" = "pedidos_pastorais"."igreja_id") AND ("i"."ativo" = true)))));



CREATE POLICY "pedidos_pastorais_select_pastoral" ON "public"."pedidos_pastorais" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."usuarios_acesso" "ua"
     JOIN "public"."usuarios_igrejas" "ui" ON (("ui"."usuario_id" = "ua"."id")))
  WHERE (("ua"."auth_user_id" = "auth"."uid"()) AND ("ui"."igreja_id" = "pedidos_pastorais"."igreja_id") AND ("ui"."ativo" = true) AND ("ui"."cargo" = ANY (ARRAY['superadmin'::"public"."cargo_tipo", 'pastor'::"public"."cargo_tipo", 'presbitero'::"public"."cargo_tipo", 'seminarista'::"public"."cargo_tipo"]))))));



CREATE POLICY "pedidos_pastorais_update_pastoral" ON "public"."pedidos_pastorais" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."usuarios_acesso" "ua"
     JOIN "public"."usuarios_igrejas" "ui" ON (("ui"."usuario_id" = "ua"."id")))
  WHERE (("ua"."auth_user_id" = "auth"."uid"()) AND ("ui"."igreja_id" = "pedidos_pastorais"."igreja_id") AND ("ui"."ativo" = true) AND ("ui"."cargo" = ANY (ARRAY['superadmin'::"public"."cargo_tipo", 'pastor'::"public"."cargo_tipo", 'presbitero'::"public"."cargo_tipo", 'seminarista'::"public"."cargo_tipo"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."usuarios_acesso" "ua"
     JOIN "public"."usuarios_igrejas" "ui" ON (("ui"."usuario_id" = "ua"."id")))
  WHERE (("ua"."auth_user_id" = "auth"."uid"()) AND ("ui"."igreja_id" = "pedidos_pastorais"."igreja_id") AND ("ui"."ativo" = true) AND ("ui"."cargo" = ANY (ARRAY['superadmin'::"public"."cargo_tipo", 'pastor'::"public"."cargo_tipo", 'presbitero'::"public"."cargo_tipo", 'seminarista'::"public"."cargo_tipo"]))))));



ALTER TABLE "public"."pessoas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pessoas_igrejas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pessoas_igrejas_insert_admin" ON "public"."pessoas_igrejas" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_manage_church"("igreja_id") OR "public"."is_global_admin"()));



CREATE POLICY "pessoas_igrejas_select_self_or_admin" ON "public"."pessoas_igrejas" FOR SELECT TO "authenticated" USING ((("pessoa_id" = "public"."current_person_id"()) OR "public"."can_manage_church"("igreja_id") OR "public"."is_global_admin"()));



CREATE POLICY "pessoas_igrejas_update_admin" ON "public"."pessoas_igrejas" FOR UPDATE TO "authenticated" USING (("public"."can_manage_church"("igreja_id") OR "public"."is_global_admin"())) WITH CHECK (("public"."can_manage_church"("igreja_id") OR "public"."is_global_admin"()));



CREATE POLICY "pessoas_select_self_or_admin" ON "public"."pessoas" FOR SELECT TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR ("id" = "public"."current_person_id"()) OR "public"."pode_gerenciar_pessoa"("id") OR "public"."pessoa_visivel_em_escala"("id")));



CREATE POLICY "pessoas_update_self_or_admin" ON "public"."pessoas" FOR UPDATE TO "authenticated" USING ((("usuario_id" = "auth"."uid"()) OR ("id" = "public"."current_person_id"()) OR "public"."is_global_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."pessoas_igrejas" "pi"
  WHERE (("pi"."pessoa_id" = "pessoas"."id") AND "public"."can_manage_church"("pi"."igreja_id")))))) WITH CHECK ((("usuario_id" = "auth"."uid"()) OR ("id" = "public"."current_person_id"()) OR "public"."is_global_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."pessoas_igrejas" "pi"
  WHERE (("pi"."pessoa_id" = "pessoas"."id") AND "public"."can_manage_church"("pi"."igreja_id"))))));



ALTER TABLE "public"."plataforma_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_dispositivos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_notificacoes_fila" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_notificacoes_fila_select_pastoral" ON "public"."push_notificacoes_fila" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."usuarios_acesso" "ua"
     JOIN "public"."usuarios_igrejas" "ui" ON (("ui"."usuario_id" = "ua"."id")))
  WHERE (("ua"."auth_user_id" = "auth"."uid"()) AND ("ui"."igreja_id" = "push_notificacoes_fila"."igreja_id") AND ("ui"."ativo" = true) AND ("ui"."cargo" = ANY (ARRAY['superadmin'::"public"."cargo_tipo", 'pastor'::"public"."cargo_tipo", 'presbitero'::"public"."cargo_tipo", 'seminarista'::"public"."cargo_tipo", 'secretario'::"public"."cargo_tipo"]))))));



ALTER TABLE "public"."recursos_multimidia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relacionamentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relacionamentos_delete_por_igreja" ON "public"."relacionamentos" FOR DELETE TO "authenticated" USING ("public"."usuario_tem_acesso_pessoa"("pessoa_id"));



CREATE POLICY "relacionamentos_insert_por_igreja" ON "public"."relacionamentos" FOR INSERT TO "authenticated" WITH CHECK (("public"."usuario_tem_acesso_pessoa"("pessoa_id") AND "public"."usuario_tem_acesso_pessoa"("pessoa_relacionada_id")));



CREATE POLICY "relacionamentos_select_por_igreja" ON "public"."relacionamentos" FOR SELECT TO "authenticated" USING ("public"."usuario_tem_acesso_pessoa"("pessoa_id"));



CREATE POLICY "relacionamentos_update_por_igreja" ON "public"."relacionamentos" FOR UPDATE TO "authenticated" USING ("public"."usuario_tem_acesso_pessoa"("pessoa_id")) WITH CHECK (("public"."usuario_tem_acesso_pessoa"("pessoa_id") AND "public"."usuario_tem_acesso_pessoa"("pessoa_relacionada_id")));



ALTER TABLE "public"."tags_funcoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuarios_acesso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_acesso_delete_admin" ON "public"."usuarios_acesso" FOR DELETE TO "authenticated" USING ("public"."is_global_admin"());



CREATE POLICY "usuarios_acesso_insert_admin" ON "public"."usuarios_acesso" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "usuarios_acesso_select_self_or_admin" ON "public"."usuarios_acesso" FOR SELECT TO "authenticated" USING ((("auth_user_id" = "auth"."uid"()) OR "public"."pode_gerenciar_usuario_acesso"("id")));



CREATE POLICY "usuarios_acesso_update_admin" ON "public"."usuarios_acesso" FOR UPDATE TO "authenticated" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



ALTER TABLE "public"."usuarios_igrejas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_igrejas_delete_admin" ON "public"."usuarios_igrejas" FOR DELETE TO "authenticated" USING ("public"."can_manage_church"("igreja_id"));



CREATE POLICY "usuarios_igrejas_insert_admin" ON "public"."usuarios_igrejas" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_church"("igreja_id"));



CREATE POLICY "usuarios_igrejas_select_self_or_admin" ON "public"."usuarios_igrejas" FOR SELECT TO "authenticated" USING (("public"."can_manage_church"("igreja_id") OR ("usuario_id" = "public"."current_access_user_id"())));



CREATE POLICY "usuarios_igrejas_update_admin" ON "public"."usuarios_igrejas" FOR UPDATE TO "authenticated" USING ("public"."can_manage_church"("igreja_id")) WITH CHECK ("public"."can_manage_church"("igreja_id"));



ALTER TABLE "public"."usuarios_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_tags_delete_admin" ON "public"."usuarios_tags" FOR DELETE TO "authenticated" USING (("public"."can_manage_church"("igreja_id") OR "public"."pode_gerenciar_pessoa"("pessoa_id")));



CREATE POLICY "usuarios_tags_delete_self" ON "public"."usuarios_tags" FOR DELETE TO "authenticated" USING ((("pessoa_id" = "public"."current_person_id"()) AND "public"."tag_autoatribuivel"("tag_id")));



CREATE POLICY "usuarios_tags_insert_admin" ON "public"."usuarios_tags" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_manage_church"("igreja_id") OR "public"."pode_gerenciar_pessoa"("pessoa_id")));



CREATE POLICY "usuarios_tags_insert_self" ON "public"."usuarios_tags" FOR INSERT TO "authenticated" WITH CHECK ((("pessoa_id" = "public"."current_person_id"()) AND "public"."eh_membro_igreja"("igreja_id") AND "public"."tag_autoatribuivel"("tag_id")));



CREATE POLICY "usuarios_tags_select_self_or_admin" ON "public"."usuarios_tags" FOR SELECT TO "authenticated" USING ((("usuario_id" = "public"."current_access_user_id"()) OR ("pessoa_id" = "public"."current_person_id"()) OR "public"."can_manage_church"("igreja_id") OR "public"."pode_gerenciar_pessoa"("pessoa_id")));



CREATE POLICY "usuarios_tags_update_admin" ON "public"."usuarios_tags" FOR UPDATE TO "authenticated" USING (("public"."can_manage_church"("igreja_id") OR "public"."pode_gerenciar_pessoa"("pessoa_id"))) WITH CHECK (("public"."can_manage_church"("igreja_id") OR "public"."pode_gerenciar_pessoa"("pessoa_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."Louvores IPPN";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."active_access_count_for_church"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."active_access_count_for_church"("p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_create_access_user"("p_igreja_id" "uuid", "p_email" "text", "p_nome" "text", "p_telefone" "text", "p_cargo" "public"."cargo_tipo", "p_pessoa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_access_user"("p_igreja_id" "uuid", "p_email" "text", "p_nome" "text", "p_telefone" "text", "p_cargo" "public"."cargo_tipo", "p_pessoa_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_user_church_access"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_cargo" "public"."cargo_tipo", "p_ativo" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_church_access"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_cargo" "public"."cargo_tipo", "p_ativo" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_user_tag_for_church"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_tag_id" "uuid", "p_habilitado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_tag_for_church"("p_usuario_id" "uuid", "p_igreja_id" "uuid", "p_tag_id" "uuid", "p_habilitado" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_upsert_access_user"("p_user_id" "uuid", "p_nome" "text", "p_email" "text", "p_telefone" "text", "p_pessoa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_upsert_access_user"("p_user_id" "uuid", "p_nome" "text", "p_email" "text", "p_telefone" "text", "p_pessoa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_eventos_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_eventos_atualizado_em"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_oikos_leads_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_oikos_leads_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_oikos_leads_atualizado_em"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_recursos_multimidia_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_recursos_multimidia_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_recursos_multimidia_atualizado_em"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_add_active_access_for_church"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_add_active_access_for_church"("p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_any_church"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_any_church"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_any_church"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_church"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_church"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_church"("p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_access_user_by_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_access_user_by_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_event"("p_tipo" "text", "p_igreja_id" "uuid", "p_entidade_tipo" "text", "p_entidade_id" "text", "p_chave_deduplicacao" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_event"("p_tipo" "text", "p_igreja_id" "uuid", "p_entidade_tipo" "text", "p_entidade_id" "text", "p_chave_deduplicacao" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_event"("p_tipo" "text", "p_igreja_id" "uuid", "p_entidade_tipo" "text", "p_entidade_id" "text", "p_chave_deduplicacao" "text", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_access_user_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_access_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_access_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_global_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_global_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_global_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_person_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_person_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_person_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."eh_membro_igreja"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eh_membro_igreja"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eh_membro_igreja"("p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."email_permitido"("email_check" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."email_permitido"("email_check" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_notification_delivery"("p_notification_id" "uuid", "p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel", "p_destino" "text", "p_payload" "jsonb", "p_force" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_notification_delivery"("p_notification_id" "uuid", "p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel", "p_destino" "text", "p_payload" "jsonb", "p_force" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_notification_delivery"("p_notification_id" "uuid", "p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel", "p_destino" "text", "p_payload" "jsonb", "p_force" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_notifications_for_scale_assignments"("p_escala_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_notifications_for_scale_assignments"("p_escala_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_locale" "text", "p_delay_seconds" bigint, "p_canal" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_locale" "text", "p_delay_seconds" bigint, "p_canal" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_igreja_id" "uuid", "p_delay_seconds" bigint, "p_canal" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_corpo" "text", "p_payload" "jsonb", "p_deep_link" "text", "p_igreja_id" "uuid", "p_delay_seconds" bigint, "p_canal" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_titulo" "text", "p_mensagem" "text", "p_payload" "jsonb", "p_pessoa_id" "uuid", "p_escala_id" "uuid", "p_culto_id" integer, "p_chave_deduplicacao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_titulo" "text", "p_mensagem" "text", "p_payload" "jsonb", "p_pessoa_id" "uuid", "p_escala_id" "uuid", "p_culto_id" integer, "p_chave_deduplicacao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_payload" "jsonb", "p_corpo" "text", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_push_notification"("p_tipo" "text", "p_igreja_id" "uuid", "p_usuario_acesso_id" "uuid", "p_titulo" "text", "p_payload" "jsonb", "p_corpo" "text", "p_deep_link" "text", "p_delay_seconds" bigint, "p_canal" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_relacionamento_inverso"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_relacionamento_inverso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_relacionamento_inverso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tipo_inverso"("tipo" "public"."tipo_relacionamento") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tipo_inverso"("tipo" "public"."tipo_relacionamento") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tipo_inverso"("tipo" "public"."tipo_relacionamento") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_global_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_global_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_global_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_musico"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_musico"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_musico"() TO "service_role";



GRANT ALL ON FUNCTION "public"."marcar_convites_expirados"() TO "anon";
GRANT ALL ON FUNCTION "public"."marcar_convites_expirados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_convites_expirados"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notification_channel_enabled"("p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel") TO "anon";
GRANT ALL ON FUNCTION "public"."notification_channel_enabled"("p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notification_channel_enabled"("p_usuario_acesso_id" "uuid", "p_igreja_id" "uuid", "p_tipo" "text", "p_canal" "public"."notification_channel") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_boletim_available"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_boletim_available"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_escala_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_escala_assignment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_pastoral_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_pastoral_summary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_scale_assignments_after_upsert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_scale_assignments_after_upsert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_scale_published"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_scale_published"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pessoa_visivel_em_escala"("p_pessoa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pessoa_visivel_em_escala"("p_pessoa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pessoa_visivel_em_escala"("p_pessoa_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pode_gerenciar_escalas"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pode_gerenciar_escalas"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pode_gerenciar_escalas"("p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pode_gerenciar_pessoa"("p_pessoa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pode_gerenciar_pessoa"("p_pessoa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pode_gerenciar_pessoa"("p_pessoa_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pode_gerenciar_usuario_acesso"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pode_gerenciar_usuario_acesso"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pode_gerenciar_usuario_acesso"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ranking_canticos"("p_ano" integer, "p_mes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."ranking_canticos"("p_ano" integer, "p_mes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ranking_canticos"("p_ano" integer, "p_mes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_notification_igreja_id"("p_usuario_acesso_id" "uuid", "p_payload" "jsonb", "p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_notification_igreja_id"("p_usuario_acesso_id" "uuid", "p_payload" "jsonb", "p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."self_service_upsert_access_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."self_service_upsert_access_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_pedidos_pastorais_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_pedidos_pastorais_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pedidos_pastorais_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_push_dispositivos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_push_dispositivos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_push_dispositivos_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_push_notificacoes_fila_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_push_notificacoes_fila_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_push_notificacoes_fila_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sincronizar_acesso_pessoa_por_email"("p_pessoa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sincronizar_acesso_pessoa_por_email"("p_pessoa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_pessoas_igrejas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_pessoas_igrejas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_pessoas_igrejas_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tag_autoatribuivel"("p_tag_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tag_autoatribuivel"("p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tag_autoatribuivel"("p_tag_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."tem_acesso_louvor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tem_acesso_louvor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tem_acesso_louvor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tem_acesso_louvor_igreja"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tem_acesso_louvor_igreja"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tem_acesso_louvor_igreja"("p_igreja_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_escalas_funcoes_igreja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_escalas_funcoes_igreja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_louvor_itens_igreja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_louvor_itens_igreja"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_sincronizar_acesso_pessoas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_sincronizar_acesso_pessoas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_sincronizar_acesso_pessoas_igrejas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_sincronizar_acesso_pessoas_igrejas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_usuarios_tags_igreja"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_usuarios_tags_igreja"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notas_pastorais_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notas_pastorais_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notas_pastorais_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pessoas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pessoas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pessoas_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_tem_acesso_igreja"("p_igreja_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_tem_acesso_igreja"("p_igreja_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_tem_acesso_igreja"("p_igreja_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usuario_tem_acesso_pessoa"("p_pessoa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usuario_tem_acesso_pessoa"("p_pessoa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_tem_acesso_pessoa"("p_pessoa_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verificar_email_permitido"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verificar_email_permitido"() TO "service_role";


















GRANT ALL ON TABLE "public"."Louvores IPPN" TO "anon";
GRANT ALL ON TABLE "public"."Louvores IPPN" TO "authenticated";
GRANT ALL ON TABLE "public"."Louvores IPPN" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Louvores IPPN_Culto nr._seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Louvores IPPN_Culto nr._seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Louvores IPPN_Culto nr._seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."boletim_itens" TO "anon";
GRANT ALL ON TABLE "public"."boletim_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."boletim_itens" TO "service_role";



GRANT ALL ON TABLE "public"."boletim_secoes" TO "anon";
GRANT ALL ON TABLE "public"."boletim_secoes" TO "authenticated";
GRANT ALL ON TABLE "public"."boletim_secoes" TO "service_role";



GRANT ALL ON TABLE "public"."canticos" TO "anon";
GRANT ALL ON TABLE "public"."canticos" TO "authenticated";
GRANT ALL ON TABLE "public"."canticos" TO "service_role";



GRANT ALL ON TABLE "public"."hinario_novo_cantico" TO "anon";
GRANT ALL ON TABLE "public"."hinario_novo_cantico" TO "authenticated";
GRANT ALL ON TABLE "public"."hinario_novo_cantico" TO "service_role";



GRANT ALL ON TABLE "public"."canticos_unificados" TO "anon";
GRANT ALL ON TABLE "public"."canticos_unificados" TO "authenticated";
GRANT ALL ON TABLE "public"."canticos_unificados" TO "service_role";



GRANT ALL ON TABLE "public"."confissoes_documentos" TO "anon";
GRANT ALL ON TABLE "public"."confissoes_documentos" TO "authenticated";
GRANT ALL ON TABLE "public"."confissoes_documentos" TO "service_role";



GRANT ALL ON TABLE "public"."confissoes_itens" TO "anon";
GRANT ALL ON TABLE "public"."confissoes_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."confissoes_itens" TO "service_role";



GRANT ALL ON TABLE "public"."convites" TO "authenticated";
GRANT ALL ON TABLE "public"."convites" TO "service_role";



GRANT ALL ON TABLE "public"."convites_acesso" TO "anon";
GRANT ALL ON TABLE "public"."convites_acesso" TO "authenticated";
GRANT ALL ON TABLE "public"."convites_acesso" TO "service_role";



GRANT ALL ON TABLE "public"."escalas" TO "anon";
GRANT ALL ON TABLE "public"."escalas" TO "authenticated";
GRANT ALL ON TABLE "public"."escalas" TO "service_role";



GRANT ALL ON TABLE "public"."escalas_funcoes" TO "anon";
GRANT ALL ON TABLE "public"."escalas_funcoes" TO "authenticated";
GRANT ALL ON TABLE "public"."escalas_funcoes" TO "service_role";



GRANT ALL ON TABLE "public"."eventos" TO "anon";
GRANT ALL ON TABLE "public"."eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos" TO "service_role";



GRANT ALL ON TABLE "public"."fin_categorias" TO "anon";
GRANT ALL ON TABLE "public"."fin_categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."fin_categorias" TO "service_role";



GRANT ALL ON TABLE "public"."fin_contas" TO "anon";
GRANT ALL ON TABLE "public"."fin_contas" TO "authenticated";
GRANT ALL ON TABLE "public"."fin_contas" TO "service_role";



GRANT ALL ON TABLE "public"."fin_equipe" TO "anon";
GRANT ALL ON TABLE "public"."fin_equipe" TO "authenticated";
GRANT ALL ON TABLE "public"."fin_equipe" TO "service_role";



GRANT ALL ON TABLE "public"."fin_exames" TO "anon";
GRANT ALL ON TABLE "public"."fin_exames" TO "authenticated";
GRANT ALL ON TABLE "public"."fin_exames" TO "service_role";



GRANT ALL ON TABLE "public"."fin_lancamentos" TO "anon";
GRANT ALL ON TABLE "public"."fin_lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."fin_lancamentos" TO "service_role";



GRANT ALL ON TABLE "public"."fin_orcamentos" TO "anon";
GRANT ALL ON TABLE "public"."fin_orcamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."fin_orcamentos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hinario_novo_cantico_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hinario_novo_cantico_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hinario_novo_cantico_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."igreja_cultos" TO "anon";
GRANT ALL ON TABLE "public"."igreja_cultos" TO "authenticated";
GRANT ALL ON TABLE "public"."igreja_cultos" TO "service_role";



GRANT ALL ON TABLE "public"."igreja_formas_contribuir" TO "anon";
GRANT ALL ON TABLE "public"."igreja_formas_contribuir" TO "authenticated";
GRANT ALL ON TABLE "public"."igreja_formas_contribuir" TO "service_role";



GRANT ALL ON TABLE "public"."igreja_redes_sociais" TO "anon";
GRANT ALL ON TABLE "public"."igreja_redes_sociais" TO "authenticated";
GRANT ALL ON TABLE "public"."igreja_redes_sociais" TO "service_role";



GRANT ALL ON TABLE "public"."igrejas" TO "anon";
GRANT ALL ON TABLE "public"."igrejas" TO "authenticated";
GRANT ALL ON TABLE "public"."igrejas" TO "service_role";



GRANT ALL ON TABLE "public"."igrejas_endereco_view" TO "anon";
GRANT ALL ON TABLE "public"."igrejas_endereco_view" TO "authenticated";
GRANT ALL ON TABLE "public"."igrejas_endereco_view" TO "service_role";



GRANT ALL ON TABLE "public"."louvor_itens" TO "anon";
GRANT ALL ON TABLE "public"."louvor_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."louvor_itens" TO "service_role";



GRANT ALL ON TABLE "public"."modelo_culto_padrao" TO "anon";
GRANT ALL ON TABLE "public"."modelo_culto_padrao" TO "authenticated";
GRANT ALL ON TABLE "public"."modelo_culto_padrao" TO "service_role";



GRANT ALL ON TABLE "public"."modelos_liturgia" TO "anon";
GRANT ALL ON TABLE "public"."modelos_liturgia" TO "authenticated";
GRANT ALL ON TABLE "public"."modelos_liturgia" TO "service_role";



GRANT ALL ON TABLE "public"."notas_pastorais" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_pastorais" TO "service_role";



GRANT ALL ON TABLE "public"."noticias_mensais" TO "anon";
GRANT ALL ON TABLE "public"."noticias_mensais" TO "authenticated";
GRANT ALL ON TABLE "public"."noticias_mensais" TO "service_role";



GRANT ALL ON TABLE "public"."notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."notification_events" TO "anon";
GRANT ALL ON TABLE "public"."notification_events" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_events" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."oikos_leads" TO "anon";
GRANT ALL ON TABLE "public"."oikos_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."oikos_leads" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_pastorais" TO "anon";
GRANT ALL ON TABLE "public"."pedidos_pastorais" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_pastorais" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pessoas" TO "authenticated";
GRANT ALL ON TABLE "public"."pessoas" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("nome"),UPDATE("nome") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("cargo") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("email") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("telefone"),UPDATE("telefone") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("ativo") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("usuario_id") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("foto_url") ON TABLE "public"."pessoas" TO "authenticated";



GRANT UPDATE("atualizado_em") ON TABLE "public"."pessoas" TO "authenticated";



GRANT SELECT("apelido") ON TABLE "public"."pessoas" TO "authenticated";



GRANT ALL ON TABLE "public"."pessoas_igrejas" TO "anon";
GRANT ALL ON TABLE "public"."pessoas_igrejas" TO "authenticated";
GRANT ALL ON TABLE "public"."pessoas_igrejas" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_admins" TO "service_role";



GRANT ALL ON TABLE "public"."push_dispositivos" TO "anon";
GRANT ALL ON TABLE "public"."push_dispositivos" TO "authenticated";
GRANT ALL ON TABLE "public"."push_dispositivos" TO "service_role";



GRANT ALL ON TABLE "public"."push_notificacoes_fila" TO "anon";
GRANT ALL ON TABLE "public"."push_notificacoes_fila" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notificacoes_fila" TO "service_role";



GRANT ALL ON TABLE "public"."recursos_multimidia" TO "anon";
GRANT ALL ON TABLE "public"."recursos_multimidia" TO "authenticated";
GRANT ALL ON TABLE "public"."recursos_multimidia" TO "service_role";



GRANT ALL ON TABLE "public"."relacionamentos" TO "anon";
GRANT ALL ON TABLE "public"."relacionamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."relacionamentos" TO "service_role";



GRANT ALL ON TABLE "public"."tags_funcoes" TO "anon";
GRANT ALL ON TABLE "public"."tags_funcoes" TO "authenticated";
GRANT ALL ON TABLE "public"."tags_funcoes" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_acesso" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_acesso" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_acesso" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_igrejas" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_igrejas" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_igrejas" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_tags" TO "service_role";



GRANT ALL ON TABLE "public"."view_familias" TO "anon";
GRANT ALL ON TABLE "public"."view_familias" TO "authenticated";
GRANT ALL ON TABLE "public"."view_familias" TO "service_role";



GRANT ALL ON TABLE "public"."vw_cultos_com_escalas" TO "anon";
GRANT ALL ON TABLE "public"."vw_cultos_com_escalas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_cultos_com_escalas" TO "service_role";



GRANT ALL ON TABLE "public"."vw_cultos_incompletos" TO "anon";
GRANT ALL ON TABLE "public"."vw_cultos_incompletos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_cultos_incompletos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_estatisticas_canticos" TO "anon";
GRANT ALL ON TABLE "public"."vw_estatisticas_canticos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_estatisticas_canticos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_evolucao_mensal" TO "anon";
GRANT ALL ON TABLE "public"."vw_evolucao_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_evolucao_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."vw_execucoes_louvores" TO "anon";
GRANT ALL ON TABLE "public"."vw_execucoes_louvores" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_execucoes_louvores" TO "service_role";



GRANT ALL ON TABLE "public"."vw_ranking_tons" TO "anon";
GRANT ALL ON TABLE "public"."vw_ranking_tons" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_ranking_tons" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































