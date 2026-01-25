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

export async function POST(request: NextRequest) {
  try {
    const { email, nome } = await request.json();

    if (!email || !nome) {
      return NextResponse.json(
        { error: 'Email e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;

    // 1. Tentar enviar o convite inicial
    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        nome: nome,
        convite_enviado: true
      },
      redirectTo: redirectUrl
    });

    // 2. Se o erro for "usuário já cadastrado", enviamos um e-mail de recuperação
    if (inviteError && inviteError.message.includes('already been registered')) {
      console.log('Usuário já existe. Enviando link de recuperação para:', email);
      
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Usuário já possui cadastro. Um e-mail de definição de senha foi enviado.',
        isExistingUser: true
      });
    }

    // 3. Outros erros do invite
    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message || 'Erro ao enviar convite' },
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