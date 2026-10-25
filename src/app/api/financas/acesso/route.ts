import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro } from '@/lib/financas-server';

// GET /api/financas/acesso?igreja_id=... -> só se a pessoa vê a Tesouraria (para menu e painel).
export async function GET(request: NextRequest) {
  const ctx = await contextoFinanceiro(request, request.nextUrl.searchParams.get('igreja_id'));
  return apiSuccess({ podeVer: !ctx.error });
}
