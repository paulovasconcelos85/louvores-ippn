alter table public.louvor_itens
  add column if not exists conteudo_publico_i18n jsonb;

update public.louvor_itens
set conteudo_publico_i18n = jsonb_build_object('pt', conteudo_publico)
where coalesce(conteudo_publico, '') <> ''
  and (
    conteudo_publico_i18n is null
    or conteudo_publico_i18n = '{}'::jsonb
  );

alter table public.boletim_secoes
  add column if not exists titulo_i18n jsonb;

update public.boletim_secoes
set titulo_i18n = jsonb_build_object('pt', titulo)
where coalesce(titulo, '') <> ''
  and (
    titulo_i18n is null
    or titulo_i18n = '{}'::jsonb
  );

alter table public.boletim_itens
  add column if not exists conteudo_i18n jsonb;

update public.boletim_itens
set conteudo_i18n = jsonb_build_object('pt', conteudo)
where coalesce(conteudo, '') <> ''
  and (
    conteudo_i18n is null
    or conteudo_i18n = '{}'::jsonb
  );
