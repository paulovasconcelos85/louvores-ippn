import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import { podeGerenciarEventos, type CargoTipo } from '@/lib/permissions';
import { getUserPermissionContext } from '@/lib/server-church';

let supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdmin;
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePayload(body: Record<string, unknown>) {
  return {
    titulo: sanitizeString(body.titulo),
    data_evento: sanitizeString(body.data_evento) || sanitizeString(body.data),
    hora: sanitizeString(body.hora),
    local: sanitizeString(body.local),
    descricao: sanitizeString(body.descricao) || '',
    imagem_url: sanitizeString(body.imagem_url) || sanitizeString(body.imagemUrl),
    responsavel: sanitizeString(body.responsavel),
    ativo: typeof body.ativo === 'boolean' ? body.ativo : true,
    ordem: typeof body.ordem === 'number' && Number.isFinite(body.ordem) ? body.ordem : 0,
  };
}

function mapEvento(item: any) {
  return {
    id: item.id,
    igreja_id: item.igreja_id,
    titulo: item.titulo,
    data: item.data_evento,
    hora: item.hora,
    local: item.local,
    descricao: item.descricao,
    imagemUrl: item.imagem_url,
    responsavel: item.responsavel,
    ativo: item.ativo,
    ordem: item.ordem,
    criado_em: item.criado_em,
    atualizado_em: item.atualizado_em,
  };
}

async function ensureEditAccess(request: NextRequest, igrejaId?: string | null) {
  const contexto = await getUserPermissionContext(igrejaId, request);

  if (!contexto?.user?.id) {
    return { error: apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.') };
  }

  const canEdit = podeGerenciarEventos((contexto.cargo as CargoTipo | null) || null, contexto.tags);

  if (!canEdit) {
    return {
      error: apiError('EVENTS_EDIT_FORBIDDEN', 403, 'Sem permissão para editar os eventos da igreja.'),
    };
  }

  return { contexto };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let igrejaId = searchParams.get('igreja_id');
  const incluirInativos = searchParams.get('incluir_inativos') === 'true';
  const incluirPassados = searchParams.get('incluir_passados') === 'true';

  // Eventos inativos são rascunhos/ocultos: só quem edita, e só da própria igreja.
  if (incluirInativos) {
    const auth = await ensureEditAccess(request, igrejaId);
    if (auth.error) return auth.error;
    igrejaId = auth.contexto.igrejaId;
    if (!igrejaId) {
      return apiError('CHURCH_REQUIRED', 400, 'Nenhuma igreja selecionada.');
    }
  }

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('eventos')
      .select(
        `
          id,
          igreja_id,
          titulo,
          data_evento,
          hora,
          local,
          descricao,
          imagem_url,
          responsavel,
          ativo,
          ordem,
          criado_em,
          atualizado_em
        `
      )
      // Próximo primeiro: o oposto de recursos (mais recente primeiro), porque
      // aqui o que importa é "o que vem a seguir", não "o que saiu por último".
      .order('data_evento', { ascending: true })
      .order('hora', { ascending: true })
      .order('ordem', { ascending: true });

    if (!incluirInativos) {
      query = query.eq('ativo', true);
    }

    if (!incluirPassados) {
      const hoje = new Date().toISOString().slice(0, 10);
      query = query.gte('data_evento', hoje);
    }

    if (igrejaId) {
      query = query.eq('igreja_id', igrejaId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({ eventos: (data || []).map(mapEvento) });
  } catch (error: any) {
    console.error('Erro ao listar eventos:', error);
    return apiError('LOAD_EVENTS_FAILED', 500, error.message || 'Erro ao carregar eventos da igreja.');
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const payload = normalizePayload(body);
  const igrejaId = sanitizeString(body.igreja_id);
  const auth = await ensureEditAccess(request, igrejaId);
  if (auth.error) return auth.error;

  if (!payload.titulo || !payload.data_evento) {
    return apiError('EVENT_REQUIRED_FIELDS', 400, 'Título e data são obrigatórios.');
  }

  try {
    const { data, error } = await (getSupabaseAdmin().from('eventos') as any)
      .insert({
        ...payload,
        // A igreja autorizada, não a pedida: getUserPermissionContext troca
        // por outra quando o usuário não tem vínculo com a igreja informada.
        igreja_id: auth.contexto.igrejaId,
        criado_por: auth.contexto.user.id,
        atualizado_por: auth.contexto.user.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    return apiSuccess(
      { evento: mapEvento(data) },
      { status: 201, message: 'Evento criado com sucesso.', messageCode: 'EVENT_CREATED' }
    );
  } catch (error: any) {
    console.error('Erro ao criar evento:', error);
    return apiError('CREATE_EVENT_FAILED', 500, error.message || 'Erro ao criar evento da igreja.');
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = sanitizeString(body.id);
  const payload = normalizePayload(body);
  const igrejaId = sanitizeString(body.igreja_id);
  const auth = await ensureEditAccess(request, igrejaId);
  if (auth.error) return auth.error;

  if (!id || !payload.titulo || !payload.data_evento) {
    return apiError('EVENT_REQUIRED_FIELDS', 400, 'Evento, título e data são obrigatórios.');
  }

  try {
    const { data, error } = await (getSupabaseAdmin().from('eventos') as any)
      .update({
        ...payload,
        atualizado_por: auth.contexto.user.id,
      })
      .eq('id', id)
      .eq('igreja_id', auth.contexto.igrejaId)
      .select('*')
      .single();

    if (error) throw error;

    return apiSuccess(
      { evento: mapEvento(data) },
      { message: 'Evento atualizado com sucesso.', messageCode: 'EVENT_UPDATED' }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar evento:', error);
    return apiError('UPDATE_EVENT_FAILED', 500, error.message || 'Erro ao atualizar evento da igreja.');
  }
}
