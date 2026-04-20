import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserPermissionContext } from '@/lib/server-church';
import { apiError, apiSuccess } from '@/lib/api-response';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const CARGOS_PEDIDOS_PASTORAIS = new Set(['pastor', 'seminarista', 'superadmin']);
const STATUS_VALIDOS = new Set(['novo', 'em_andamento', 'concluido']);

function podeGerirPedidosPastorais(cargo?: string | null, isSuperAdmin?: boolean) {
  if (isSuperAdmin) return true;
  if (!cargo) return false;
  return CARGOS_PEDIDOS_PASTORAIS.has(cargo);
}

async function ensurePastoralAccess(request: NextRequest, preferredIgrejaId?: string | null) {
  const contexto = await getUserPermissionContext(preferredIgrejaId, request);

  if (!contexto?.user?.id) {
    return { error: apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.') };
  }

  if (!podeGerirPedidosPastorais(contexto.cargo, contexto.isSuperAdmin)) {
    return {
      error: apiError(
        'PASTORAL_ACCESS_REQUIRED',
        403,
        'Sem permissão para acessar os pedidos pastorais.'
      ),
    };
  }

  if (!contexto.igrejaId) {
    return {
      error: apiError(
        'ACTIVE_CHURCH_REQUIRED',
        400,
        'Nenhuma igreja ativa foi identificada para este usuário.'
      ),
    };
  }

  return { contexto };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const igrejaId = searchParams.get('igreja_id');
  const status = searchParams.get('status');

  if (status && !STATUS_VALIDOS.has(status)) {
    return apiError('PASTORAL_STATUS_INVALID', 400, 'Status inválido.');
  }

  const auth = await ensurePastoralAccess(request, igrejaId);
  if (auth.error) return auth.error;

  try {
    const igrejaAtualId = auth.contexto.igrejaId!;

    let query = supabaseAdmin
      .from('pedidos_pastorais')
      .select(
        `
          id,
          igreja_id,
          usuario_acesso_id,
          pessoa_id,
          nome_solicitante,
          email_solicitante,
          telefone_solicitante,
          categoria,
          assunto,
          mensagem,
          deseja_retorno,
          status,
          criado_em,
          atualizado_em,
          pessoa:pessoa_id (
            id,
            nome,
            email,
            telefone
          ),
          usuario_acesso:usuario_acesso_id (
            id,
            nome,
            email
          )
        `
      )
      .eq('igreja_id', igrejaAtualId)
      .order('criado_em', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const [{ data: pedidos, error: pedidosError }, { count: novos }, { count: andamento }, { count: concluidos }, { data: igreja, error: igrejaError }] =
      await Promise.all([
        query,
        supabaseAdmin
          .from('pedidos_pastorais')
          .select('id', { count: 'exact', head: true })
          .eq('igreja_id', igrejaAtualId)
          .eq('status', 'novo'),
        supabaseAdmin
          .from('pedidos_pastorais')
          .select('id', { count: 'exact', head: true })
          .eq('igreja_id', igrejaAtualId)
          .eq('status', 'em_andamento'),
        supabaseAdmin
          .from('pedidos_pastorais')
          .select('id', { count: 'exact', head: true })
          .eq('igreja_id', igrejaAtualId)
          .eq('status', 'concluido'),
        supabaseAdmin.from('igrejas').select('id, nome, nome_abreviado, slug').eq('id', igrejaAtualId).maybeSingle(),
      ]);

    if (pedidosError) throw pedidosError;
    if (igrejaError) throw igrejaError;

    return apiSuccess({
      igrejaAtualId,
      igreja,
      pedidos: pedidos || [],
      contadores: {
        novo: novos || 0,
        em_andamento: andamento || 0,
        concluido: concluidos || 0,
        total: (novos || 0) + (andamento || 0) + (concluidos || 0),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar pedidos pastorais:', error);
    return apiError(
      'LOAD_PASTORAL_REQUESTS_FAILED',
      500,
      error.message || 'Erro ao carregar pedidos pastorais.'
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = typeof body?.id === 'string' ? body.id : null;
  const status = typeof body?.status === 'string' ? body.status : null;
  const igrejaId = typeof body?.igreja_id === 'string' ? body.igreja_id : null;

  if (!id || !status || !STATUS_VALIDOS.has(status)) {
    return apiError(
      'PASTORAL_REQUEST_AND_STATUS_REQUIRED',
      400,
      'Pedido e status válidos são obrigatórios.'
    );
  }

  const auth = await ensurePastoralAccess(request, igrejaId);
  if (auth.error) return auth.error;

  try {
    const { data: pedidoAtual, error: pedidoError } = await supabaseAdmin
      .from('pedidos_pastorais')
      .select('id, igreja_id, status')
      .eq('id', id)
      .maybeSingle();

    if (pedidoError) throw pedidoError;

    if (!pedidoAtual) {
      return apiError('PASTORAL_REQUEST_NOT_FOUND', 404, 'Pedido não encontrado.');
    }

    if (pedidoAtual.igreja_id !== auth.contexto.igrejaId) {
      return apiError(
        'PASTORAL_REQUEST_WRONG_CHURCH',
        403,
        'Este pedido não pertence à igreja ativa.'
      );
    }

    const { data: pedido, error: updateError } = await supabaseAdmin
      .from('pedidos_pastorais')
      .update({ status })
      .eq('id', id)
      .select(
        `
          id,
          igreja_id,
          usuario_acesso_id,
          pessoa_id,
          nome_solicitante,
          email_solicitante,
          telefone_solicitante,
          categoria,
          assunto,
          mensagem,
          deseja_retorno,
          status,
          criado_em,
          atualizado_em
        `
      )
      .single();

    if (updateError) throw updateError;

    return apiSuccess(
      { pedido },
      {
        message: 'Status do pedido atualizado.',
        messageCode: 'PASTORAL_REQUEST_UPDATED',
      }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar pedido pastoral:', error);
    return apiError(
      'UPDATE_PASTORAL_REQUEST_FAILED',
      500,
      error.message || 'Erro ao atualizar pedido pastoral.'
    );
  }
}
