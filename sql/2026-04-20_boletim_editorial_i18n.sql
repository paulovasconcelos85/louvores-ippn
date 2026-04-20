alter table public."Louvores IPPN"
  add column if not exists palavra_pastoral_i18n jsonb;

update public."Louvores IPPN"
set palavra_pastoral_i18n = jsonb_build_object('pt', palavra_pastoral)
where coalesce(palavra_pastoral, '') <> ''
  and (
    palavra_pastoral_i18n is null
    or palavra_pastoral_i18n = '{}'::jsonb
  );
