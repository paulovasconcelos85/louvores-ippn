import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissionContext } from '@/lib/server-church';

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

function normalizeTipos(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }

  return [];
}

async function ensureNotificationAccess(request: NextRequest, preferredIgrejaId?: string | null) {
  const contexto = await getUserPermissionContext(preferredIgrejaId, request);

  if (!contexto?.user?.id) {
    return { error: NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 }) };
  }

  if (!contexto.acesso?.id) {
    return {
      error: NextResponse.json(
        { error: 'Usuário sem acesso vinculado para consultar notificações.' },
        { status: 403 }
      ),
    };
  }

  if (!contexto.igrejaId) {
    return {
      error: NextResponse.json(
        { error: 'Nenhuma igreja ativa foi identificada para este usuário.' },
        { status: 400 }
      ),
    };
  }

  return { contexto };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const igrejaId = searchParams.get('igreja_id');

  const auth = await ensureNotificationAccess(request, igrejaId);
  if (auth.error) return auth.error;

  try {
    const igrejaAtualId = auth.contexto.igrejaId!;
    const usuarioAcessoId = auth.contexto.acesso!.id;

    const baseHeadQuery = () =>
      supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('igreja_id', igrejaAtualId)
        .eq('usuario_acesso_id', usuarioAcessoId)
        .is('read_at', null);

    const [{ count: unreadTotal }, { count: unreadPastoral }, { count: unreadEscalas }] = await Promise.all([
      baseHeadQuery(),
      baseHeadQuery().eq('tipo', 'pastoral.resumo_10min'),
      baseHeadQuery().eq('tipo', 'escala.usuario_alistado'),
    ]);

    return NextResponse.json({
      igrejaAtualId,
      unread: {
        total: unreadTotal || 0,
        pastoral: unreadPastoral || 0,
        escalas: unreadEscalas || 0,
      },
    });
  } catch (error: any) {
    console.error('Erro ao carregar resumo de notificações:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar notificações.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const igrejaId =
    body && typeof body === 'object' && typeof body.igreja_id === 'string' ? body.igreja_id : null;
  const tipos = normalizeTipos(body && typeof body === 'object' ? body.tipos : null);
  const markAll = !!(body && typeof body === 'object' && body.mark_all);

  const auth = await ensureNotificationAccess(request, igrejaId);
  if (auth.error) return auth.error;

  try {
    const igrejaAtualId = auth.contexto.igrejaId!;
    const usuarioAcessoId = auth.contexto.acesso!.id;

    let query = supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('igreja_id', igrejaAtualId)
      .eq('usuario_acesso_id', usuarioAcessoId)
      .is('read_at', null);

    if (!markAll && tipos.length > 0) {
      query = query.in('tipo', tipos);
    }

    const { data, error } = await query.select('id');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      updated: (data || []).length,
    });
  } catch (error: any) {
    console.error('Erro ao marcar notificações como lidas:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar notificações.' },
      { status: 500 }
    );
  }
}
