alter table public.push_dispositivos
  add column if not exists locale text;

update public.push_dispositivos
set locale = null
where locale is not null
  and locale not in ('pt', 'es', 'en');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_dispositivos_locale_ck'
  ) then
    alter table public.push_dispositivos
      add constraint push_dispositivos_locale_ck
      check (locale is null or locale in ('pt', 'es', 'en'));
  end if;
end $$;
