alter table public.igrejas
  add column if not exists apresentacao_titulo text,
  add column if not exists apresentacao_texto text,
  add column if not exists apresentacao_imagem_url text,
  add column if not exists apresentacao_youtube_url text,
  add column if not exists apresentacao_galeria jsonb;
