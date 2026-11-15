-- Avisos do boletim passam a aceitar uma imagem (URL) além do texto.
-- Adiciona a coluna imagem_url em boletim_itens.
-- Data: 2026-05-18

ALTER TABLE public.boletim_itens
  ADD COLUMN IF NOT EXISTS imagem_url text;
