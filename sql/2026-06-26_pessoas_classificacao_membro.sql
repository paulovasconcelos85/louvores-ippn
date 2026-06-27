-- Adiciona classificação eclesiástica do membro conforme terminologia presbiteriana.
-- A congregação IPPN está sob a IPManaus (ainda não é igreja organizada),
-- então os membros formais têm vínculo lá; os que frequentam sem transferência são aderentes.
ALTER TABLE pessoas
  ADD COLUMN IF NOT EXISTS classificacao_membro varchar(30)
  CHECK (classificacao_membro IN (
    'comungante',
    'nao_comungante',
    'aderente_comungante',
    'aderente_nao_comungante'
  ));

COMMENT ON COLUMN pessoas.classificacao_membro IS
  'Classificação eclesiástica presbiteriana: comungante (profissão de fé, rol transferido), '
  'nao_comungante (batizado na infância sem profissão), '
  'aderente_comungante (frequenta mas mantém vínculo em outra igreja), '
  'aderente_nao_comungante (frequenta sem vínculo formal em nenhuma igreja).';
