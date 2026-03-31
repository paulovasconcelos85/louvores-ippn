import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(request: NextRequest) {
  try {
    const nome = request.nextUrl.searchParams.get('nome');

    if (!nome) {
      return NextResponse.json({ error: 'nome e obrigatorio.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('canticos_unificados')
      .select(
        'tipo, numero, nome, letra, referencia, tags, autor_letra, compositor, youtube_url, spotify_url, audio_url'
      )
      .eq('nome', nome)
      .limit(10);

    if (error) throw error;

    const lista = data || [];
    const cantico =
      lista.find((item) => item.letra && item.letra.trim().length > 0) ||
      lista[0] ||
      null;

    return NextResponse.json({ cantico });
  } catch (error: any) {
    console.error('Erro ao carregar cântico público:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar cântico.' },
      { status: 500 }
    );
  }
}
