-- ============================================================================
-- Token por pessoa para o link público de "Completar cadastro".
--
-- Cada pessoa recebe um token aleatório e não-adivinhável usado na URL
-- /completar/<token>. Diferente do telefone (que é adivinhável), o token
-- autoriza o próprio membro a conferir e completar apenas o seu cadastro
-- (e o dos filhos vinculados).
-- ============================================================================

-- gen_random_uuid() vem da extensão pgcrypto (já disponível no Supabase).
create extension if not exists pgcrypto;

alter table pessoas
  add column if not exists cadastro_token uuid not null default gen_random_uuid();

-- Garante unicidade do token para lookup direto.
create unique index if not exists pessoas_cadastro_token_key
  on pessoas (cadastro_token);
