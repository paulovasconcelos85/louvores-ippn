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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 400 }
      );
    }

    // Buscar convite
    const { data: convite, error } = await supabaseAdmin
      .from('convites')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !convite) {
      return NextResponse.json(
        { error: 'Convite não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se está expirado
    if (new Date(convite.expira_em) < new Date()) {
      await supabaseAdmin
        .from('convites')
        .update({ status: 'expirado' })
        .eq('id', convite.id);

      return NextResponse.json(
        { 
          error: 'Convite expirado',
          expira_em: convite.expira_em
        },
        { status: 410 }
      );
    }

    // Verificar se já foi aceito
    if (convite.status !== 'pendente') {
      return NextResponse.json(
        { 
          error: `Convite já foi ${convite.status}`,
          status: convite.status,
          aceito_em: convite.aceito_em
        },
        { status: 400 }
      );
    }

    // Retornar dados do convite (sem informações sensíveis)
    return NextResponse.json({
      success: true,
      convite: {
        email: convite.email,
        nome: convite.nome,
        cargo: convite.cargo,
        expira_em: convite.expira_em,
        pessoa_id: convite.pessoa_id // null se for novo usuário
      }
    });

  } catch (error: any) {
    console.error('Erro ao verificar convite:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar convite' },
      { status: 500 }
    );
  }
}