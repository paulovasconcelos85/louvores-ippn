import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import { podeEditarRecursosMultimidia, type CargoTipo } from '@/lib/permissions';
import { getUserPermissionContext } from '@/lib/server-church';

type RecursoCategoria = 'culto' | 'ebd' | 'estudo' | 'especial';

const CATEGORIAS_VALIDAS = new Set<RecursoCategoria>(['culto', 'ebd', 'estudo', 'especial']);

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
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
  const categoria = sanitizeString(body.categoria) || 'culto';

  return {
    titulo: sanitizeString(body.titulo),
    categoria,
    data_recurso: sanitizeString(body.data_recurso) || sanitizeString(body.data),
    descricao: sanitizeString(body.descricao) || '',
    responsavel: sanitizeString(body.responsavel),
    youtube_url: sanitizeString(body.youtube_url) || sanitizeString(body.youtubeUrl),
    video_url:
      sanitizeString(body.video_url) ||
      sanitizeString(body.videoUrl) ||
      sanitizeString(body.youtube_url) ||
      sanitizeString(body.youtubeUrl),
    thumbnail_url: sanitizeString(body.thumbnail_url) || sanitizeString(body.thumbnailUrl),
    plataforma: sanitizeString(body.plataforma) || 'youtube',
    duracao: sanitizeString(body.duracao),
    ativo: typeof body.ativo === 'boolean' ? body.ativo : true,
    ordem: typeof body.ordem === 'number' && Number.isFinite(body.ordem) ? body.ordem : 0,
  };
}

function mapRecurso(item: any) {
  return {
    id: item.id,
    igreja_id: item.igreja_id,
    titulo: item.titulo,
    categoria: item.categoria,
    data: item.data_recurso,
    descricao: item.descricao,
    responsavel: item.responsavel,
    youtubeUrl: item.youtube_url,
    videoUrl: item.video_url || item.youtube_url,
    thumbnailUrl: item.thumbnail_url,
    plataforma: item.plataforma,
    duracao: item.duracao,
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

  const canEdit = podeEditarRecursosMultimidia(
    (contexto.cargo as CargoTipo | null) || null,
    contexto.tags
  );

  if (!canEdit) {
    return {
      error: apiError(
        'RESOURCES_EDIT_FORBIDDEN',
        403,
        'Sem permissão para editar os recursos da igreja.'
      ),
    };
  }

  return { contexto };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const igrejaId = searchParams.get('igreja_id');
  const incluirInativos = searchParams.get('incluir_inativos') === 'true';

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('recursos_multimidia')
      .select(
        `
          id,
          igreja_id,
          titulo,
          categoria,
          data_recurso,
          descricao,
          responsavel,
          youtube_url,
          video_url,
          thumbnail_url,
          plataforma,
          duracao,
          ativo,
          ordem,
          criado_em,
          atualizado_em
        `
      )
      .order('data_recurso', { ascending: false })
      .order('ordem', { ascending: true });

    if (!incluirInativos) {
      query = query.eq('ativo', true);
    }

    if (igrejaId) {
      query = query.eq('igreja_id', igrejaId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({ recursos: (data || []).map(mapRecurso) });
  } catch (error: any) {
    console.error('Erro ao listar recursos multimidia:', error);
    return apiError(
      'LOAD_RESOURCES_FAILED',
      500,
      error.message || 'Erro ao carregar recursos da igreja.'
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const payload = normalizePayload(body);
  const igrejaId = sanitizeString(body.igreja_id);
  const auth = await ensureEditAccess(request, igrejaId);
  if (auth.error) return auth.error;

  if (!payload.titulo || !payload.data_recurso || !CATEGORIAS_VALIDAS.has(payload.categoria as RecursoCategoria)) {
    return apiError(
      'RESOURCE_REQUIRED_FIELDS',
      400,
      'Título, data e categoria válida são obrigatórios.'
    );
  }

  try {
    const { data, error } = await (getSupabaseAdmin().from('recursos_multimidia') as any)
      .insert({
        ...payload,
        igreja_id: igrejaId || auth.contexto.igrejaId,
        criado_por: auth.contexto.user.id,
        atualizado_por: auth.contexto.user.id,
      })
      .select('*')
      .single();

    if (error) throw error;

    return apiSuccess(
      { recurso: mapRecurso(data) },
      {
        status: 201,
        message: 'Recurso criado com sucesso.',
        messageCode: 'RESOURCE_CREATED',
      }
    );
  } catch (error: any) {
    console.error('Erro ao criar recurso multimidia:', error);
    return apiError(
      'CREATE_RESOURCE_FAILED',
      500,
      error.message || 'Erro ao criar recurso da igreja.'
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = sanitizeString(body.id);
  const payload = normalizePayload(body);
  const igrejaId = sanitizeString(body.igreja_id);
  const auth = await ensureEditAccess(request, igrejaId);
  if (auth.error) return auth.error;

  if (!id || !payload.titulo || !payload.data_recurso || !CATEGORIAS_VALIDAS.has(payload.categoria as RecursoCategoria)) {
    return apiError(
      'RESOURCE_REQUIRED_FIELDS',
      400,
      'Recurso, título, data e categoria válida são obrigatórios.'
    );
  }

  try {
    const { data, error } = await (getSupabaseAdmin().from('recursos_multimidia') as any)
      .update({
        ...payload,
        atualizado_por: auth.contexto.user.id,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return apiSuccess(
      { recurso: mapRecurso(data) },
      {
        message: 'Recurso atualizado com sucesso.',
        messageCode: 'RESOURCE_UPDATED',
      }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar recurso multimidia:', error);
    return apiError(
      'UPDATE_RESOURCE_FAILED',
      500,
      error.message || 'Erro ao atualizar recurso da igreja.'
    );
  }
}
