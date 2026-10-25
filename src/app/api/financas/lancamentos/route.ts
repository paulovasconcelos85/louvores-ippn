import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro, dataTravada, periodosTravados } from '@/lib/financas-server';
import { validarLancamento } from '@/lib/financas-lancamento';

const LIMITE = 500;

// GET /api/financas/lancamentos?igreja_id&inicio&fim[&conta_id][&categoria_id][&pessoa_id]
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ctx = await contextoFinanceiro(request, params.get('igreja_id'));
  if (ctx.error) return ctx.error;

  const inicio = params.get('inicio');
  const fim = params.get('fim');
  if (!inicio || !fim) return apiError('PERIOD_REQUIRED', 400, 'Informe o período.');

  try {
    let query = ctx.supabaseAdmin
      .from('fin_lancamentos')
      .select('*, pessoas(nome)')
      .eq('igreja_id', ctx.igrejaId)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(LIMITE);

    for (const campo of ['conta_id', 'categoria_id'] as const) {
      const valor = params.get(campo);
      if (valor) query = query.eq(campo, valor);
    }
    // Filtrar por pessoa revelaria o contribuinte: só quem pode ver nomes.
    const pessoaId = params.get('pessoa_id');
    if (pessoaId && ctx.permissoes.podeVerNomes) query = query.eq('pessoa_id', pessoaId);

    const { data, error } = await query;
    if (error) throw error;

    const anos = [Number(inicio.slice(0, 4)), Number(fim.slice(0, 4))];
    const travados = await periodosTravados(ctx.igrejaId, anos);

    const lancamentos = (data || []).map((item: any) => ({
      id: item.id,
      tipo: item.tipo,
      data: item.data,
      valor: Number(item.valor),
      conta_id: item.conta_id,
      conta_destino_id: item.conta_destino_id,
      categoria_id: item.categoria_id,
      // Sigilo: sem permissão, nem o id da pessoa sai do servidor.
      pessoa_id: ctx.permissoes.podeVerNomes ? item.pessoa_id : null,
      pessoa_nome: ctx.permissoes.podeVerNomes ? item.pessoas?.nome || null : item.pessoa_id ? 'Contribuinte identificado' : null,
      descricao: item.descricao,
      forma_pagamento: item.forma_pagamento,
      documento_tipo: item.documento_tipo,
      documento_numero: item.documento_numero,
      comprovante_path: item.comprovante_path,
      travado: dataTravada(travados, item.data),
    }));

    return apiSuccess({ lancamentos, limite: LIMITE, truncado: lancamentos.length === LIMITE });
  } catch (error: any) {
    console.error('Erro ao listar lançamentos:', error);
    return apiError('ENTRIES_LOAD_FAILED', 500, 'Não foi possível carregar os lançamentos.');
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 400, 'Dados inválidos.');
  }

  const ctx = await contextoFinanceiro(request, typeof body.igreja_id === 'string' ? body.igreja_id : null);
  if (ctx.error) return ctx.error;
  if (!ctx.permissoes.podeLancar) return apiError('FORBIDDEN', 403, 'Só a equipe da tesouraria faz lançamentos.');

  try {
    const validado = await validarLancamento(ctx.igrejaId, body);
    if (validado.error) return validado.error;

    const { data, error } = await ctx.supabaseAdmin
      .from('fin_lancamentos')
      .insert({ ...validado.registro, igreja_id: ctx.igrejaId, criado_por: ctx.user.id })
      .select('id')
      .single();
    if (error) throw error;

    return apiSuccess({ id: data.id }, { status: 201, message: 'Lançamento registrado.' });
  } catch (error: any) {
    console.error('Erro ao criar lançamento:', error);
    return apiError('ENTRY_SAVE_FAILED', 500, 'Não foi possível salvar o lançamento.');
  }
}
