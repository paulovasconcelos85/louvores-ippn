import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { normalizeIgreja } from '@/lib/church-utils';
import { resolveCurrentIgrejaId } from '@/lib/server-church';
import { isSuperAdmin } from '@/lib/permissions';

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

    let igrejasRaw: Record<string, unknown>[] | null = [];

    if (!user?.id) {
      const { data, error } = await supabaseAdmin
        .from('igrejas')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      igrejasRaw = data;
    } else if (isSuperAdmin(user.email)) {
      const { data, error } = await supabaseAdmin
        .from('igrejas')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      igrejasRaw = data;
    } else {
      const normalizedEmail = user.email?.trim().toLowerCase();

      let acesso: { id: string; igreja_id: string | null } | null = null;

      const byAuth = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, igreja_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (byAuth.error) throw byAuth.error;
      acesso = byAuth.data;

      if (!acesso && normalizedEmail) {
        const byEmail = await supabaseAdmin
          .from('usuarios_acesso')
          .select('id, igreja_id')
          .eq('email', normalizedEmail)
          .limit(1)
          .maybeSingle();

        if (byEmail.error) throw byEmail.error;
        acesso = byEmail.data;
      }

      const { data: vinculos, error: vinculosError } = await supabaseAdmin
        .from('usuarios_igrejas')
        .select('igreja_id')
        .eq('usuario_id', acesso?.id || '')
        .eq('ativo', true);

      if (vinculosError) throw vinculosError;

      const igrejaIds = Array.from(
        new Set(
          [acesso?.igreja_id, ...(vinculos || []).map((vinculo) => vinculo.igreja_id)]
            .filter(Boolean)
        )
      );

      if (igrejaIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('igrejas')
          .select('*')
          .in('id', igrejaIds)
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (error) throw error;
        igrejasRaw = data;
      } else {
        igrejasRaw = [];
      }
    }

    const igrejas = (igrejasRaw || []).map(normalizeIgreja).filter(Boolean);

    const igrejaAtualId = user?.id ? await resolveCurrentIgrejaId() : null;

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
