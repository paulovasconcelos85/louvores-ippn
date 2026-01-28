import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// ============================================
// GET - Buscar pessoa por ID
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Corrigido: Agora é Promise
) {
  try {
    const { id } = await params; // Corrigido: Adicionado await

    const { data: pessoa, error } = await supabaseAdmin
      .from('pessoas')
      .select(`
        *,
        usuarios_tags(
          tag_id,
          nivel_habilidade,
          tags_funcoes(id, nome, categoria, cor, icone)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!pessoa) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada' },
        { status: 404 }
      );
    }

    // Formatar tags
    const pessoaFormatada = {
      ...pessoa,
      tags: pessoa.usuarios_tags
        ?.map((ut: any) => ut.tags_funcoes)
        .filter(Boolean) || []
    };

    return NextResponse.json({
      success: true,
      data: pessoaFormatada
    });

  } catch (error: any) {
    console.error('Erro ao buscar pessoa:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar pessoa' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Atualizar pessoa
// ============================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Corrigido: Agora é Promise
) {
  try {
    const { id } = await params; // Corrigido: Adicionado await
    const body = await request.json();
    
    const { nome, cargo, email, telefone, ativo, observacoes } = body;

    // Verificar se pessoa existe
    const { data: pessoaExistente } = await supabaseAdmin
    .from('pessoas')
    .select('id, nome, tem_acesso, email')
    .eq('id', id)
    .single();

    if (!pessoaExistente) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada' },
        { status: 404 }
      );
    }

    // Não permitir editar email se já tem acesso
    if (pessoaExistente.tem_acesso && email && email !== pessoaExistente.email) {
      return NextResponse.json(
        { error: 'Não é possível alterar email de pessoa com acesso ao sistema' },
        { status: 400 }
      );
    }

    // Preparar dados para atualização
    const dadosAtualizacao: any = {
      atualizado_em: new Date().toISOString()
    };

    if (nome !== undefined) dadosAtualizacao.nome = nome.trim();
    if (cargo !== undefined) dadosAtualizacao.cargo = cargo;
    if (email !== undefined) dadosAtualizacao.email = email ? email.toLowerCase().trim() : null;
    if (telefone !== undefined) dadosAtualizacao.telefone = telefone || null;
    if (ativo !== undefined) dadosAtualizacao.ativo = ativo;
    if (observacoes !== undefined) dadosAtualizacao.observacoes = observacoes || null;

    // Atualizar
    const { data: pessoa, error } = await supabaseAdmin
      .from('pessoas')
      .update(dadosAtualizacao)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Pessoa atualizada com sucesso',
      data: pessoa
    });

  } catch (error: any) {
    console.error('Erro ao atualizar pessoa:', error);
    
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe outra pessoa com este email' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar pessoa' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Deletar pessoa
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Corrigido: Agora é Promise
) {
  try {
    const { id } = await params; // Corrigido: Adicionado await

    // Verificar se pessoa existe
    const { data: pessoa } = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, tem_acesso')
      .eq('id', id)
      .single();

    if (!pessoa) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada' },
        { status: 404 }
      );
    }

    // Não permitir deletar se tem acesso (precisa desativar primeiro)
    if (pessoa.tem_acesso) {
      return NextResponse.json(
        { error: 'Não é possível deletar pessoa com acesso ao sistema. Desative-a primeiro.' },
        { status: 400 }
      );
    }

    // Verificar se está em escalas
    const { count: countEscalas } = await supabaseAdmin
      .from('escalas_funcoes')
      .select('id', { count: 'exact', head: true })
      .eq('pessoa_id', id);

    if (countEscalas && countEscalas > 0) {
      return NextResponse.json(
        { 
          error: `${pessoa.nome} está em ${countEscalas} escala(s). Remova das escalas primeiro ou desative a pessoa.`,
          count_escalas: countEscalas
        },
        { status: 400 }
      );
    }

    // Deletar
    const { error } = await supabaseAdmin
      .from('pessoas')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${pessoa.nome} removido com sucesso`
    });

  } catch (error: any) {
    console.error('Erro ao deletar pessoa:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar pessoa' },
      { status: 500 }
    );
  }
}