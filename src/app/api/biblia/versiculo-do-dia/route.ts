import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { apiError } from '@/lib/api-response';
import {
  BIBLIA_POR_LOCALE,
  buscarPassagem,
  buscarVersao,
  buscarVersiculoDoDia,
} from '@/lib/youversion';

// GET /api/biblia/versiculo-do-dia?dia=310&locale=pt
// Pública. O dia do ano vem do navegador, para valer o fuso de quem lê.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dia = Number(params.get('dia'));

  if (!Number.isInteger(dia) || dia < 1 || dia > 366) {
    return apiError('VERSE_OF_DAY_INVALID', 400, 'Dia do ano inválido.');
  }

  const localeParam = params.get('locale') as Locale | null;
  const locale: Locale = localeParam && SUPPORTED_LOCALES.includes(localeParam) ? localeParam : 'pt';
  const bibliaId = BIBLIA_POR_LOCALE[locale];

  try {
    const passagemId = await buscarVersiculoDoDia(dia);
    const [versao, passagem] = await Promise.all([buscarVersao(bibliaId), buscarPassagem(bibliaId, passagemId)]);

    return NextResponse.json(
      { versao, passagem },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (error) {
    console.error('Erro ao buscar versículo do dia no YouVersion:', error);
    return apiError('VERSE_OF_DAY_FAILED', 502, 'Não foi possível carregar o versículo do dia.');
  }
}
