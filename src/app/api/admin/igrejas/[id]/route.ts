import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';
import { isSuperAdmin } from '@/lib/permissions';
import { apiError, apiSuccess } from '@/lib/api-response';
import { compactLocalizedTextMap, normalizeLocalizedTextMap } from '@/lib/church-i18n';

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

async function ensureSuperAdmin(request: NextRequest) {
  const user = await getAuthenticatedUserFromServerCookies(request);

  if (!user?.id) {
    return { error: apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.') };
  }

  if (!isSuperAdmin(user.email)) {
    return { error: apiError('FORBIDDEN', 403, 'Sem permissão para gerenciar igrejas.') };
  }

  return { user };
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function sanitizeBoolean(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return null;

  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

function normalizePais(value: unknown) {
  const sanitized = sanitizeString(value)?.toUpperCase();
  if (!sanitized) return 'BR';
  if (sanitized === 'BR' || sanitized === 'BRASIL') return 'BR';
  if (sanitized === 'PT' || sanitized === 'PORTUGAL') return 'PT';
  if (sanitized === 'US' || sanitized === 'USA' || sanitized === 'ESTADOS UNIDOS') return 'US';
  if (sanitized === 'CA' || sanitized === 'CANADA' || sanitized === 'CANADÁ') return 'CA';
  return sanitized;
}

function normalizeChurchPayload(body: Record<string, unknown>) {
  const apresentacaoTituloI18n = normalizeLocalizedTextMap(
    body.apresentacao_titulo_i18n,
    sanitizeString(body.apresentacao_titulo)
  );
  const apresentacaoTextoI18n = normalizeLocalizedTextMap(
    body.apresentacao_texto_i18n,
    sanitizeString(body.apresentacao_texto)
  );

  return {
    nome: sanitizeString(body.nome),
    slug: sanitizeString(body.slug),
    cidade: sanitizeString(body.cidade),
    uf: sanitizeString(body.uf),
    ativo: sanitizeBoolean(body.ativo, true),
    nome_abreviado: sanitizeString(body.nome_abreviado),
    nome_completo: sanitizeString(body.nome_completo),
    logradouro: sanitizeString(body.logradouro),
    bairro: sanitizeString(body.bairro),
    cep: sanitizeString(body.cep),
    site: sanitizeString(body.site),
    visivel_publico: sanitizeBoolean(body.visivel_publico, true),
    endereco_completo: sanitizeString(body.endereco_completo),
    instagram: sanitizeString(body.instagram),
    youtube: sanitizeString(body.youtube),
    whatsapp: sanitizeString(body.whatsapp),
    telefone: sanitizeString(body.telefone),
    complemento: sanitizeString(body.complemento),
    tipos_liturgicos: body.tipos_liturgicos ?? null,
    modelo_liturgico_padrao: body.modelo_liturgico_padrao ?? null,
    modo_repertorio: sanitizeString(body.modo_repertorio),
    permite_cadastro_canticos: sanitizeBoolean(body.permite_cadastro_canticos, true),
    pais: normalizePais(body.pais),
    regiao: sanitizeString(body.regiao),
    email: sanitizeString(body.email)?.toLowerCase() || null,
    horario_publicacao_boletim: sanitizeString(body.horario_publicacao_boletim),
    dia_publicacao_boletim: sanitizeNumber(body.dia_publicacao_boletim),
    timezone_boletim: sanitizeString(body.timezone_boletim),
    apresentacao_titulo: apresentacaoTituloI18n.pt || sanitizeString(body.apresentacao_titulo),
    apresentacao_texto: apresentacaoTextoI18n.pt || sanitizeString(body.apresentacao_texto),
    apresentacao_titulo_i18n: compactLocalizedTextMap(apresentacaoTituloI18n),
    apresentacao_texto_i18n: compactLocalizedTextMap(apresentacaoTextoI18n),
    apresentacao_imagem_url: sanitizeString(body.apresentacao_imagem_url),
    apresentacao_youtube_url: sanitizeString(body.apresentacao_youtube_url),
    apresentacao_galeria: sanitizeStringArray(body.apresentacao_galeria),
  };
}

function normalizeCultos(igrejaId: string, rawItems: unknown) {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const nome = sanitizeString(row.nome);
      const dia_semana = sanitizeString(row.dia_semana);
      const horario = sanitizeString(row.horario);

      if (!nome || !dia_semana || !horario) return null;

      return {
        igreja_id: igrejaId,
        nome,
        dia_semana,
        horario,
        descricao: sanitizeString(row.descricao),
        ativo: sanitizeBoolean(row.ativo, true),
        ordem: sanitizeNumber(row.ordem) ?? index + 1,
      };
    })
    .filter(Boolean);
}

function normalizeRedes(igrejaId: string, rawItems: unknown) {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const tipo = sanitizeString(row.tipo);
      const url = sanitizeString(row.url);

      if (!tipo || !url) return null;

      return {
        igreja_id: igrejaId,
        tipo,
        url,
        ativo: sanitizeBoolean(row.ativo, true),
        ordem: sanitizeNumber(row.ordem) ?? index + 1,
      };
    })
    .filter(Boolean);
}

