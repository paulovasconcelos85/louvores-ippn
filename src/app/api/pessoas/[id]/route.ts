import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserPermissionContext, resolveAuthorizedCurrentIgrejaId } from '@/lib/server-church';

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

function escolherVinculoPrincipal<T extends { igreja_id: string; ativo?: boolean | null }>(
  vinculos: T[],
  igrejaEspelhoAtual?: string | null
) {
  return (
    vinculos.find((vinculo) => vinculo.igreja_id === igrejaEspelhoAtual) ||
    vinculos.find((vinculo) => vinculo.ativo !== false) ||
    vinculos[0] ||
    null
  );
}

async function pessoaTemAcesso(pessoaId: string, usuarioId?: string | null) {
  const porPessoa = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id')
    .eq('pessoa_id', pessoaId)
    .limit(1)
    .maybeSingle();

  if (porPessoa.error) throw porPessoa.error;
  if (porPessoa.data?.id) return true;

  if (!usuarioId) return false;

  const porAuth = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id')
    .eq('auth_user_id', usuarioId)
    .limit(1)
    .maybeSingle();

  if (porAuth.error) throw porAuth.error;
  return Boolean(porAuth.data?.id);
}

// ============================================
// GET - Buscar pessoa por ID
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Corrigido: Agora é Promise
) {
  try {
    const { id } = await params; // Corrigido: Adicionado await
    const permissionContext = await getUserPermissionContext(
      request.nextUrl.searchParams.get('igreja_id'),
      request
    );

    if (!permissionContext?.user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    if (!permissionContext.canManageUsers && !permissionContext.canPastorMembers) {
      return NextResponse.json({ error: 'Sem permissão para consultar pessoas.' }, { status: 403 });
    }

    const igrejaId = await resolveAuthorizedCurrentIgrejaId(
      request.nextUrl.searchParams.get('igreja_id'),
      request
    );

    if (!igrejaId) {
      return NextResponse.json(
        { error: 'Nenhuma igreja selecionada.' },
        { status: 400 }
      );
    }

    const { data: pessoaComVinculo, error } = await supabaseAdmin
      .from('pessoas')
      .select(`
        *,
        pessoas_igrejas!inner(
          igreja_id,
          cargo,
          status_membro,
          ativo
        ),
        usuarios_tags(
          tag_id,
          nivel_habilidade,
          tags_funcoes(id, nome, categoria, cor, icone)
        )
      `)
      .eq('id', id)
      .eq('pessoas_igrejas.igreja_id', igrejaId)
      .single();

    const pessoa = pessoaComVinculo;

    if (error && error.code !== 'PGRST116') throw error;

    if (!pessoa) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada' },
        { status: 404 }
      );
    }

    const temAcesso = await pessoaTemAcesso(pessoa.id, pessoa.usuario_id);

    // Formatar tags
    const pessoaFormatada = {
      ...pessoa,
      tem_acesso: temAcesso || Boolean(pessoa.usuario_id),
      igreja_id: pessoa.pessoas_igrejas?.[0]?.igreja_id || igrejaId,
      cargo: pessoa.pessoas_igrejas?.[0]?.cargo || pessoa.cargo,
      status_membro: pessoa.pessoas_igrejas?.[0]?.status_membro || pessoa.status_membro,
      ativo: pessoa.pessoas_igrejas?.[0]?.ativo ?? pessoa.ativo,
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
    const permissionContext = await getUserPermissionContext(
      body.igreja_id || request.nextUrl.searchParams.get('igreja_id'),
      request
    );

    if (!permissionContext?.user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    if (!permissionContext.canManageUsers && !permissionContext.canPastorMembers) {
      return NextResponse.json({ error: 'Sem permissão para atualizar pessoas.' }, { status: 403 });
    }

    const igrejaId = await resolveAuthorizedCurrentIgrejaId(
      body.igreja_id || request.nextUrl.searchParams.get('igreja_id'),
      request
    );
    
    const {
      nome,
      cargo,
      email,
      telefone,
      ativo,
      observacoes,
      status_membro,
      ...restoDados
    } = body;
    delete restoDados.tem_acesso;

    const alterandoCamposSensíveis =
      cargo !== undefined || email !== undefined || body.tem_acesso !== undefined;

    if (alterandoCamposSensíveis && !permissionContext.canManageUsers) {
      return NextResponse.json(
        { error: 'Sem permissão para alterar cargo, e-mail ou acesso ao sistema.' },
        { status: 403 }
      );
    }

    if (!igrejaId) {
      return NextResponse.json(
        { error: 'Nenhuma igreja selecionada.' },
        { status: 400 }
      );
    }

    // Verificar se pessoa existe
    const { data: pessoaExistente } = await supabaseAdmin
    .from('pessoas')
    .select('id, nome, email, usuario_id, cargo, status_membro, ativo')
    .eq('id', id)
    .single();

    if (!pessoaExistente) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada' },
        { status: 404 }
      );
    }

    const { data: vinculoExistente, error: vinculoLookupError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .select('id, igreja_id, cargo, status_membro, ativo')
      .eq('pessoa_id', id)
      .eq('igreja_id', igrejaId)
      .maybeSingle();

    if (vinculoLookupError) throw vinculoLookupError;

    const { error: todosVinculosPessoaError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .select('id, igreja_id, cargo, status_membro, ativo')
      .eq('pessoa_id', id);

    if (todosVinculosPessoaError) throw todosVinculosPessoaError;

    const temAcesso = await pessoaTemAcesso(id, pessoaExistente.usuario_id);

    // Não permitir editar email se já tem acesso
    if (temAcesso && email && email !== pessoaExistente.email) {
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
    if (email !== undefined) dadosAtualizacao.email = email ? email.toLowerCase().trim() : null;
    if (telefone !== undefined) dadosAtualizacao.telefone = telefone || null;
    if (observacoes !== undefined) dadosAtualizacao.observacoes = observacoes || null;
    Object.assign(dadosAtualizacao, restoDados);

    // Atualizar pessoas
    const { data: pessoa, error } = await supabaseAdmin
      .from('pessoas')
      .update(dadosAtualizacao)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const dadosVinculo: any = {
      pessoa_id: id,
      igreja_id: igrejaId,
      atualizado_em: new Date().toISOString()
    };

    if (cargo !== undefined) dadosVinculo.cargo = cargo;
    if (status_membro !== undefined) dadosVinculo.status_membro = status_membro;
    if (ativo !== undefined) dadosVinculo.ativo = ativo;
    if (observacoes !== undefined) dadosVinculo.observacoes = observacoes || null;

    if (vinculoExistente) {
      const atualizacaoVinculo: any = {};
      if (cargo !== undefined) atualizacaoVinculo.cargo = cargo;
      if (status_membro !== undefined) atualizacaoVinculo.status_membro = status_membro;
      if (ativo !== undefined) atualizacaoVinculo.ativo = ativo;
      if (observacoes !== undefined) atualizacaoVinculo.observacoes = observacoes || null;

      if (Object.keys(atualizacaoVinculo).length > 0) {
        await supabaseAdmin
          .from('pessoas_igrejas')
          .update(atualizacaoVinculo)
          .eq('id', vinculoExistente.id);
      }
    } else if (cargo !== undefined || status_membro !== undefined || ativo !== undefined) {
      const { error: vinculoInsertError } = await supabaseAdmin
        .from('pessoas_igrejas')
        .insert({
          ...dadosVinculo,
          cargo: cargo || pessoa.cargo,
          status_membro: status_membro || pessoa.status_membro || 'ativo',
          ativo: ativo ?? pessoa.ativo ?? true,
        });

      if (vinculoInsertError) throw vinculoInsertError;
    }

    // Sincronizar cargo/ativo em usuarios_igrejas e usuarios_acesso (se o usuário tem acesso)
    if (pessoaExistente.usuario_id && (cargo !== undefined || ativo !== undefined || nome !== undefined || telefone !== undefined)) {
      const { data: acessoExistente, error: acessoLookupError } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, igreja_id')
        .eq('auth_user_id', pessoaExistente.usuario_id)
        .maybeSingle();

      if (acessoLookupError) throw acessoLookupError;

      const atualizacoesVinculo: any = {};
      if (cargo !== undefined) atualizacoesVinculo.cargo = cargo;
      if (ativo !== undefined) atualizacoesVinculo.ativo = ativo;

      // Atualizar usuarios_igrejas (fonte de verdade para cargo)
      if (acessoExistente?.id && igrejaId && Object.keys(atualizacoesVinculo).length > 0) {
        await supabaseAdmin
          .from('usuarios_igrejas')
          .upsert(
            {
              usuario_id: acessoExistente.id,
              igreja_id: igrejaId,
              cargo: atualizacoesVinculo.cargo ?? vinculoExistente?.cargo ?? pessoa.cargo ?? 'membro',
              ativo: atualizacoesVinculo.ativo ?? vinculoExistente?.ativo ?? pessoa.ativo ?? true,
            },
            { onConflict: 'usuario_id,igreja_id' }
          );
      }

      // Manter usuarios_acesso em sincronia
      const atualizacoesAcesso: any = {};
      if (nome !== undefined) atualizacoesAcesso.nome = nome.trim();
      if (telefone !== undefined) atualizacoesAcesso.telefone = telefone || null;
      if (acessoExistente?.igreja_id === igrejaId) {
        if (cargo !== undefined) atualizacoesAcesso.cargo = cargo;
        if (ativo !== undefined) atualizacoesAcesso.ativo = ativo;
      }

      if (Object.keys(atualizacoesAcesso).length > 0) {
        atualizacoesAcesso.atualizado_em = new Date().toISOString();
        atualizacoesAcesso.auth_user_id = pessoaExistente.usuario_id;

        if (acessoExistente?.id) {
          await supabaseAdmin
            .from('usuarios_acesso')
            .update(atualizacoesAcesso)
            .eq('id', acessoExistente.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pessoa atualizada com sucesso',
      data: {
        ...pessoa,
        tem_acesso: temAcesso || Boolean(pessoa.usuario_id),
        igreja_id: vinculoExistente?.igreja_id || igrejaId,
        cargo: cargo ?? vinculoExistente?.cargo ?? pessoa.cargo,
        status_membro: status_membro ?? vinculoExistente?.status_membro ?? pessoa.status_membro,
        ativo: ativo ?? vinculoExistente?.ativo ?? pessoa.ativo,
      }
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
    const permissionContext = await getUserPermissionContext(
      request.nextUrl.searchParams.get('igreja_id'),
      request
    );

    if (!permissionContext?.user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    if (!permissionContext.canManageUsers) {
      return NextResponse.json({ error: 'Sem permissão para remover pessoas.' }, { status: 403 });
    }

    const igrejaId = await resolveAuthorizedCurrentIgrejaId(
      request.nextUrl.searchParams.get('igreja_id'),
      request
    );

    // Verificar se pessoa existe
    const { data: pessoa } = await supabaseAdmin
      .from('pessoas')
      .select('id, nome, usuario_id')
      .eq('id', id)
      .single();

    if (!pessoa) {
      return NextResponse.json(
        { error: 'Pessoa não encontrada' },
        { status: 404 }
      );
    }

    const { data: vinculos, error: vinculosError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .select('id, igreja_id, cargo, status_membro, ativo')
      .eq('pessoa_id', id);

    if (vinculosError) throw vinculosError;

    const temAcesso = await pessoaTemAcesso(id, pessoa.usuario_id);

    if (igrejaId && (vinculos?.length || 0) > 1) {
      const { error: deleteVinculoError } = await supabaseAdmin
        .from('pessoas_igrejas')
        .delete()
        .eq('pessoa_id', id)
        .eq('igreja_id', igrejaId);

      if (deleteVinculoError) throw deleteVinculoError;

      if (pessoa.usuario_id) {
        const { data: acessoExistente } = await supabaseAdmin
          .from('usuarios_acesso')
          .select('id, igreja_id')
          .eq('auth_user_id', pessoa.usuario_id)
          .maybeSingle();

        if (acessoExistente?.id) {
          await supabaseAdmin
            .from('usuarios_igrejas')
            .delete()
            .eq('usuario_id', acessoExistente.id)
            .eq('igreja_id', igrejaId);

          const proximoVinculo = escolherVinculoPrincipal(
            (vinculos || []).filter((vinculo) => vinculo.igreja_id !== igrejaId),
            igrejaId
          );

          if (acessoExistente.igreja_id === igrejaId && proximoVinculo?.igreja_id) {
            await supabaseAdmin
              .from('usuarios_acesso')
              .update({
                igreja_id: proximoVinculo.igreja_id,
                atualizado_em: new Date().toISOString(),
              })
              .eq('id', acessoExistente.id);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `${pessoa.nome} foi removido da igreja atual, mantendo os demais vínculos.`
      });
    }

    // Não permitir deletar se tem acesso (precisa desativar primeiro)
    if (temAcesso) {
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
