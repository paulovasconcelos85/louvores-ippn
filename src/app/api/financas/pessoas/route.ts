import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro } from '@/lib/financas-server';

// GET /api/financas/pessoas?igreja_id&q= -> pessoas da igreja, para escolher
// o contribuinte de um dízimo ou um membro da equipe da tesouraria.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ctx = await contextoFinanceiro(request, params.get('igreja_id'));
  if (ctx.error) return ctx.error;
  if (!ctx.permissoes.podeLancar && !ctx.permissoes.podeDesignarEquipe) {
    return apiError('FORBIDDEN', 403, 'Sem permissão.');
  }

  const busca = (params.get('q') || '').trim().replace(/[%_,()]/g, ' ');

  try {
    let query = ctx.supabaseAdmin
      .from('pessoas_igrejas')
      .select('pessoa_id, pessoas!inner(id, nome)')
      .eq('igreja_id', ctx.igrejaId)
      .order('nome', { referencedTable: 'pessoas' })
      .limit(20);
    if (busca) query = query.ilike('pessoas.nome', `%${busca}%`);

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({
      pessoas: (data || []).map((item: any) => ({ id: item.pessoas.id, nome: item.pessoas.nome })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar pessoas para finanças:', error);
    return apiError('PEOPLE_LOAD_FAILED', 500, 'Não foi possível buscar as pessoas.');
  }
}
