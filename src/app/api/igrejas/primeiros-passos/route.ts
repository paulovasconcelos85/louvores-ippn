import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';
import { isSuperAdmin } from '@/lib/permissions';
import { getSupabaseAdmin, igrejasGerenciadasPor } from '@/lib/igreja-onboarding';

// GET /api/igrejas/primeiros-passos?igreja_id=...
// Situação de cada etapa do roteiro de implantação, calculada pelos dados reais.
export async function GET(request: NextRequest) {
  const igrejaId = request.nextUrl.searchParams.get('igreja_id');
  if (!igrejaId) return apiError('CHURCH_REQUIRED', 400, 'Informe a igreja.');

  const user = await getAuthenticatedUserFromServerCookies(request);
  if (!user?.id) return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');

  try {
    if (!isSuperAdmin(user.email)) {
      const gerenciadas = await igrejasGerenciadasPor(user);
      if (!gerenciadas.includes(igrejaId)) {
        return apiSuccess({ podeGerenciar: false, etapas: [] });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    const contar = (tabela: 'igreja_cultos' | 'Louvores IPPN' | 'pessoas_igrejas' | 'escalas') =>
      supabaseAdmin.from(tabela).select('*', { count: 'exact', head: true }).eq('igreja_id', igrejaId);

    const [igrejaResult, cultosResult, boletinsResult, pessoasResult, escalasResult] = await Promise.all([
      supabaseAdmin
        .from('igrejas')
        .select('slug, logo_url, endereco_completo, logradouro, whatsapp, instagram, apresentacao_texto')
        .eq('id', igrejaId)
        .maybeSingle(),
      contar('igreja_cultos'),
      contar('Louvores IPPN'),
      contar('pessoas_igrejas'),
      contar('escalas'),
    ]);

    if (igrejaResult.error) throw igrejaResult.error;
    const igreja = igrejaResult.data;
    if (!igreja) return apiError('CHURCH_NOT_FOUND', 404, 'Igreja não encontrada.');

    const etapas = [
      { id: 'identidade', feito: Boolean(igreja.logo_url) },
      {
        id: 'endereco',
        feito: Boolean(igreja.endereco_completo || igreja.logradouro) && Boolean(igreja.whatsapp || igreja.instagram),
      },
      { id: 'cultos', feito: (cultosResult.count || 0) > 0 },
      { id: 'boletim', feito: (boletinsResult.count || 0) > 0 },
      { id: 'equipe', feito: (pessoasResult.count || 0) > 1 },
      { id: 'escala', feito: (escalasResult.count || 0) > 0 },
    ];

    return apiSuccess({ podeGerenciar: true, slug: igreja.slug, etapas });
  } catch (error: any) {
    console.error('Erro ao calcular primeiros passos:', error);
    return apiError('ONBOARDING_FAILED', 500, 'Não foi possível carregar os primeiros passos.');
  }
}
