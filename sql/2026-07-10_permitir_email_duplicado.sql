-- ============================================================================
-- Permite que o mesmo e-mail seja usado por pessoas diferentes.
--
-- Depois de corrigir o mesmo problema com telefone (ver
-- 2026-07-06_permitir_telefone_duplicado.sql), o cadastro público
-- (POST /api/cadastro-publico) ainda casava pessoa existente pelo e-mail e
-- fazia UPDATE em vez de INSERT -- famílias que compartilham e-mail (ex.:
-- filha cadastra a mãe usando o próprio e-mail) faziam um cadastro
-- sobrescrever o outro.
--
-- Decisão: o cadastro público (link genérico /cadastro/{slug}) sempre cria
-- uma pessoa nova, nunca dá UPDATE. O único jeito de atualizar um cadastro
-- existente é pelo link individual /completar/{token}, que já resolve a
-- pessoa pelo token (ver 2026-06-18_cadastro_token_autocompletar.sql) e não
-- depende de e-mail/telefone. Esta migração remove a constraint UNIQUE de
-- email para o banco não bloquear o INSERT quando o e-mail já existir em
-- outra pessoa.
-- ============================================================================

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
   where rel.relname = 'pessoas'
     and con.contype = 'u'
     and array_length(con.conkey, 1) = 1
     and att.attname = 'email';

  if constraint_name is not null then
    execute format('alter table pessoas drop constraint %I', constraint_name);
  end if;
end $$;

-- Cobre também o caso de um índice único criado direto (sem virar constraint).
do $$
declare
  index_name text;
begin
  select cls_idx.relname
    into index_name
    from pg_index idx
    join pg_class cls_idx on cls_idx.oid = idx.indexrelid
    join pg_class cls_tab on cls_tab.oid = idx.indrelid
    join pg_attribute att on att.attrelid = cls_tab.oid and att.attnum = idx.indkey[0]
   where cls_tab.relname = 'pessoas'
     and idx.indisunique
     and idx.indnkeyatts = 1
     and att.attname = 'email'
     and not exists (
       select 1 from pg_constraint con where con.conindid = idx.indexrelid
     );

  if index_name is not null then
    execute format('drop index if exists %I', index_name);
  end if;
end $$;

-- Mantém um índice (não único) para acelerar buscas por e-mail.
create index if not exists pessoas_email_idx on pessoas (email);
