import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCurrentIgrejaId } from '@/lib/server-church';

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
    const { searchParams } = new URL(request.url);
    
    // Filtros opcionais
    const ativo = searchParams.get('ativo'); // true/false
    const tem_acesso = searchParams.get('tem_acesso'); // true/false
    const cargo = searchParams.get('cargo'); // musico, pastor, etc
    const busca = searchParams.get('busca'); // busca por nome/email
    const igrejaParam = searchParams.get('igreja_id');
    const igrejaId = await resolveCurrentIgrejaId(igrejaParam);

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

    // Formatar resposta com tags
    const pessoasFormatadas = data?.map(pessoa => ({
      ...pessoa,
      igreja_id: pessoa.pessoas_igrejas?.[0]?.igreja_id || pessoa.igreja_id,
      cargo: pessoa.pessoas_igrejas?.[0]?.cargo || pessoa.cargo,
      status_membro: pessoa.pessoas_igrejas?.[0]?.status_membro || pessoa.status_membro,
      ativo: pessoa.pessoas_igrejas?.[0]?.ativo ?? pessoa.ativo,
      tags: pessoa.usuarios_tags
        ?.map((ut: any) => ut.tags_funcoes)
        .filter(Boolean) || []
    }));

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
    const igrejaId = await resolveCurrentIgrejaId(igrejaBodyId);

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

    // Se tiver email, verificar se já existe
    if (email) {
      const { data: pessoaExistente } = await supabaseAdmin
        .from('pessoas')
        .select('id, nome')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (pessoaExistente) {
        return NextResponse.json(
          { 
            error: `Já existe uma pessoa com este email: ${pessoaExistente.nome}`,
            pessoa_existente: pessoaExistente
          },
          { status: 409 }
        );
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
