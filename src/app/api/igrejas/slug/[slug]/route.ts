import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeIgreja } from '@/lib/church-utils';
import { apiError, apiSuccess } from '@/lib/api-response';

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

    if (!data || data.visivel_publico === false) {
      return apiError('CHURCH_NOT_FOUND', 404, 'Igreja não encontrada.');
    }

    const igreja = normalizeIgreja(data);

    if (!igreja) {
      return apiError('CHURCH_NOT_FOUND', 404, 'Igreja inválida.');
    }

    return apiSuccess({
      igreja: {
        ...igreja,
        apresentacao_titulo: typeof data.apresentacao_titulo === 'string' ? data.apresentacao_titulo : null,
        apresentacao_texto: typeof data.apresentacao_texto === 'string' ? data.apresentacao_texto : null,
        apresentacao_titulo_i18n:
          data.apresentacao_titulo_i18n && typeof data.apresentacao_titulo_i18n === 'object'
            ? data.apresentacao_titulo_i18n
            : null,
        apresentacao_texto_i18n:
          data.apresentacao_texto_i18n && typeof data.apresentacao_texto_i18n === 'object'
            ? data.apresentacao_texto_i18n
            : null,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar igreja por slug:', error);
    return apiError(
      'LOAD_CHURCH_DETAILS_FAILED',
      500,
      error.message || 'Erro ao buscar igreja.'
    );
  }
}
