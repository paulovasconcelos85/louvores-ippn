-- Adiciona campo is_teste para marcar cadastros criados para teste.
-- Membros marcados como teste não contabilizam nos totais.
ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pessoas.is_teste IS 'Cadastro de teste — não contabiliza em totais e relatórios.';
