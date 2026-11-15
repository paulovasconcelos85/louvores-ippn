-- Limpa completamente um usuário de teste (auth + tabelas da aplicação)
-- para permitir retestar o cadastro do zero.
-- Troque o e-mail abaixo conforme necessário e rode no SQL Editor do Supabase.

DO $$
DECLARE
  v_email text := 'oikoshub.reviewer@test.com';  -- <<< ajuste aqui
  v_auth_id uuid;
  r record;
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = lower(v_email);

  -- Remove vínculos e acessos de TODAS as pessoas com esse e-mail
  FOR r IN
    SELECT id FROM public.pessoas WHERE lower(trim(email)) = lower(v_email)
  LOOP
    DELETE FROM public.usuarios_igrejas
      WHERE usuario_id IN (SELECT id FROM public.usuarios_acesso WHERE pessoa_id = r.id);
    DELETE FROM public.usuarios_acesso WHERE pessoa_id = r.id;
    DELETE FROM public.pessoas_igrejas WHERE pessoa_id = r.id;
    DELETE FROM public.pessoas WHERE id = r.id;
  END LOOP;

  -- Remove acessos órfãos ligados só pelo e-mail
  DELETE FROM public.usuarios_igrejas
    WHERE usuario_id IN (
      SELECT id FROM public.usuarios_acesso WHERE lower(trim(email)) = lower(v_email)
    );
  DELETE FROM public.usuarios_acesso WHERE lower(trim(email)) = lower(v_email);

  -- Remove o usuário do Auth
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  RAISE NOTICE 'Usuário % limpo (auth_id era %).', v_email, v_auth_id;
END;
$$;