function normalizeModelosLiturgia(igrejaId: string, rawItems: unknown) {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const bloco = sanitizeString(row.bloco);
      const tipo = sanitizeString(row.tipo);
      const conteudo_publico_padrao =
        sanitizeString(row.conteudo_publico_padrao) || sanitizeString(row.conteudo_publico);
      const conteudoPublicoI18n = normalizeLocalizedTextMap(
        row.conteudo_publico_padrao_i18n,
        conteudo_publico_padrao
      );
      const descricao_interna_padrao =
        sanitizeString(row.descricao_interna_padrao) || sanitizeString(row.descricao_padrao);
      const descricaoInternaI18n = normalizeLocalizedTextMap(
        row.descricao_interna_padrao_i18n,
        descricao_interna_padrao
      );
      const conteudoPublicoCompactado = compactLocalizedTextMap(conteudoPublicoI18n);
      const descricaoInternaCompactada = compactLocalizedTextMap(descricaoInternaI18n);
      const descricao_padrao =
        descricaoInternaI18n.pt ||
        conteudoPublicoI18n.pt ||
        descricaoInternaI18n.es ||
        descricaoInternaI18n.en ||
        conteudoPublicoI18n.es ||
        conteudoPublicoI18n.en ||
        descricao_interna_padrao ||
        conteudo_publico_padrao;

      if (
        !bloco ||
        !tipo ||
        (!descricao_padrao && !conteudoPublicoCompactado && !descricaoInternaCompactada)
      ) {
        return null;
      }

      return {
        igreja_id: igrejaId,
        bloco,
        ordem: sanitizeNumber(row.ordem) ?? index + 1,
        tipo,
        descricao_padrao,
        conteudo_publico_padrao_i18n: conteudoPublicoCompactado,
        descricao_interna_padrao_i18n: descricaoInternaCompactada,
        tem_cantico: typeof row.tem_cantico === 'boolean' ? row.tem_cantico : null,
      };
    })
    .filter(Boolean);
}

function sortByOrdem<T extends { ordem?: number | null; horario?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const ordemA = typeof a.ordem === 'number' ? a.ordem : Number.MAX_SAFE_INTEGER;
    const ordemB = typeof b.ordem === 'number' ? b.ordem : Number.MAX_SAFE_INTEGER;

    if (ordemA !== ordemB) return ordemA - ordemB;

    const horarioA = typeof a.horario === 'string' ? a.horario : '';
    const horarioB = typeof b.horario === 'string' ? b.horario : '';

    return horarioA.localeCompare(horarioB);
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await ensureSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;

    const [
      { data: igreja, error: igrejaError },
      cultosResult,
      redesResult,
      modelosResult,
    ] = await Promise.all([
      supabaseAdmin.from('igrejas').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('igreja_cultos').select('*').eq('igreja_id', id),
      supabaseAdmin.from('igreja_redes_sociais').select('*').eq('igreja_id', id),
      supabaseAdmin.from('modelos_liturgia').select('*').eq('igreja_id', id),
    ]);

    if (igrejaError) throw igrejaError;

    if (!igreja) {
      return apiError('CHURCH_NOT_FOUND', 404, 'Igreja não encontrada.');
    }

    if (cultosResult.error) {
      console.warn('Falha ao carregar cultos da igreja no admin:', cultosResult.error);
    }

    if (redesResult.error) {
      console.warn('Falha ao carregar redes sociais da igreja no admin:', redesResult.error);
    }

    if (modelosResult.error) {
      console.warn('Falha ao carregar modelos de liturgia da igreja no admin:', modelosResult.error);
    }

    return apiSuccess({
      igreja,
      cultos: sortByOrdem(cultosResult.data || []),
      redesSociais: sortByOrdem(redesResult.data || []),
      modelosLiturgia: sortByOrdem(modelosResult.data || []),
    });
  } catch (error: any) {
    console.error('Erro ao carregar igreja admin:', error);
    return apiError(
      'LOAD_CHURCH_DETAILS_FAILED',
      500,
      error.message || 'Erro ao carregar igreja.'
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await ensureSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const igrejaPayload = normalizeChurchPayload(body);

    if (!igrejaPayload.nome || !igrejaPayload.slug) {
      return apiError('CHURCH_NAME_AND_SLUG_REQUIRED', 400, 'Nome e slug são obrigatórios.');
    }

    const cultos = normalizeCultos(id, body.cultos);
    const redesSociais = normalizeRedes(id, body.redesSociais);
    const modelosLiturgia = normalizeModelosLiturgia(id, body.modelosLiturgia);

    const { data: igreja, error: igrejaError } = await supabaseAdmin
      .from('igrejas')
      .update(igrejaPayload)
      .eq('id', id)
      .select('*')
      .single();

    if (igrejaError) throw igrejaError;

    const [
      { error: deleteCultosError },
      { error: deleteRedesError },
      { error: deleteModelosError },
    ] = await Promise.all([
      supabaseAdmin.from('igreja_cultos').delete().eq('igreja_id', id),
      supabaseAdmin.from('igreja_redes_sociais').delete().eq('igreja_id', id),
      supabaseAdmin.from('modelos_liturgia').delete().eq('igreja_id', id),
    ]);

    if (deleteCultosError) throw deleteCultosError;
    if (deleteRedesError) throw deleteRedesError;
    if (deleteModelosError) throw deleteModelosError;

    if (cultos.length > 0) {
      const { error } = await supabaseAdmin.from('igreja_cultos').insert(cultos);
      if (error) throw error;
    }

    if (redesSociais.length > 0) {
      const { error } = await supabaseAdmin.from('igreja_redes_sociais').insert(redesSociais);
      if (error) throw error;
    }

    if (modelosLiturgia.length > 0) {
      const { error } = await supabaseAdmin.from('modelos_liturgia').insert(modelosLiturgia);
      if (error) throw error;
    }

    return apiSuccess(
      {
        igreja,
        cultos,
        redesSociais,
        modelosLiturgia,
      },
      {
        message: 'Igreja atualizada com sucesso.',
        messageCode: 'CHURCH_UPDATED',
      }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar igreja:', error);
    return apiError(
      'SAVE_CHURCH_FAILED',
      500,
      error.message || 'Erro ao atualizar igreja.'
    );
  }
}
