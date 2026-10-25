import { apiError } from '@/lib/api-response';
import { dataTravada, getSupabaseAdmin, periodosTravados } from '@/lib/financas-server';
import { FORMAS_PAGAMENTO, TIPOS_DOCUMENTO, centavos } from '@/lib/financas';

// Validação comum de criar e editar lançamento. Devolve o registro pronto
// para gravar ou a resposta de erro.

const FORMAS = new Set<string>(FORMAS_PAGAMENTO.map((f) => f.valor));
const DOCUMENTOS = new Set<string>(TIPOS_DOCUMENTO.map((d) => d.valor));

function texto(value: unknown, max = 300) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function validarLancamento(igrejaId: string, body: Record<string, unknown>) {
  const supabaseAdmin = getSupabaseAdmin();
  const tipo = body.tipo;
  if (tipo !== 'receita' && tipo !== 'despesa' && tipo !== 'transferencia') {
    return { error: apiError('ENTRY_TYPE_INVALID', 400, 'Tipo de lançamento inválido.') };
  }

  const data = texto(body.data, 10);
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { error: apiError('ENTRY_DATE_INVALID', 400, 'Informe a data.') };
  }

  const valorCentavos = centavos(Number(body.valor));
  if (valorCentavos <= 0) {
    return { error: apiError('ENTRY_VALUE_INVALID', 400, 'Informe um valor maior que zero.') };
  }

  const contaId = texto(body.conta_id, 40);
  const contaDestinoId = tipo === 'transferencia' ? texto(body.conta_destino_id, 40) : null;
  const categoriaId = tipo === 'transferencia' ? null : texto(body.categoria_id, 40);
  let pessoaId = tipo === 'receita' ? texto(body.pessoa_id, 40) : null;

  const idsContas = [contaId, contaDestinoId].filter(Boolean) as string[];
  const { data: contas, error: contasError } = await supabaseAdmin
    .from('fin_contas')
    .select('id, nome, data_saldo_inicial')
    .eq('igreja_id', igrejaId)
    .in('id', idsContas.length ? idsContas : ['00000000-0000-0000-0000-000000000000']);
  if (contasError) throw contasError;

  if (!contaId || !contas?.some((c) => c.id === contaId)) {
    return { error: apiError('ENTRY_ACCOUNT_INVALID', 400, 'Escolha a conta.') };
  }
  if (tipo === 'transferencia' && (!contaDestinoId || contaDestinoId === contaId || !contas.some((c) => c.id === contaDestinoId))) {
    return { error: apiError('ENTRY_TARGET_INVALID', 400, 'Escolha uma conta de destino diferente da origem.') };
  }

  const antesDaImplantacao = contas.find((c) => data < c.data_saldo_inicial);
  if (antesDaImplantacao) {
    return {
      error: apiError(
        'ENTRY_BEFORE_OPENING',
        400,
        `A conta "${antesDaImplantacao.nome}" começa em ${antesDaImplantacao.data_saldo_inicial.split('-').reverse().join('/')}. Lançamentos anteriores entram no saldo inicial dela.`
      ),
    };
  }

  if (tipo !== 'transferencia') {
    const { data: categoria, error: catError } = await supabaseAdmin
      .from('fin_categorias')
      .select('id, tipo, nominal')
      .eq('igreja_id', igrejaId)
      .eq('id', categoriaId || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();
    if (catError) throw catError;
    if (!categoria || categoria.tipo !== tipo) {
      return { error: apiError('ENTRY_CATEGORY_INVALID', 400, 'Escolha a categoria.') };
    }
    if (!categoria.nominal) pessoaId = null;
  }

  if (pessoaId) {
    const { data: vinculo, error: vinculoError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .select('pessoa_id')
      .eq('igreja_id', igrejaId)
      .eq('pessoa_id', pessoaId)
      .limit(1)
      .maybeSingle();
    if (vinculoError) throw vinculoError;
    if (!vinculo) return { error: apiError('ENTRY_PERSON_INVALID', 400, 'Esta pessoa não pertence à igreja.') };
  }

  const travados = await periodosTravados(igrejaId, [Number(data.slice(0, 4))]);
  if (dataTravada(travados, data)) {
    return { error: apiError('PERIOD_LOCKED', 409, 'Este período já foi enviado à Comissão de Exame de Contas e está travado.') };
  }

  const forma = texto(body.forma_pagamento, 20);
  const documento = texto(body.documento_tipo, 20);
  // Só aceita comprovante guardado na pasta desta igreja.
  const comprovante = texto(body.comprovante_path, 300);
  const comprovantePath = comprovante && comprovante.startsWith(`${igrejaId}/`) && !comprovante.includes('..') ? comprovante : null;

  return {
    registro: {
      tipo,
      data,
      valor: valorCentavos / 100,
      conta_id: contaId,
      conta_destino_id: contaDestinoId,
      categoria_id: categoriaId,
      pessoa_id: pessoaId,
      descricao: texto(body.descricao, 300),
      forma_pagamento: forma && FORMAS.has(forma) ? forma : null,
      documento_tipo: documento && DOCUMENTOS.has(documento) ? documento : null,
      documento_numero: texto(body.documento_numero, 60),
      comprovante_path: comprovantePath,
    },
  };
}
