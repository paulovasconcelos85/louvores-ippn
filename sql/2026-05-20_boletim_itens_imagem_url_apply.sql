-- Garante que a coluna imagem_url existe em boletim_itens.
-- Idempotente: seguro rodar mesmo que a migration anterior já tenha sido aplicada.
-- EXECUTE ESTE ARQUIVO no Supabase SQL Editor se o link dos avisos não estiver salvando.

ALTER TABLE public.boletim_itens
  ADD COLUMN IF NOT EXISTS imagem_url text;

-- Atualiza o cache de schema do PostgREST para reconhecer a nova coluna imediatamente.
NOTIFY pgrst, 'reload schema';
