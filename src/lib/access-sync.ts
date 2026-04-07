import { createClient } from '@supabase/supabase-js';

type AuthLikeUser = {
  id: string;
  email?: string | null;
};

type PessoaAcesso = {
  id: string;
  nome: string;
  cargo: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean | null;
};

type PessoaIgrejaVinculo = {
  igreja_id: string;
  cargo: string | null;
  ativo: boolean | null;
  status_membro?: string | null;
};

type UsuarioAcesso = {
  id: string;
  igreja_id: string | null;
  pessoa_id?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
  nome?: string | null;
  cargo?: string | null;
  ativo?: boolean | null;
  telefone?: string | null;
};

export type SyncAccessResult =
  | { status: 'granted'; message: string; pessoaId: string }
  | { status: 'pending_approval'; message: string }
  | { status: 'not_found'; message: string }
  | { status: 'conflict'; message: string };

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function normalizeEmail(email?: string | null) {
  return email?.toLowerCase().trim() || null;
}

async function getPessoaChurchLinks(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  pessoaId: string,
  fallback?: {
    igreja_id?: string | null;
    cargo?: string | null;
    ativo?: boolean | null;
  }
) {
  const { data, error } = await supabaseAdmin
    .from('pessoas_igrejas')
    .select('igreja_id, cargo, ativo, status_membro')
    .eq('pessoa_id', pessoaId)
    .order('ativo', { ascending: false })
    .order('atualizado_em', { ascending: false });

  if (error) throw error;

  const vinculos = (data || []) as PessoaIgrejaVinculo[];

  if (vinculos.length > 0) {
    return vinculos;
  }

  if (fallback?.igreja_id) {
    return [
      {
        igreja_id: fallback.igreja_id,
        cargo: fallback.cargo || 'membro',
        ativo: fallback.ativo ?? true,
      },
    ];
  }

  return [];
}

function getPrimaryPessoaChurch(
  vinculos: PessoaIgrejaVinculo[],
  fallback?: { igreja_id?: string | null }
) {
  return (
    vinculos.find((v) => v.igreja_id === fallback?.igreja_id) ||
    vinculos.find((v) => v.ativo !== false) ||
    vinculos[0] ||
    null
  );
}

async function findExistingUsuarioAcesso(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
  pessoaId: string,
  email: string
) {
  const byAuth = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('auth_user_id', authUserId)
    .maybeSingle<UsuarioAcesso>();

  if (byAuth.error) throw byAuth.error;
  if (byAuth.data) return byAuth.data;

  const byPessoa = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('pessoa_id', pessoaId)
    .limit(1)
    .maybeSingle<UsuarioAcesso>();

  if (byPessoa.error) throw byPessoa.error;
  if (byPessoa.data) return byPessoa.data;

  const byEmail = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('email', email)
    .limit(1)
    .maybeSingle<UsuarioAcesso>();

  if (byEmail.error) throw byEmail.error;
  return byEmail.data || null;
}

