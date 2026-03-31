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
      .select('id, nome, cargo, email, telefone, ativo, usuario_id, igreja_id, tem_acesso')
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

    const atualizado_em = new Date().toISOString();
    const ativo = vinculo?.ativo ?? pessoa.ativo ?? true;
    const cargo = vinculo?.cargo ?? pessoa.cargo;
    const igrejaVinculoId = vinculo?.igreja_id ?? igrejaId ?? pessoa.igreja_id;

    const { error: updatePessoaError } = await supabaseAdmin
      .from('pessoas')
      .update({
        tem_acesso: true,
        ativo,
        cargo,
        igreja_id: igrejaVinculoId,
        atualizado_em,
      })
      .eq('id', id);

    if (updatePessoaError) throw updatePessoaError;

    if (pessoa.usuario_id) {
      let usuarioAcessoId: string | null = null;

      const { data: acessoExistente, error: acessoExistenteError } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id')
        .eq('auth_user_id', pessoa.usuario_id)
        .maybeSingle();

      if (acessoExistenteError) throw acessoExistenteError;

      if (acessoExistente) {
        const { data: acessoAtualizado, error: acessoUpdateError } = await supabaseAdmin
          .from('usuarios_acesso')
          .update({
            pessoa_id: pessoa.id,
            igreja_id: igrejaVinculoId,
            auth_user_id: pessoa.usuario_id,
            email: pessoa.email,
            nome: pessoa.nome,
            cargo,
            telefone: pessoa.telefone,
            ativo,
            atualizado_em,
          })
          .eq('id', acessoExistente.id)
          .select('id')
          .single();

        if (acessoUpdateError) throw acessoUpdateError;
        usuarioAcessoId = acessoAtualizado.id;
      } else {
        const { data: acessoCriado, error: acessoInsertError } = await supabaseAdmin
          .from('usuarios_acesso')
          .insert({
            pessoa_id: pessoa.id,
            igreja_id: igrejaVinculoId,
            auth_user_id: pessoa.usuario_id,
            email: pessoa.email,
            nome: pessoa.nome,
            cargo,
            telefone: pessoa.telefone,
            ativo,
            atualizado_em,
          })
          .select('id')
          .single();

        if (acessoInsertError) throw acessoInsertError;
        usuarioAcessoId = acessoCriado.id;
      }

      if (usuarioAcessoId && igrejaVinculoId) {
        const { error: igrejaError } = await supabaseAdmin
          .from('usuarios_igrejas')
          .upsert(
            {
              usuario_id: usuarioAcessoId,
              igreja_id: igrejaVinculoId,
              cargo,
              ativo,
            },
            { onConflict: 'usuario_id,igreja_id' }
          );

        if (igrejaError) throw igrejaError;
      }
    }

    return NextResponse.json({
      success: true,
      message: pessoa.usuario_id
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
