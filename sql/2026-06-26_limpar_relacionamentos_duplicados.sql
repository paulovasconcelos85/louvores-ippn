-- Remove relacionamentos duplicados: mesmo (pessoa_id, pessoa_relacionada_id) com tipos diferentes.
-- Usa ctid (identificador físico do PostgreSQL) para desempatar — não depende do tipo do id.

-- PASSO 1: Conferir o que existe duplicado (rode isso primeiro)
SELECT pessoa_id, pessoa_relacionada_id, COUNT(*), array_agg(tipo) AS tipos
FROM relacionamentos
GROUP BY pessoa_id, pessoa_relacionada_id
HAVING COUNT(*) > 1;

-- PASSO 2: Deletar duplicatas, mantendo a linha com maior ctid (última inserida fisicamente)
DELETE FROM relacionamentos a
USING relacionamentos b
WHERE a.pessoa_id = b.pessoa_id
  AND a.pessoa_relacionada_id = b.pessoa_relacionada_id
  AND a.ctid < b.ctid;

-- PASSO 3: Adicionar constraint única para evitar que volte a acontecer
ALTER TABLE relacionamentos
  ADD CONSTRAINT IF NOT EXISTS relacionamentos_par_unico
  UNIQUE (pessoa_id, pessoa_relacionada_id);
