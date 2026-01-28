import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    
    let query = supabaseAdmin
      .from('pessoas')
      .select(`
        *,
        usuarios_tags(
          tag_id,
          nivel_habilidade,
          tags_funcoes(id, nome, categoria, cor, icone)
        )
      `)
      .order('nome');

    // Aplicar filtros
    if (ativo !== null) {
      query = query.eq('ativo', ativo === 'true');
    }
    
    if (tem_acesso !== null) {
      query = query.eq('tem_acesso', tem_acesso === 'true');
    }
    
    if (cargo) {
      query = query.eq('cargo', cargo);
    }
    
    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Formatar resposta com tags
    const pessoasFormatadas = data?.map(pessoa => ({
      ...pessoa,
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
    const { nome, cargo, email, telefone, ativo = true, observacoes } = body;

    // Validações
    if (!nome || !cargo) {
      return NextResponse.json(
        { error: 'Nome e cargo são obrigatórios' },
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
        tem_acesso: false, // Fantasma por padrão
        usuario_id: null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${nome} cadastrado${email ? '' : ' (sem acesso - fantasma)'}`,
      data: pessoa
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