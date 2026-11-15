alter table public.igrejas
  add column if not exists apresentacao_titulo_i18n jsonb,
  add column if not exists apresentacao_texto_i18n jsonb;

update public.igrejas
set apresentacao_titulo_i18n = jsonb_build_object('pt', apresentacao_titulo)
where coalesce(apresentacao_titulo, '') <> ''
  and (
    apresentacao_titulo_i18n is null
    or apresentacao_titulo_i18n = '{}'::jsonb
  );

update public.igrejas
set apresentacao_texto_i18n = jsonb_build_object('pt', apresentacao_texto)
where coalesce(apresentacao_texto, '') <> ''
  and (
    apresentacao_texto_i18n is null
    or apresentacao_texto_i18n = '{}'::jsonb
  );
