-- ============================================================================
-- Permite que o mesmo número de telefone seja usado por pessoas diferentes.
--
-- Antes, o telefone tinha uma constraint UNIQUE, o que fazia o cadastro
-- público (POST /api/cadastro-publico) tratar um telefone repetido como
-- "é a mesma pessoa" e sobrescrever o cadastro já existente. Isso é um
-- problema real: números de família compartilhados, celular emprestado etc.
-- fazem duas pessoas diferentes usarem o mesmo telefone.
--
-- Agora o telefone deixa de ser identificador único. A checagem de duplicidade
-- passa a ser só informativa, exibida na ficha do membro no admin.
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
     and att.attname = 'telefone';

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
     and att.attname = 'telefone'
     and not exists (
       select 1 from pg_constraint con where con.conindid = idx.indexrelid
     );

  if index_name is not null then
    execute format('drop index if exists %I', index_name);
  end if;
end $$;

-- Mantém um índice (não único) para acelerar a checagem de telefone duplicado.
create index if not exists pessoas_telefone_idx on pessoas (telefone);
