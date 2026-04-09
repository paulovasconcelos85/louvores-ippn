'use client';

import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

interface ResolvePessoaIdOptions {
  allowLegacyTemAcesso?: boolean;
}

export async function resolvePessoaIdForCurrentUser(
  user: User | null | undefined,
  options: ResolvePessoaIdOptions = {}
) {
  if (!user?.id) {
    return null;
  }

  const allowLegacyTemAcesso = options.allowLegacyTemAcesso ?? true;
  const normalizedEmail = normalizeEmail(user.email);

  const byAuth = await supabase
    .from('usuarios_acesso')
    .select('pessoa_id')
    .eq('auth_user_id', user.id)
    .not('pessoa_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (byAuth.error && byAuth.error.code !== 'PGRST116') {
    throw byAuth.error;
  }

  if (byAuth.data?.pessoa_id) {
    return byAuth.data.pessoa_id as string;
  }

  if (normalizedEmail) {
    const byEmail = await supabase
      .from('usuarios_acesso')
      .select('pessoa_id')
      .eq('email', normalizedEmail)
      .not('pessoa_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (byEmail.error && byEmail.error.code !== 'PGRST116') {
      throw byEmail.error;
    }

    if (byEmail.data?.pessoa_id) {
      return byEmail.data.pessoa_id as string;
    }
  }

  if (!allowLegacyTemAcesso) {
    return null;
  }

  const legacyByAuth = await supabase
    .from('pessoas')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();

  if (legacyByAuth.error && legacyByAuth.error.code !== 'PGRST116') {
    throw legacyByAuth.error;
  }

  if (legacyByAuth.data?.id) {
    return legacyByAuth.data.id as string;
  }

  if (normalizedEmail) {
    const legacyByEmail = await supabase
      .from('pessoas')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (legacyByEmail.error && legacyByEmail.error.code !== 'PGRST116') {
      throw legacyByEmail.error;
    }

    if (legacyByEmail.data?.id) {
      return legacyByEmail.data.id as string;
    }
  }

  return null;
}
