import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro } from '@/lib/financas-server';
import { centavos } from '@/lib/financas';

// PUT /api/financas/orcamento { igreja_id, ano, valores: { [categoria_id]: valor } }
// O previsto de cada categoria; o realizado vem do relatório anual.
export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 400, 'Dados inválidos.');
  }

  const ctx = await contextoFinanceiro(request, typeof body.igreja_id === 'string' ? body.igreja_id : null);
  if (ctx.error) return ctx.error;
  if (!ctx.permissoes.podeConfigurar) return apiError('FORBIDDEN', 403, 'Sem permissão para editar o orçamento.');

  const ano = Number(body.ano);
  const valores = body.valores && typeof body.valores === 'object' ? (body.valores as Record<string, unknown>) : null;
  if (!ano || !valores) return apiError('BUDGET_INVALID', 400, 'Informe o ano e os valores.');

  try {
    const { data: categorias, error: catError } = await ctx.supabaseAdmin
      .from('fin_categorias')
      .select('id')
      .eq('igreja_id', ctx.igrejaId);
    if (catError) throw catError;
    const validas = new Set((categorias || []).map((c) => c.id));

    const linhas = Object.entries(valores)
      .filter(([id]) => validas.has(id))
      .map(([categoria_id, valor]) => ({
        igreja_id: ctx.igrejaId,
        ano,
        categoria_id,
        valor_previsto: Math.max(0, centavos(Number(valor))) / 100,
        atualizado_em: new Date().toISOString(),
      }));

    if (linhas.length > 0) {
      const { error } = await ctx.supabaseAdmin
        .from('fin_orcamentos')
        .upsert(linhas, { onConflict: 'igreja_id,ano,categoria_id' });
      if (error) throw error;
    }

    return apiSuccess({ ok: true }, { message: 'Orçamento salvo.' });
  } catch (error: any) {
    console.error('Erro ao salvar orçamento:', error);
    return apiError('BUDGET_SAVE_FAILED', 500, 'Não foi possível salvar o orçamento.');
  }
}
