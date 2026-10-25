import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro, garantirCategoriasPadrao } from '@/lib/financas-server';

// GET /api/financas/contexto?igreja_id=...
// Tudo o que a tela de Finanças precisa para abrir: permissões, contas,
// categorias (criadas no primeiro acesso) e a equipe da tesouraria.
export async function GET(request: NextRequest) {
  const igrejaId = request.nextUrl.searchParams.get('igreja_id');
  const ctx = await contextoFinanceiro(request, igrejaId);
  if (ctx.error) return ctx.error;

  try {
    await garantirCategoriasPadrao(ctx.igrejaId);
    const anoAtual = new Date().getFullYear();

    const [igreja, contas, categorias, equipe] = await Promise.all([
      ctx.supabaseAdmin.from('igrejas').select('nome, nome_abreviado, pais').eq('id', ctx.igrejaId).maybeSingle(),
      ctx.supabaseAdmin.from('fin_contas').select('*').eq('igreja_id', ctx.igrejaId).order('ordem').order('nome'),
      ctx.supabaseAdmin.from('fin_categorias').select('*').eq('igreja_id', ctx.igrejaId).order('tipo').order('ordem'),
      ctx.supabaseAdmin
        .from('fin_equipe')
        .select('id, papel, ano, pessoa_id, pessoas(nome)')
        .eq('igreja_id', ctx.igrejaId)
        .in('ano', [anoAtual, anoAtual - 1])
        .order('papel'),
    ]);

    for (const result of [igreja, contas, categorias, equipe]) {
      if (result.error) throw result.error;
    }

    return apiSuccess({
      permissoes: ctx.permissoes,
      igreja: igreja.data,
      contas: contas.data || [],
      categorias: categorias.data || [],
      equipe: (equipe.data || []).map((item: any) => ({
        id: item.id,
        papel: item.papel,
        ano: item.ano,
        pessoa_id: item.pessoa_id,
        nome: item.pessoas?.nome || '',
      })),
    });
  } catch (error: any) {
    console.error('Erro ao carregar contexto financeiro:', error);
    return apiError('FINANCE_CONTEXT_FAILED', 500, 'Não foi possível carregar as finanças. As tabelas do módulo já foram criadas?');
  }
}
