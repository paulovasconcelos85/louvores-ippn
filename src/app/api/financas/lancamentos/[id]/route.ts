import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro, dataTravada, periodosTravados } from '@/lib/financas-server';
import { validarLancamento } from '@/lib/financas-lancamento';

const BUCKET = 'financas-comprovantes';

async function carregar(request: NextRequest, id: string, igrejaId: string | null) {
  const ctx = await contextoFinanceiro(request, igrejaId);
  if (ctx.error) return { error: ctx.error };
  if (!ctx.permissoes.podeLancar) {
    return { error: apiError('FORBIDDEN', 403, 'Só a equipe da tesouraria altera lançamentos.') };
  }

  const { data: atual, error } = await ctx.supabaseAdmin
    .from('fin_lancamentos')
    .select('id, data, comprovante_path')
    .eq('igreja_id', ctx.igrejaId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!atual) return { error: apiError('ENTRY_NOT_FOUND', 404, 'Lançamento não encontrado.') };

  const travados = await periodosTravados(ctx.igrejaId, [Number(atual.data.slice(0, 4))]);
  if (dataTravada(travados, atual.data)) {
    return { error: apiError('PERIOD_LOCKED', 409, 'Este período já foi enviado à Comissão de Exame de Contas e está travado.') };
  }

  return { ctx, atual };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 400, 'Dados inválidos.');
  }

  try {
    const carregado = await carregar(request, id, typeof body.igreja_id === 'string' ? body.igreja_id : null);
    if (carregado.error) return carregado.error;
    const { ctx, atual } = carregado;

    const validado = await validarLancamento(ctx.igrejaId, body);
    if (validado.error) return validado.error;

    const { error } = await ctx.supabaseAdmin
      .from('fin_lancamentos')
      .update({ ...validado.registro, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .eq('igreja_id', ctx.igrejaId);
    if (error) throw error;

    if (atual.comprovante_path && atual.comprovante_path !== validado.registro.comprovante_path) {
      await ctx.supabaseAdmin.storage.from(BUCKET).remove([atual.comprovante_path]);
    }

    return apiSuccess({ id }, { message: 'Lançamento atualizado.' });
  } catch (error: any) {
    console.error('Erro ao atualizar lançamento:', error);
    return apiError('ENTRY_SAVE_FAILED', 500, 'Não foi possível salvar o lançamento.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const carregado = await carregar(request, id, request.nextUrl.searchParams.get('igreja_id'));
    if (carregado.error) return carregado.error;
    const { ctx, atual } = carregado;

    const { error } = await ctx.supabaseAdmin.from('fin_lancamentos').delete().eq('id', id).eq('igreja_id', ctx.igrejaId);
    if (error) throw error;

    if (atual.comprovante_path) {
      await ctx.supabaseAdmin.storage.from(BUCKET).remove([atual.comprovante_path]);
    }

    return apiSuccess({ id }, { message: 'Lançamento excluído.' });
  } catch (error: any) {
    console.error('Erro ao excluir lançamento:', error);
    return apiError('ENTRY_DELETE_FAILED', 500, 'Não foi possível excluir o lançamento.');
  }
}
