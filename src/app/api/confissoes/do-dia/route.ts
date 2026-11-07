import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { buscarItemDoDia } from '@/lib/confissoes';

// GET /api/confissoes/do-dia?data=2026-11-07
// Pública. A data vem do navegador, para valer o fuso de quem lê.
export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get('data') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return apiError('CONFESSION_DATE_INVALID', 400, 'Data inválida.');
  }

  try {
    const resultado = await buscarItemDoDia(data);
    if (!resultado) return apiError('CONFESSION_NOT_FOUND', 404, 'Nenhum texto disponível.');

    return NextResponse.json(resultado, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (error) {
    console.error('Erro ao buscar texto confessional do dia:', error);
    return apiError('CONFESSION_FAILED', 500, 'Não foi possível carregar o texto do dia.');
  }
}
