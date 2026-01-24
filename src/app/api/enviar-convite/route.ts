import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase Admin (necessário para usar auth.admin)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ⚠️ IMPORTANTE: Usar SERVICE ROLE KEY (nunca expor no frontend)
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { email, nome } = await request.json();

    if (!email || !nome) {
      return NextResponse.json(
        { error: 'Email e nome são obrigatórios' },
        { status: 400 }
      );
    }

    // Usar Supabase Auth Admin para enviar convite (magic link)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        nome: nome,
        convite_enviado: true
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
    });

    if (error) {
      console.error('Erro ao enviar convite:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao enviar convite' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Convite enviado para ${email}`,
      data
    });

  } catch (error: any) {
    console.error('Erro na API de convite:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}