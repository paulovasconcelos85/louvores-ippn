-- Adiciona a logo configurável da igreja, exibida antes do nome no boletim geral.
alter table public.igrejas
  add column if not exists logo_url text;

comment on column public.igrejas.logo_url is
  'URL da imagem de logo da igreja, exibida antes do nome no cabeçalho do boletim público.';
