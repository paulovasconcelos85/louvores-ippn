-- ============================================================================
-- Permite renomear o nome exibido para uma família na aba "Famílias" da tela
-- de membros. Hoje o nome é sempre gerado automaticamente a partir do
-- sobrenome do chefe da família (ex.: "Família Rabelo"); este campo, quando
-- preenchido no cadastro do chefe, passa a ter prioridade sobre esse nome
-- automático.
-- ============================================================================

alter table pessoas
  add column if not exists nome_familia_customizado text;
