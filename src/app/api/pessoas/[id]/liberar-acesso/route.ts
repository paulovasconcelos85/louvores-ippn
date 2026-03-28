import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const atualizado_em = new Date().toISOString();
    const ativo = pessoa.ativo ?? true;

    const { error: updatePessoaError } = await supabaseAdmin
      .from('pessoas')
      .update({
        tem_acesso: true,
        ativo,
        atualizado_em,
      })
      .eq('id', id);

    if (updatePessoaError) throw updatePessoaError;

    if (pessoa.usuario_id) {
      const { error: acessoError } = await supabaseAdmin
        .from('usuarios_acesso')
        .upsert(
          {
            id: pessoa.usuario_id,
            pessoa_id: pessoa.id,
            igreja_id: pessoa.igreja_id,
            email: pessoa.email,
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
              usuario_id: pessoa.usuario_id,
              igreja_id: pessoa.igreja_id,
              cargo: pessoa.cargo,
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