async function findPessoaFromLegacyUsuarioAcesso(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
  email: string
): Promise<PessoaAcesso | null> {
  const byAuth = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('auth_user_id', authUserId)
    .maybeSingle<UsuarioAcesso>();

  if (byAuth.error) throw byAuth.error;
  let legacyUser = byAuth.data;

  if (!legacyUser) {
    const byEmail = await supabaseAdmin
      .from('usuarios_acesso')
      .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
      .eq('email', email)
      .limit(1)
      .maybeSingle<UsuarioAcesso>();

    if (byEmail.error) throw byEmail.error;
    legacyUser = byEmail.data;
  }

  if (!legacyUser) return null;

  // Se já tem pessoa_id, busca a pessoa
  if (legacyUser.pessoa_id) {
    const pessoaResult = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, cargo, email, telefone, ativo')
      .eq('id', legacyUser.pessoa_id)
      .maybeSingle<PessoaAcesso>();

    if (pessoaResult.error) throw pessoaResult.error;
    if (pessoaResult.data) return pessoaResult.data;
  }

  // Cria pessoa a partir do legacyUser
  const { data: pessoaCriada, error: pessoaCreateError } = await supabaseAdmin
    .from('pessoas')
    .insert({
      nome: legacyUser.nome || email.split('@')[0],
      cargo: (legacyUser.cargo as any) || 'membro',
      email,
      telefone: legacyUser.telefone || null,
      ativo: legacyUser.ativo ?? true,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .select('id, nome, cargo, email, telefone, ativo')
    .single<PessoaAcesso>();

  if (pessoaCreateError) throw pessoaCreateError;

  // Vincula a pessoa à igreja via pessoas_igrejas
  if (legacyUser.igreja_id) {
    const { error: vinculoError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .upsert(
        {
          pessoa_id: pessoaCriada.id,
          igreja_id: legacyUser.igreja_id,
          status_membro: 'ativo',
          cargo: (legacyUser.cargo as any) || 'membro',
          ativo: legacyUser.ativo ?? true,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'pessoa_id,igreja_id' }
      );

    if (vinculoError) throw vinculoError;
  }

  // Atualiza o legacyUser com o pessoa_id e auth_user_id
  await supabaseAdmin
    .from('usuarios_acesso')
    .update({
      pessoa_id: pessoaCriada.id,
      auth_user_id: authUserId,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', legacyUser.id);

  return pessoaCriada;
}

async function ensureUsuarioAcesso(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  pessoa: PessoaAcesso,
  authUserId: string,
  email: string,
  ativo: boolean,
  atualizado_em: string
) {
  const vinculos = await getPessoaChurchLinks(supabaseAdmin, pessoa.id);
  const principal = getPrimaryPessoaChurch(vinculos);

  const payload = {
    pessoa_id: pessoa.id,
    igreja_id: principal?.igreja_id || null,
    auth_user_id: authUserId,
    email,
    nome: pessoa.nome,
    cargo: principal?.cargo || pessoa.cargo,
    telefone: pessoa.telefone,
    ativo: principal?.ativo ?? ativo,
    atualizado_em,
  };

  const existente = await findExistingUsuarioAcesso(
    supabaseAdmin,
    authUserId,
    pessoa.id,
    email
  );

  if (existente) {
    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from('usuarios_acesso')
      .update(payload)
      .eq('id', existente.id)
      .select('id, igreja_id')
      .single<UsuarioAcesso>();

    if (updateError) throw updateError;
    return atualizado;
  }

  const { data: criado, error: insertError } = await supabaseAdmin
    .from('usuarios_acesso')
    .insert(payload)
    .select('id, igreja_id')
    .single<UsuarioAcesso>();

  if (insertError) throw insertError;
  return criado;
}

export async function syncApprovedUserAccess(user: AuthLikeUser): Promise<SyncAccessResult> {
  const email = normalizeEmail(user.email);

  if (!email) {
    return {
      status: 'not_found',
      message: 'Sua conta não possui um e-mail válido para ser vinculada.',
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // 1. Verifica se existe registro em usuarios_acesso com acesso liberado
  const { data: acessoExistente, error: acessoError } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, ativo, auth_user_id, pessoa_id')
    .eq('email', email)
    .limit(1)
    .maybeSingle<UsuarioAcesso>();

  if (acessoError) throw acessoError;

  if (!acessoExistente) {
    return {
      status: 'not_found',
      message: 'Nenhum cadastro de acesso foi encontrado para este e-mail.',
    };
  }

  if (!acessoExistente.ativo) {
    return {
      status: 'pending_approval',
      message: 'Seu acesso ainda não foi liberado pela administração.',
    };
  }

  // 2. Busca a pessoa vinculada
  let pessoa: PessoaAcesso | null = null;

  if (acessoExistente.pessoa_id) {
    const { data, error } = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, cargo, email, telefone, ativo')
      .eq('id', acessoExistente.pessoa_id)
      .maybeSingle<PessoaAcesso>();

    if (error) throw error;
    pessoa = data;
  }

  if (!pessoa) {
    const { data, error } = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, cargo, email, telefone, ativo')
      .eq('email', email)
      .maybeSingle<PessoaAcesso>();

    if (error) throw error;
    pessoa = data;
  }

  if (!pessoa) {
    pessoa = await findPessoaFromLegacyUsuarioAcesso(supabaseAdmin, user.id, email);
  }

  if (!pessoa) {
    return {
      status: 'not_found',
      message: 'Nenhum cadastro de pessoa foi encontrado para este e-mail.',
    };
  }

  const ativo = pessoa.ativo ?? true;
  const atualizado_em = new Date().toISOString();

  // 3. Atualiza dados básicos da pessoa (sem colunas que não existem)
  const { error: pessoaUpdateError } = await supabaseAdmin
    .from('pessoas')
    .update({
      email,
      ativo,
      atualizado_em,
    })
    .eq('id', pessoa.id);

  if (pessoaUpdateError) throw pessoaUpdateError;

  // 4. Garante/atualiza o registro em usuarios_acesso com auth_user_id
  const usuarioAcesso = await ensureUsuarioAcesso(
    supabaseAdmin,
    pessoa,
    user.id,
    email,
    ativo,
    atualizado_em
  );

  // 5. Sincroniza usuarios_igrejas a partir de pessoas_igrejas
  const vinculosPessoa = await getPessoaChurchLinks(supabaseAdmin, pessoa.id);

  for (const vinculo of vinculosPessoa) {
    const { error: igrejaError } = await supabaseAdmin
      .from('usuarios_igrejas')
      .upsert(
        {
          usuario_id: usuarioAcesso.id,
          igreja_id: vinculo.igreja_id,
          cargo: vinculo.cargo || pessoa.cargo,
          ativo: vinculo.ativo ?? ativo,
        },
        { onConflict: 'usuario_id,igreja_id' }
      );

    if (igrejaError) throw igrejaError;
  }

  return {
    status: 'granted',
    message: 'Acesso sincronizado com sucesso.',
    pessoaId: pessoa.id,
  };
}
