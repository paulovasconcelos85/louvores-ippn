import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserPermissionContext, resolveAuthorizedCurrentIgrejaId } from '@/lib/server-church';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type UsuarioAcesso = {
  id: string;
  pessoa_id: string | null;
  auth_user_id: string | null;
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permissionContext = await getUserPermissionContext(
      _request.nextUrl.searchParams.get('igreja_id'),
      _request
    );

    if (!permissionContext?.user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    if (!permissionContext.canManageUsers) {
      return NextResponse.json({ error: 'Sem permissão para liberar acesso.' }, { status: 403 });
    }

    const igrejaId = await resolveAuthorizedCurrentIgrejaId(
      _request.nextUrl.searchParams.get('igreja_id'),
      _request
    );

    const { data: pessoa, error: pessoaError } = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, cargo, email, telefone, ativo, usuario_id')
      .eq('id', id)
      .single();

    if (pessoaError || !pessoa) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada.' },
        { status: 404 }
      );
    }

    if (!pessoa.email) {
      return NextResponse.json(
        { error: 'Adicione um e-mail antes de liberar o acesso.' },
        { status: 400 }
      );
    }

    const { data: vinculo, error: vinculoError } = igrejaId
      ? await supabaseAdmin
          .from('pessoas_igrejas')
          .select('cargo, ativo, igreja_id')
          .eq('pessoa_id', id)
          .eq('igreja_id', igrejaId)
          .maybeSingle()
      : { data: null, error: null };

    if (vinculoError) throw vinculoError;

    const { data: vinculosPessoa, error: vinculosPessoaError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .select('igreja_id, cargo, ativo')
      .eq('pessoa_id', id);

    if (vinculosPessoaError) throw vinculosPessoaError;

    const atualizado_em = new Date().toISOString();
    const ativo = vinculo?.ativo ?? pessoa.ativo ?? true;
    const cargo = vinculo?.cargo ?? pessoa.cargo;
    const igrejaVinculoId =
      vinculo?.igreja_id ??
      igrejaId ??
      vinculosPessoa?.find((item) => item.ativo !== false)?.igreja_id ??
      vinculosPessoa?.[0]?.igreja_id;

    let acessoExistente: UsuarioAcesso | null = null;

    if (pessoa.usuario_id) {
      const { data, error } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, pessoa_id, auth_user_id')
        .eq('auth_user_id', pessoa.usuario_id)
        .maybeSingle<UsuarioAcesso>();

      if (error) throw error;
      acessoExistente = data || null;
    }

    if (!acessoExistente) {
      const { data, error } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, pessoa_id, auth_user_id')
        .eq('pessoa_id', pessoa.id)
        .maybeSingle<UsuarioAcesso>();

      if (error) throw error;
      acessoExistente = data || null;
    }

    if (!acessoExistente) {
      const { data, error } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, pessoa_id, auth_user_id')
        .eq('email', pessoa.email.toLowerCase().trim())
        .limit(1)
        .maybeSingle<UsuarioAcesso>();

      if (error) throw error;
      acessoExistente = data || null;
    }

    if (acessoExistente?.pessoa_id && acessoExistente.pessoa_id !== pessoa.id) {
      return NextResponse.json(
        { error: 'Este e-mail já está vinculado a outra pessoa com acesso.' },
        { status: 409 }
      );
    }

    const authUserId = pessoa.usuario_id || acessoExistente?.auth_user_id || null;

    const { error: updatePessoaError } = await supabaseAdmin
      .from('pessoas')
      .update({
        ativo,
        cargo,
        usuario_id: authUserId,
        atualizado_em,
      })
      .eq('id', id);

    if (updatePessoaError) throw updatePessoaError;

    let usuarioAcessoId: string | null = null;

    const dadosAcesso = {
      pessoa_id: pessoa.id,
      igreja_id: igrejaVinculoId,
      auth_user_id: authUserId,
      email: pessoa.email.toLowerCase().trim(),
      nome: pessoa.nome,
      cargo,
      telefone: pessoa.telefone,
      ativo,
      atualizado_em,
    };

    if (acessoExistente) {
      const { data: acessoAtualizado, error: acessoUpdateError } = await supabaseAdmin
        .from('usuarios_acesso')
        .update(dadosAcesso)
        .eq('id', acessoExistente.id)
        .select('id')
        .single();

      if (acessoUpdateError) throw acessoUpdateError;
      usuarioAcessoId = acessoAtualizado.id;
    } else {
      const { data: acessoCriado, error: acessoInsertError } = await supabaseAdmin
        .from('usuarios_acesso')
        .insert({
          ...dadosAcesso,
          criado_em: atualizado_em,
        })
        .select('id')
        .single();

      if (acessoInsertError) throw acessoInsertError;
      usuarioAcessoId = acessoCriado.id;
    }

    if (usuarioAcessoId && igrejaVinculoId) {
      const vinculosParaSincronizar =
        (vinculosPessoa && vinculosPessoa.length > 0
          ? vinculosPessoa
          : [{ igreja_id: igrejaVinculoId, cargo, ativo }])
          .filter((item) => item.igreja_id);

      for (const vinculoPessoa of vinculosParaSincronizar) {
        const { error: igrejaError } = await supabaseAdmin
          .from('usuarios_igrejas')
          .upsert(
            {
              usuario_id: usuarioAcessoId,
              igreja_id: vinculoPessoa.igreja_id,
              cargo: vinculoPessoa.cargo ?? cargo,
              ativo: vinculoPessoa.ativo ?? ativo,
            },
            { onConflict: 'usuario_id,igreja_id' }
          );

        if (igrejaError) throw igrejaError;
      }
    }

    return NextResponse.json({
      success: true,
      message: authUserId
        ? `${pessoa.nome} agora tem acesso liberado e sincronizado.`
        : `${pessoa.nome} agora tem acesso liberado. A pessoa já pode criar ou usar a conta com este e-mail.`,
    });
  } catch (error: any) {
    console.error('Erro ao liberar acesso:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao liberar acesso.' },
      { status: 500 }
    );
  }
}
