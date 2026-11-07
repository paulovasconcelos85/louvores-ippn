import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { apiError } from '@/lib/api-response';
import { REGEX_ID_PASSAGEM } from '@/lib/biblia-referencias';
import { BIBLIA_POR_LOCALE, buscarPassagem, buscarVersao, YouVersionError } from '@/lib/youversion';

const MAX_PASSAGENS = 4;

// GET /api/biblia/passagem?ids=PSA.46,PSA.47&locale=pt
// Pública (boletim): devolve o texto das passagens na versão do idioma.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = (params.get('ids') || '')
    .split(',')
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);

  if (ids.length === 0 || ids.length > MAX_PASSAGENS || !ids.every((id) => REGEX_ID_PASSAGEM.test(id))) {
    return apiError('BIBLE_PASSAGE_INVALID', 400, 'Passagem bíblica inválida.');
  }

  const localeParam = params.get('locale') as Locale | null;
  const locale: Locale = localeParam && SUPPORTED_LOCALES.includes(localeParam) ? localeParam : 'pt';
  const bibliaId = BIBLIA_POR_LOCALE[locale];

  try {
    const [versao, ...passagens] = await Promise.all([
      buscarVersao(bibliaId),
      ...ids.map((id) => buscarPassagem(bibliaId, id)),
    ]);

    return NextResponse.json(
      { versao, passagens },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
    );
  } catch (error) {
    if (error instanceof YouVersionError && error.status === 404) {
      return apiError('BIBLE_PASSAGE_NOT_FOUND', 404, 'Passagem não encontrada nesta versão.');
    }
    console.error('Erro ao buscar passagem no YouVersion:', error);
    return apiError('BIBLE_PASSAGE_FAILED', 502, 'Não foi possível carregar o texto bíblico.');
  }
}
