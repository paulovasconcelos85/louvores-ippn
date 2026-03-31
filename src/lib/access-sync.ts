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
  tem_acesso: boolean | null;
  igreja_id: string | null;
  usuario_id: string | null;
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

async function findExistingUsuarioAcesso(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
  pessoaId: string,
  email: string
) {
  const lookupByAuth = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('auth_user_id', authUserId)
    .maybeSingle<UsuarioAcesso>();

  if (lookupByAuth.error) throw lookupByAuth.error;
  if (lookupByAuth.data) return lookupByAuth.data;

  const lookupByPessoa = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('pessoa_id', pessoaId)
    .limit(1)
    .maybeSingle<UsuarioAcesso>();

  if (lookupByPessoa.error) throw lookupByPessoa.error;
  if (lookupByPessoa.data) return lookupByPessoa.data;

  const lookupByEmail = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id, pessoa_id, email, auth_user_id, nome, cargo, ativo, telefone')
    .eq('email', email)
    .limit(1)
    .maybeSingle<UsuarioAcesso>();

  if (lookupByEmail.error) throw lookupByEmail.error;
  return lookupByEmail.data || null;
}

async function findPessoaFromLegacyUsuarioAcesso(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
  email: string
) {
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

  if (legacyUser.pessoa_id) {
    const pessoaResult = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, cargo, email, telefone, ativo, tem_acesso, igreja_id, usuario_id')
      .eq('id', legacyUser.pessoa_id)
      .maybeSingle<PessoaAcesso>();

    if (pessoaResult.error) throw pessoaResult.error;
    if (pessoaResult.data) return pessoaResult.data;
  }

  const { data: pessoaCriada, error: pessoaCreateError } = await supabaseAdmin
    .from('pessoas')
    .insert({
      nome: legacyUser.nome || email.split('@')[0],
      cargo: (legacyUser.cargo as any) || 'membro',
      email,
      telefone: legacyUser.telefone || null,
      ativo: legacyUser.ativo ?? true,
      tem_acesso: legacyUser.ativo ?? true,
      igreja_id: legacyUser.igreja_id,
      usuario_id: authUserId,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .select('id, nome, cargo, email, telefone, ativo, tem_acesso, igreja_id, usuario_id')
    .single<PessoaAcesso>();

  if (pessoaCreateError) throw pessoaCreateError;

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
  const payload = {
    pessoa_id: pessoa.id,
    igreja_id: pessoa.igreja_id,
    auth_user_id: authUserId,
    email,
    nome: pessoa.nome,
    cargo: pessoa.cargo,
    telefone: pessoa.telefone,
    ativo,
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

  let pessoa: PessoaAcesso | null = null;

  const { data: pessoaPorUsuario, error: pessoaPorUsuarioError } = await supabaseAdmin
    .from('pessoas')
    .select('id, nome, cargo, email, telefone, ativo, tem_acesso, igreja_id, usuario_id')
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (pessoaPorUsuarioError) throw pessoaPorUsuarioError;

  pessoa = pessoaPorUsuario;

  if (!pessoa) {
    const { data: pessoaPorEmail, error: pessoaPorEmailError } = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, cargo, email, telefone, ativo, tem_acesso, igreja_id, usuario_id')
      .eq('email', email)
      .maybeSingle();

    if (pessoaPorEmailError) throw pessoaPorEmailError;
    pessoa = pessoaPorEmail;
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

  if (pessoa.usuario_id && pessoa.usuario_id !== user.id) {
    return {
      status: 'conflict',
      message: 'Este cadastro já está vinculado a outra conta de autenticação.',
    };
  }

  if (!pessoa.tem_acesso) {
    return {
      status: 'pending_approval',
      message: 'Seu acesso ainda não foi liberado pela administração.',
    };
  }

  const ativo = pessoa.ativo ?? true;
  const atualizado_em = new Date().toISOString();

  const { error: pessoaUpdateError } = await supabaseAdmin
    .from('pessoas')
    .update({
      usuario_id: user.id,
      email,
      ativo,
      atualizado_em,
    })
    .eq('id', pessoa.id);

  if (pessoaUpdateError) throw pessoaUpdateError;

  const usuarioAcesso = await ensureUsuarioAcesso(
    supabaseAdmin,
    pessoa,
    user.id,
    email,
    ativo,
    atualizado_em
  );

  if (pessoa.igreja_id) {
    const { error: igrejaError } = await supabaseAdmin
      .from('usuarios_igrejas')
      .upsert(
        {
          usuario_id: usuarioAcesso.id,
          igreja_id: pessoa.igreja_id,
          cargo: pessoa.cargo,
          ativo,
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
