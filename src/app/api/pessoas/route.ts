import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserPermissionContext, resolveAuthorizedCurrentIgrejaId } from '@/lib/server-church';

// Cliente Supabase Admin
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
// GET - Listar pessoas
// ============================================
export async function GET(request: NextRequest) {
  try {
    const permissionContext = await getUserPermissionContext(
      new URL(request.url).searchParams.get('igreja_id'),
      request
    );

    if (!permissionContext?.user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    if (!permissionContext.canManageUsers && !permissionContext.canPastorMembers) {
      return NextResponse.json({ error: 'Sem permissão para listar pessoas.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Filtros opcionais
    const ativo = searchParams.get('ativo'); // true/false
    const tem_acesso = searchParams.get('tem_acesso'); // true/false
    const cargo = searchParams.get('cargo'); // musico, pastor, etc
    const busca = searchParams.get('busca'); // busca por nome/email
    const igrejaParam = searchParams.get('igreja_id');
    const igrejaId = await resolveAuthorizedCurrentIgrejaId(igrejaParam, request);

    if (!igrejaId) {
      return NextResponse.json(
        { error: 'Nenhuma igreja selecionada.' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('pessoas')
      .select(`
        id, nome, cargo, email, telefone, ativo, tem_acesso, usuario_id, foto_url, observacoes,
        criado_em, atualizado_em, data_nascimento, data_casamento, data_batismo, situacao_saude,
        endereco_completo, status_membro, sexo, estado_civil, conjuge_nome, conjuge_religiao,
        nome_pai, nome_mae, naturalidade_cidade, naturalidade_uf, nacionalidade, escolaridade,
        profissao, logradouro, bairro, cep, cidade, uf, latitude, longitude, google_place_id,
        batizado, data_profissao_fe, transferido_ipb, transferido_outra_denominacao,
        cursos_discipulado, grupo_familiar_nome, grupo_familiar_lider, igreja_id,
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
      .eq('pessoas_igrejas.igreja_id', igrejaId)
      .order('nome');

    // Aplicar filtros
    if (ativo !== null) {
      query = query.eq('pessoas_igrejas.ativo', ativo === 'true');
    }
    
    if (tem_acesso !== null) {
      query = query.eq('tem_acesso', tem_acesso === 'true');
    }
    
    if (cargo) {
      query = query.eq('pessoas_igrejas.cargo', cargo);
    }
    
    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    let legacyQuery = supabaseAdmin
      .from('pessoas')
      .select(`
        id, nome, cargo, email, telefone, ativo, tem_acesso, usuario_id, foto_url, observacoes,
        criado_em, atualizado_em, data_nascimento, data_casamento, data_batismo, situacao_saude,
        endereco_completo, status_membro, sexo, estado_civil, conjuge_nome, conjuge_religiao,
        nome_pai, nome_mae, naturalidade_cidade, naturalidade_uf, nacionalidade, escolaridade,
        profissao, logradouro, bairro, cep, cidade, uf, latitude, longitude, google_place_id,
        batizado, data_profissao_fe, transferido_ipb, transferido_outra_denominacao,
        cursos_discipulado, grupo_familiar_nome, grupo_familiar_lider, igreja_id,
        usuarios_tags(
          tag_id,
          nivel_habilidade,
          tags_funcoes(id, nome, categoria, cor, icone)
        )
      `)
      .eq('igreja_id', igrejaId)
      .order('nome');

    if (ativo !== null) {
      legacyQuery = legacyQuery.eq('ativo', ativo === 'true');
    }

    if (tem_acesso !== null) {
      legacyQuery = legacyQuery.eq('tem_acesso', tem_acesso === 'true');
    }

    if (cargo) {
      legacyQuery = legacyQuery.eq('cargo', cargo);
    }

    if (busca) {
      legacyQuery = legacyQuery.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
    }

    const { data: legacyData, error: legacyError } = await legacyQuery;

    if (legacyError) throw legacyError;

    // Formatar resposta com tags
    const pessoasComVinculo = data?.map(pessoa => ({
      ...pessoa,
      igreja_id: pessoa.pessoas_igrejas?.[0]?.igreja_id || pessoa.igreja_id,
      cargo: pessoa.pessoas_igrejas?.[0]?.cargo || pessoa.cargo,
      status_membro: pessoa.pessoas_igrejas?.[0]?.status_membro || pessoa.status_membro,
      ativo: pessoa.pessoas_igrejas?.[0]?.ativo ?? pessoa.ativo,
      tags: pessoa.usuarios_tags
        ?.map((ut: any) => ut.tags_funcoes)
        .filter(Boolean) || []
    })) || [];

    const idsComVinculo = new Set(pessoasComVinculo.map((pessoa) => pessoa.id));
    const pessoasLegacy = (legacyData || [])
      .filter((pessoa) => !idsComVinculo.has(pessoa.id))
      .map((pessoa: any) => ({
        ...pessoa,
        tags: pessoa.usuarios_tags
          ?.map((ut: any) => ut.tags_funcoes)
          .filter(Boolean) || []
      }));

    const idsConhecidos = new Set([
      ...idsComVinculo,
      ...pessoasLegacy.map((pessoa) => pessoa.id),
    ]);

    const { data: acessosDiretos, error: acessosDiretosError } = await supabaseAdmin
      .from('usuarios_acesso')
      .select('id, pessoa_id, igreja_id, cargo, ativo')
      .eq('igreja_id', igrejaId)
      .not('pessoa_id', 'is', null);

    if (acessosDiretosError) throw acessosDiretosError;

    const { data: vinculosUsuarios, error: vinculosUsuariosError } = await supabaseAdmin
      .from('usuarios_igrejas')
      .select('usuario_id, cargo, ativo')
      .eq('igreja_id', igrejaId);

    if (vinculosUsuariosError) throw vinculosUsuariosError;

    const usuarioIdsPorVinculo = (vinculosUsuarios || []).map((vinculo) => vinculo.usuario_id).filter(Boolean);

    let acessosPorVinculo: Array<{ id: string; pessoa_id: string | null; cargo?: string | null; ativo?: boolean | null }> = [];

    if (usuarioIdsPorVinculo.length > 0) {
      const { data: acessosData, error: acessosDataError } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, pessoa_id, cargo, ativo')
        .in('id', usuarioIdsPorVinculo)
        .not('pessoa_id', 'is', null);

      if (acessosDataError) throw acessosDataError;
      acessosPorVinculo = acessosData || [];
    }

    const pessoaIdsVindosDeAcesso = Array.from(
      new Set(
        [...(acessosDiretos || []), ...acessosPorVinculo]
          .map((acesso) => acesso.pessoa_id)
          .filter(Boolean)
      )
    ) as string[];

    let pessoasPorAcesso: any[] = [];

    if (pessoaIdsVindosDeAcesso.length > 0) {
      const idsFaltantes = pessoaIdsVindosDeAcesso.filter((id) => !idsConhecidos.has(id));

      if (idsFaltantes.length > 0) {
        const { data: pessoasAcessoData, error: pessoasAcessoError } = await supabaseAdmin
          .from('pessoas')
          .select(`
            id, nome, cargo, email, telefone, ativo, tem_acesso, usuario_id, foto_url, observacoes,
            criado_em, atualizado_em, data_nascimento, data_casamento, data_batismo, situacao_saude,
            endereco_completo, status_membro, sexo, estado_civil, conjuge_nome, conjuge_religiao,
            nome_pai, nome_mae, naturalidade_cidade, naturalidade_uf, nacionalidade, escolaridade,
            profissao, logradouro, bairro, cep, cidade, uf, latitude, longitude, google_place_id,
            batizado, data_profissao_fe, transferido_ipb, transferido_outra_denominacao,
            cursos_discipulado, grupo_familiar_nome, grupo_familiar_lider, igreja_id,
            usuarios_tags(
              tag_id,
              nivel_habilidade,
              tags_funcoes(id, nome, categoria, cor, icone)
            )
          `)
          .in('id', idsFaltantes);

        if (pessoasAcessoError) throw pessoasAcessoError;

        pessoasPorAcesso = (pessoasAcessoData || []).map((pessoa: any) => ({
          ...pessoa,
          tags: pessoa.usuarios_tags
            ?.map((ut: any) => ut.tags_funcoes)
            .filter(Boolean) || []
        }));
      }
    }

    const pessoasFormatadas = [...pessoasComVinculo, ...pessoasLegacy, ...pessoasPorAcesso].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );

    return NextResponse.json({
      success: true,
      data: pessoasFormatadas,
      count: pessoasFormatadas?.length || 0
    });

  } catch (error: any) {
    console.error('Erro ao listar pessoas:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar pessoas' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Criar pessoa
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const permissionContext = await getUserPermissionContext(body.igreja_id || null, request);

    if (!permissionContext?.user) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    if (!permissionContext.canManageUsers) {
      return NextResponse.json({ error: 'Sem permissão para criar pessoas.' }, { status: 403 });
    }

    const {
      nome,
      cargo,
      email,
      telefone,
      ativo = true,
      observacoes,
      status_membro = 'ativo',
      igreja_id: igrejaBodyId,
      ...restoDados
    } = body;
    const igrejaId = await resolveAuthorizedCurrentIgrejaId(igrejaBodyId, request);

    // Validações
    if (!nome || !cargo) {
      return NextResponse.json(
        { error: 'Nome e cargo são obrigatórios' },
        { status: 400 }
      );
    }

    if (!igrejaId) {
      return NextResponse.json(
        { error: 'Nenhuma igreja selecionada.' },
        { status: 400 }
      );
    }

    // Se tiver email, verificar se a pessoa ja existe para aproveitar o cadastro no modelo multi-igreja
    if (email) {
      const emailNormalizado = email.toLowerCase().trim();

      const { data: pessoaExistente, error: pessoaExistenteError } = await supabaseAdmin
        .from('pessoas')
        .select('id, nome, cargo, ativo, status_membro, igreja_id')
        .eq('email', emailNormalizado)
        .maybeSingle();

      if (pessoaExistenteError) throw pessoaExistenteError;

      if (pessoaExistente) {
        const { data: vinculoExistente, error: vinculoExistenteError } = await supabaseAdmin
          .from('pessoas_igrejas')
          .select('id')
          .eq('pessoa_id', pessoaExistente.id)
          .eq('igreja_id', igrejaId)
          .maybeSingle();

        if (vinculoExistenteError) throw vinculoExistenteError;

        if (vinculoExistente) {
          return NextResponse.json(
            {
              error: `Já existe uma pessoa com este email nesta igreja: ${pessoaExistente.nome}`,
              pessoa_existente: pessoaExistente
            },
            { status: 409 }
          );
        }

        const { error: novoVinculoError } = await supabaseAdmin
          .from('pessoas_igrejas')
          .insert({
            pessoa_id: pessoaExistente.id,
            igreja_id: igrejaId,
            status_membro,
            cargo,
            ativo,
            observacoes: observacoes || null,
          });

        if (novoVinculoError) throw novoVinculoError;

        if (pessoaExistente.usuario_id) {
          const { data: acessoExistente, error: acessoExistenteError } = await supabaseAdmin
            .from('usuarios_acesso')
            .select('id')
            .eq('auth_user_id', pessoaExistente.usuario_id)
            .maybeSingle();

          if (acessoExistenteError) throw acessoExistenteError;

          if (acessoExistente?.id) {
            const { error: usuarioIgrejaError } = await supabaseAdmin
              .from('usuarios_igrejas')
              .upsert(
                {
                  usuario_id: acessoExistente.id,
                  igreja_id: igrejaId,
                  cargo,
                  ativo,
                },
                { onConflict: 'usuario_id,igreja_id' }
              );

            if (usuarioIgrejaError) throw usuarioIgrejaError;
          }
        }

        return NextResponse.json({
          success: true,
          message: `${pessoaExistente.nome} já existia e foi vinculada a esta igreja.`,
          data: {
            ...pessoaExistente,
            igreja_id: igrejaId,
            cargo,
            status_membro,
            ativo,
          }
        }, { status: 201 });
      }

    }

    // Criar pessoa
    const { data: pessoa, error } = await supabaseAdmin
      .from('pessoas')
      .insert({
        nome: nome.trim(),
        cargo,
        email: email ? email.toLowerCase().trim() : null,
        telefone: telefone || null,
        ativo,
        observacoes: observacoes || null,
        status_membro,
        igreja_id: igrejaId,
        tem_acesso: false, // Fantasma por padrão
        usuario_id: null,
        ...restoDados,
      })
      .select()
      .single();

    if (error) throw error;

    const { error: vinculoError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .insert({
        pessoa_id: pessoa.id,
        igreja_id: igrejaId,
        status_membro,
        cargo,
        ativo,
        observacoes: observacoes || null,
      });

    if (vinculoError) {
      await supabaseAdmin.from('pessoas').delete().eq('id', pessoa.id);
      throw vinculoError;
    }

    return NextResponse.json({
      success: true,
      message: `${nome} cadastrado${email ? '' : ' (sem acesso - fantasma)'}`,
      data: {
        ...pessoa,
        igreja_id: igrejaId,
        cargo,
        status_membro,
        ativo,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erro ao criar pessoa:', error);
    
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe uma pessoa com este email' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao criar pessoa' },
      { status: 500 }
    );
  }
}
