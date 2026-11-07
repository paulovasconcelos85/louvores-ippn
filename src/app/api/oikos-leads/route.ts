import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { lerCorpo, textoObrigatorio, textoOpcional } from '@/lib/validacao';

let supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(
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

const leadSchema = z.object({
  nome: textoObrigatorio(160, 'Nome e contato são obrigatórios.'),
  contato: textoObrigatorio(180, 'Nome e contato são obrigatórios.'),
  mensagem: textoOpcional(2000),
  igreja: textoOpcional(180),
  funcao: textoOpcional(120),
  locale: textoOpcional(10),
});

export async function POST(request: NextRequest) {
  try {
    const corpo = await lerCorpo(request, leadSchema);
    if (corpo.error) return corpo.error;
    const { nome, contato, mensagem, igreja, funcao, locale } = corpo.data;

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
