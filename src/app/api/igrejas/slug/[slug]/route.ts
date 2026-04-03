import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeIgreja } from '@/lib/church-utils';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const normalizedSlug = slug.trim().toLowerCase();

    const { data, error } = await supabaseAdmin
      .from('igrejas')
      .select('*')
      .eq('slug', normalizedSlug)
      .eq('ativo', true)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'Igreja não encontrada.' }, { status: 404 });
    }

    const igreja = normalizeIgreja(data);

    if (!igreja) {
      return NextResponse.json({ error: 'Igreja inválida.' }, { status: 404 });
    }

    return NextResponse.json({ igreja });
  } catch (error: any) {
    console.error('Erro ao buscar igreja por slug:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar igreja.' },
      { status: 500 }
    );
  }
}
