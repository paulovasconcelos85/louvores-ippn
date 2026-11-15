alter table public.modelos_liturgia
  add column if not exists conteudo_publico_padrao_i18n jsonb,
  add column if not exists descricao_interna_padrao_i18n jsonb;

update public.modelos_liturgia as ml
set conteudo_publico_padrao_i18n = source.conteudo_publico_padrao_i18n
from (
  select
    ml_inner.igreja_id,
    ml_inner.ordem,
    ml_inner.tipo,
    ml_inner.bloco,
    case
      when jsonb_typeof(item.value -> 'conteudo_publico_padrao_i18n') = 'object'
        then item.value -> 'conteudo_publico_padrao_i18n'
      when coalesce(item.value ->> 'conteudo_publico_padrao', '') <> ''
        then jsonb_build_object('pt', item.value ->> 'conteudo_publico_padrao')
      when coalesce(item.value ->> 'conteudo_publico', '') <> ''
        then jsonb_build_object('pt', item.value ->> 'conteudo_publico')
      else null
    end as conteudo_publico_padrao_i18n
  from public.modelos_liturgia as ml_inner
  join public.igrejas as i
    on i.id = ml_inner.igreja_id
  cross join lateral jsonb_array_elements(coalesce(i.modelo_liturgico_padrao, '[]'::jsonb)) as item(value)
  where coalesce(item.value ->> 'tipo', '') = coalesce(ml_inner.tipo, '')
    and coalesce(item.value ->> 'bloco', '') = coalesce(ml_inner.bloco, '')
    and coalesce(
      case
        when coalesce(item.value ->> 'ordem', '') ~ '^[0-9]+$'
          then (item.value ->> 'ordem')::integer
        else null
      end,
      0
    ) = coalesce(ml_inner.ordem, 0)
) as source
where ml.igreja_id = source.igreja_id
  and ml.ordem = source.ordem
  and ml.tipo = source.tipo
  and ml.bloco = source.bloco
  and source.conteudo_publico_padrao_i18n is not null
  and (
    ml.conteudo_publico_padrao_i18n is null
    or ml.conteudo_publico_padrao_i18n = '{}'::jsonb
  );

update public.modelos_liturgia as ml
set descricao_interna_padrao_i18n = source.descricao_interna_padrao_i18n
from (
  select
    ml_inner.igreja_id,
    ml_inner.ordem,
    ml_inner.tipo,
    ml_inner.bloco,
    case
      when jsonb_typeof(item.value -> 'descricao_interna_padrao_i18n') = 'object'
        then item.value -> 'descricao_interna_padrao_i18n'
      when coalesce(item.value ->> 'descricao_interna_padrao', '') <> ''
        then jsonb_build_object('pt', item.value ->> 'descricao_interna_padrao')
      when coalesce(item.value ->> 'descricao_padrao', '') <> ''
        then jsonb_build_object('pt', item.value ->> 'descricao_padrao')
      when coalesce(ml_inner.descricao_padrao, '') <> ''
        then jsonb_build_object('pt', ml_inner.descricao_padrao)
      else null
    end as descricao_interna_padrao_i18n
  from public.modelos_liturgia as ml_inner
  join public.igrejas as i
    on i.id = ml_inner.igreja_id
  cross join lateral jsonb_array_elements(coalesce(i.modelo_liturgico_padrao, '[]'::jsonb)) as item(value)
  where coalesce(item.value ->> 'tipo', '') = coalesce(ml_inner.tipo, '')
    and coalesce(item.value ->> 'bloco', '') = coalesce(ml_inner.bloco, '')
    and coalesce(
      case
        when coalesce(item.value ->> 'ordem', '') ~ '^[0-9]+$'
          then (item.value ->> 'ordem')::integer
        else null
      end,
      0
    ) = coalesce(ml_inner.ordem, 0)
) as source
where ml.igreja_id = source.igreja_id
  and ml.ordem = source.ordem
  and ml.tipo = source.tipo
  and ml.bloco = source.bloco
  and source.descricao_interna_padrao_i18n is not null
  and (
    ml.descricao_interna_padrao_i18n is null
    or ml.descricao_interna_padrao_i18n = '{}'::jsonb
  );
