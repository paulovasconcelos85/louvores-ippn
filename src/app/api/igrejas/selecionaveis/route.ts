import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: igrejasRaw, error: igrejasError } = await supabaseAdmin
      .from('igrejas')
      .select('*')
      .order('nome', { ascending: true });

    if (igrejasError) throw igrejasError;

    const igrejas = (igrejasRaw || []).map(normalizeIgreja).filter(Boolean);

    let igrejaAtualId: string | null = null;

    if (user?.id) {
      const { data: acesso } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const { data: vinculo } = await supabaseAdmin
        .from('usuarios_igrejas')
        .select('igreja_id')
        .eq('usuario_id', acesso?.id || '')
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      igrejaAtualId = vinculo?.igreja_id || null;
    }

    return NextResponse.json({
      igrejas,
      igrejaAtualId,
    });
  } catch (error: any) {
    console.error('Erro ao listar igrejas selecionaveis:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar igrejas.' },
      { status: 500 }
    );
  }
}
