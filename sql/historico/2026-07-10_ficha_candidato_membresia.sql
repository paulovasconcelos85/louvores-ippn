-- ============================================================================
-- Campos necessários para preencher a "Ficha de Candidato à Membresia" da
-- IPB/IPM a partir do cadastro da pessoa, e para registrar a assinatura
-- digital colhida no tablet (imagem PNG em base64) no momento do
-- recebimento/entrevista.
-- ============================================================================

alter table pessoas
  add column if not exists atividade_atual text,
  add column if not exists pais_origem text,
  add column if not exists uniao_estavel_tempo text,
  add column if not exists igreja_sede_congregacao text, -- 'sede' | 'congregacao_manaus' | 'congregacao_interior'
  add column if not exists congregacao_nome text,
  add column if not exists transferencia_ipb_origem text,
  add column if not exists transferencia_jurisdicao_sem_carta text,
  add column if not exists transferencia_observacao text,
  add column if not exists proposito_entrevista text, -- 'batismo_infantil' | 'profissao_fe' | 'profissao_fe_e_batismo'
  add column if not exists assinatura_ficha text, -- data URL PNG (base64) da assinatura digital
  add column if not exists assinatura_ficha_em timestamptz;
