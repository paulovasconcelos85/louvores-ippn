import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { calcularResumo, carregarBase, contextoFinanceiro, resumirBase } from '@/lib/financas-server';
import { centavos } from '@/lib/financas';

// GET /api/financas/relatorios?igreja_id&tipo=...
//   tipo=periodo&inicio&fim       -> balancete do período (valores em centavos)
//   tipo=anual&ano                -> relatório da IPB (seção IV), dízimo ao SC mês a mês e orçamento
//   tipo=contribuinte&ano&pessoa_id -> contribuições de uma pessoa no ano (declaração para IR)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ctx = await contextoFinanceiro(request, params.get('igreja_id'));
  if (ctx.error) return ctx.error;
  const tipo = params.get('tipo');

  try {
    if (tipo === 'periodo') {
      const inicio = params.get('inicio');
      const fim = params.get('fim');
      if (!inicio || !fim || inicio > fim) return apiError('PERIOD_REQUIRED', 400, 'Informe o período.');
      return apiSuccess({ resumo: await calcularResumo(ctx.igrejaId, inicio, fim) });
    }

    if (tipo === 'anual') {
      const ano = Number(params.get('ano'));
      if (!ano) return apiError('YEAR_REQUIRED', 400, 'Informe o ano.');

      const pad = (n: number) => String(n).padStart(2, '0');
      const [base, orcamento] = await Promise.all([
        carregarBase(ctx.igrejaId, `${ano}-12-31`),
        ctx.supabaseAdmin.from('fin_orcamentos').select('categoria_id, valor_previsto').eq('igreja_id', ctx.igrejaId).eq('ano', ano),
      ]);
      if (orcamento.error) throw orcamento.error;

      const resumo = resumirBase(base, `${ano}-01-01`, `${ano}-12-31`);
      const meses = Array.from({ length: 12 }, (_, i) => {
        const ultimo = new Date(Date.UTC(ano, i + 1, 0)).getUTCDate();
        return resumirBase(base, `${ano}-${pad(i + 1)}-01`, `${ano}-${pad(i + 1)}-${pad(ultimo)}`);
      });

      return apiSuccess({
        resumo,
        meses: meses.map((mes, i) => ({
          mes: i + 1,
          receitas: mes.totalReceitas,
          despesas: mes.totalDespesas,
          dizimosOfertas: mes.grupos.dizimos_ofertas,
          dizimoScDevido: mes.dizimoScDevido,
          dizimoScPago: mes.dizimoScPago,
        })),
        orcamento: Object.fromEntries((orcamento.data || []).map((o) => [o.categoria_id, centavos(o.valor_previsto)])),
      });
    }

    if (tipo === 'contribuinte') {
      if (!ctx.permissoes.podeVerNomes) return apiError('FORBIDDEN', 403, 'Só tesouraria e pastor veem contribuições nominais.');
      const ano = Number(params.get('ano'));
      const pessoaId = params.get('pessoa_id');
      if (!ano || !pessoaId) return apiError('PARAMS_REQUIRED', 400, 'Informe o ano e a pessoa.');

      const [{ data: pessoa }, { data, error }] = await Promise.all([
        ctx.supabaseAdmin.from('pessoas').select('nome').eq('id', pessoaId).maybeSingle(),
        ctx.supabaseAdmin
          .from('fin_lancamentos')
          .select('data, valor, fin_categorias(nome)')
          .eq('igreja_id', ctx.igrejaId)
          .eq('pessoa_id', pessoaId)
          .eq('tipo', 'receita')
          .gte('data', `${ano}-01-01`)
          .lte('data', `${ano}-12-31`)
          .order('data'),
      ]);
      if (error) throw error;

      const itens = (data || []).map((item: any) => ({
        data: item.data,
        valor: centavos(item.valor),
        categoria: item.fin_categorias?.nome || '',
      }));
      return apiSuccess({
        pessoa: pessoa?.nome || '',
        itens,
        total: itens.reduce((soma, item) => soma + item.valor, 0),
      });
    }

    return apiError('REPORT_TYPE_INVALID', 400, 'Tipo de relatório inválido.');
  } catch (error: any) {
    console.error('Erro ao gerar relatório financeiro:', error);
    return apiError('REPORT_FAILED', 500, 'Não foi possível gerar o relatório.');
  }
}
