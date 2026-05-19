-- Apple App Store review user provisioning
-- Data: 2026-05-18
--
-- DIAGNÓSTICO:
--   verificar_email_permitido() → delega para email_permitido(email)
--   email_permitido() → verifica se o email existe em pessoas OU usuarios_acesso com ativo = true
--
-- CONCLUSÃO: não há whitelist de domínio. O trigger bloqueia porque o email
-- ainda não existe em nenhuma das duas tabelas (problema de ovo e galinha).
--
-- SOLUÇÃO: pré-inserir a pessoa ANTES de criar o usuário auth.
-- O trigger encontra o email em pessoas, aprova, e o signup funciona.
--
-- Fluxo (execute cada bloco em ordem no SQL Editor do Supabase):
--   PASSO 1 → Pré-inserir pessoa com o email do reviewer (libera o trigger)
--   PASSO 2 → Criar o usuário no Supabase Auth via SQL
--   PASSO 3 → Finalizar o provisionamento (usuarios_acesso + usuarios_igrejas)
--   PASSO 4 → Auditoria
--   PASSO 5 → Limpeza pós-review

-- ============================================================
-- PASSO 1. PRÉ-INSERIR A PESSOA (libera o trigger)
-- Isso faz email_permitido() retornar TRUE para o novo email,
-- permitindo que o INSERT em auth.users passe sem erro.
-- ============================================================

DO $$
DECLARE
  v_church_id uuid;
  v_pessoa_id uuid;
BEGIN
  SELECT id INTO v_church_id
  FROM igrejas
  WHERE slug = 'ippn-manaus'
  LIMIT 1;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'Igreja com slug ippn-manaus não encontrada.';
  END IF;

  INSERT INTO pessoas (
    id,
    nome,
    cargo,
    email,
    ativo,
    tem_acesso,
    status_membro,
    igreja_id,
    criado_em,
    atualizado_em
  )
  SELECT
    gen_random_uuid(),
    'Apple Reviewer',
    'membro'::cargo_tipo,
    'oikoshub.reviewer@yahoo.com',
    true,
    true,
    'ativo',
    v_church_id,
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM pessoas WHERE lower(trim(email)) = 'oikoshub.reviewer@yahoo.com'
  )
  RETURNING id INTO v_pessoa_id;

  IF v_pessoa_id IS NULL THEN
    SELECT id INTO v_pessoa_id FROM pessoas WHERE lower(trim(email)) = 'oikoshub.reviewer@yahoo.com';
    RAISE NOTICE 'Pessoa já existia: %', v_pessoa_id;
  ELSE
    RAISE NOTICE 'Pessoa criada: %', v_pessoa_id;
  END IF;

  RAISE NOTICE 'Trigger liberado. Prossiga com o PASSO 2.';
END;
$$;


-- ============================================================
-- PASSO 2. CRIAR O USUÁRIO NO SUPABASE AUTH VIA SQL
-- Execute após o PASSO 1. Requer pgcrypto (ativo por padrão).
-- ============================================================

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'oikoshub.reviewer@yahoo.com',
  crypt('OikosReview2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'oikoshub.reviewer@yahoo.com'
);

-- Confirmar e capturar o UUID gerado
SELECT id, email, created_at
FROM auth.users
WHERE email = 'oikoshub.reviewer@yahoo.com';


-- ============================================================
-- PASSO 3. FINALIZAR O PROVISIONAMENTO
-- Vincula auth_user_id à pessoa e cria os registros de acesso.
-- ============================================================

DO $$
DECLARE
  v_auth_user_id uuid;
  v_church_id    uuid;
  v_pessoa_id    uuid;
  v_usuario_id   uuid;
