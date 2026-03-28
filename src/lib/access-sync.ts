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

  const { error: acessoError } = await supabaseAdmin
    .from('usuarios_acesso')
    .upsert(
      {
        id: user.id,
        pessoa_id: pessoa.id,
        igreja_id: pessoa.igreja_id,
        email,
        nome: pessoa.nome,
        cargo: pessoa.cargo,
        telefone: pessoa.telefone,
        ativo,
        atualizado_em,
      },
      { onConflict: 'id' }
    );

  if (acessoError) throw acessoError;

  if (pessoa.igreja_id) {
    const { error: igrejaError } = await supabaseAdmin
      .from('usuarios_igrejas')
      .upsert(
        {
          usuario_id: user.id,
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
