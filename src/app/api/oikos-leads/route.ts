import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdmin;
}

function sanitizeString(value: unknown, maxLength = 1000) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const nome = sanitizeString(body.nome, 160);
    const contato = sanitizeString(body.contato, 180);
    const mensagem = sanitizeString(body.mensagem, 2000);
    const igreja = sanitizeString(body.igreja, 180);
    const funcao = sanitizeString(body.funcao, 120);
    const locale = sanitizeString(body.locale, 10);

    if (!nome || !contato) {
      return NextResponse.json(
        { error: 'Nome e contato são obrigatórios.' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from('oikos_leads')
      .insert({
        nome,
        contato,
        mensagem,
        igreja,
        funcao,
        locale,
        origem: 'landing_oikos',
        status: 'novo',
        user_agent: request.headers.get('user-agent'),
      })
      .select('id, criado_em, status')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lead: data });
  } catch (error: any) {
    console.error('Erro ao salvar lead OIKOS:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar interesse.' },
      { status: 500 }
    );
  }
}