BEGIN
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = 'oikoshub.reviewer@yahoo.com'
  LIMIT 1;

  SELECT id INTO v_church_id
  FROM igrejas
  WHERE slug = 'ippn-manaus'
  LIMIT 1;

  SELECT id INTO v_pessoa_id
  FROM pessoas
  WHERE lower(trim(email)) = 'oikoshub.reviewer@yahoo.com'
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário auth não encontrado. Execute o PASSO 2 primeiro.';
  END IF;

  -- 3.1 Atualizar usuario_id na pessoa (agora que temos o auth_user_id)
  UPDATE pessoas
  SET
    usuario_id   = v_auth_user_id,
    atualizado_em = now()
  WHERE id = v_pessoa_id
    AND usuario_id IS DISTINCT FROM v_auth_user_id;

  -- 3.2 Garantir pessoas_igrejas
  INSERT INTO pessoas_igrejas (
    pessoa_id,
    igreja_id,
    status_membro,
    cargo,
    ativo,
    observacoes,
    criado_em,
    atualizado_em
  )
  VALUES (
    v_pessoa_id,
    v_church_id,
    'ativo',
    'membro'::cargo_tipo,
    true,
    'Conta de revisão Apple App Store - criada em 2026-05-18',
    now(),
    now()
  )
  ON CONFLICT (pessoa_id, igreja_id) DO UPDATE SET
    ativo         = excluded.ativo,
    atualizado_em = now();

  -- 3.3 Criar usuarios_acesso
  INSERT INTO usuarios_acesso (
    pessoa_id,
    igreja_id,
    auth_user_id,
    email,
    nome,
    cargo,
    ativo,
    criado_em,
    atualizado_em
  )
  SELECT
    v_pessoa_id,
    v_church_id,
    v_auth_user_id,
    'oikoshub.reviewer@yahoo.com',
    'Apple Reviewer',
    'membro'::cargo_tipo,
    true,
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM usuarios_acesso WHERE auth_user_id = v_auth_user_id
  )
  RETURNING id INTO v_usuario_id;

  IF v_usuario_id IS NULL THEN
    SELECT id INTO v_usuario_id
    FROM usuarios_acesso
    WHERE auth_user_id = v_auth_user_id
    LIMIT 1;

    UPDATE usuarios_acesso
    SET
      pessoa_id     = v_pessoa_id,
      igreja_id     = v_church_id,
      atualizado_em = now()
    WHERE id = v_usuario_id;
  END IF;

  -- 3.4 Criar usuarios_igrejas
  INSERT INTO usuarios_igrejas (
    usuario_id,
    igreja_id,
    cargo,
    ativo,
    criado_em
  )
  VALUES (
    v_usuario_id,
    v_church_id,
    'membro'::cargo_tipo,
    true,
    now()
  )
  ON CONFLICT (usuario_id, igreja_id) DO UPDATE SET
    cargo = excluded.cargo,
    ativo = excluded.ativo;

  RAISE NOTICE 'Provisionamento concluído.';
  RAISE NOTICE '  auth_user_id = %', v_auth_user_id;
  RAISE NOTICE '  pessoa_id    = %', v_pessoa_id;
  RAISE NOTICE '  usuario_id   = %', v_usuario_id;
  RAISE NOTICE '  church_id    = %', v_church_id;
END;
$$;


-- ============================================================
-- PASSO 4. AUDITORIA FINAL
-- ============================================================

SELECT
  au.email,
  au.created_at                AS auth_criado_em,
  p.id                         AS pessoa_id,
  p.ativo                      AS pessoa_ativa,
  ua.id                        AS usuario_acesso_id,
  ua.cargo,
  ua.ativo                     AS acesso_ativo,
  i.slug                       AS igreja_slug
FROM auth.users au
JOIN pessoas p         ON lower(trim(p.email)) = au.email
JOIN usuarios_acesso ua ON ua.auth_user_id = au.id
JOIN usuarios_igrejas ui ON ui.usuario_id = ua.id
JOIN igrejas i          ON i.id = ui.igreja_id
WHERE au.email = 'oikoshub.reviewer@yahoo.com';


-- ============================================================
-- PASSO 5. LIMPEZA PÓS-REVIEW
-- Execute quando a revisão da Apple for concluída.
-- ============================================================

/*
DO $$
DECLARE
  v_auth_user_id uuid;
  v_usuario_id   uuid;
  v_pessoa_id    uuid;
BEGIN
  SELECT id INTO v_auth_user_id FROM auth.users       WHERE email = 'oikoshub.reviewer@yahoo.com';
  SELECT id INTO v_pessoa_id    FROM pessoas           WHERE lower(trim(email)) = 'oikoshub.reviewer@yahoo.com';
  SELECT id INTO v_usuario_id   FROM usuarios_acesso  WHERE auth_user_id = v_auth_user_id;

  DELETE FROM usuarios_igrejas WHERE usuario_id = v_usuario_id;
  DELETE FROM usuarios_acesso  WHERE id = v_usuario_id;
  DELETE FROM pessoas_igrejas  WHERE pessoa_id = v_pessoa_id;
  DELETE FROM pessoas          WHERE id = v_pessoa_id;
  DELETE FROM auth.users       WHERE id = v_auth_user_id;

  RAISE NOTICE 'Usuário Apple Reviewer removido com sucesso.';
END;
$$;
*/
