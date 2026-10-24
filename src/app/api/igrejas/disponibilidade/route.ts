import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { normalizarSlug, sugerirSlugs, validarSlug } from '@/lib/slug-igreja';
import { slugsOcupados } from '@/lib/igreja-onboarding';

// GET /api/igrejas/disponibilidade?slug=ippn&nome=...&sigla=...&cidade=...
// Responde se o slug pedido está livre e sugere alternativas livres.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = normalizarSlug(params.get('slug') || '');
  const sugestoesBase = sugerirSlugs({
    nome: params.get('nome'),
    sigla: params.get('sigla'),
    cidade: params.get('cidade'),
  });

  try {
    const ocupados = await slugsOcupados([slug, ...sugestoesBase]);
    const motivo = slug ? validarSlug(slug) || (ocupados.has(slug) ? 'ocupado' : null) : null;
    const sugestoes = sugestoesBase.filter((item) => !ocupados.has(item) && item !== slug).slice(0, 4);

    return apiSuccess({
      slug,
      disponivel: Boolean(slug) && !motivo,
      motivo,
      sugestoes,
    });
  } catch (error: any) {
    console.error('Erro ao verificar slug:', error);
    return apiError('SLUG_CHECK_FAILED', 500, 'Não foi possível verificar o endereço agora.');
  }
}
