import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';
import { isSuperAdmin } from '@/lib/permissions';

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
    return { error: NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 }) };
  }

  if (!isSuperAdmin(user.email)) {
    return { error: NextResponse.json({ error: 'Sem permissão para gerenciar igrejas.' }, { status: 403 }) };
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

function normalizeChurchPayload(body: Record<string, unknown>) {
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
    pais: sanitizeString(body.pais) || 'Brasil',
    regiao: sanitizeString(body.regiao),
    email: sanitizeString(body.email)?.toLowerCase() || null,
    horario_publicacao_boletim: sanitizeString(body.horario_publicacao_boletim),
    dia_publicacao_boletim: sanitizeNumber(body.dia_publicacao_boletim),
    timezone_boletim: sanitizeString(body.timezone_boletim),
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
      const descricao_padrao = sanitizeString(row.descricao_padrao);

      if (!bloco || !tipo || !descricao_padrao) return null;

      return {
        igreja_id: igrejaId,
        bloco,
        ordem: sanitizeNumber(row.ordem) ?? index + 1,
        tipo,
        descricao_padrao,
        tem_cantico: typeof row.tem_cantico === 'boolean' ? row.tem_cantico : null,
      };
    })
    .filter(Boolean);
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
      { data: cultos, error: cultosError },
      { data: redes, error: redesError },
      { data: modelosLiturgia, error: modelosError },
    ] = await Promise.all([
      supabaseAdmin.from('igrejas').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin
        .from('igreja_cultos')
        .select('*')
        .eq('igreja_id', id)
        .order('ordem', { ascending: true })
        .order('horario', { ascending: true }),
      supabaseAdmin
        .from('igreja_redes_sociais')
        .select('*')
        .eq('igreja_id', id)
        .order('ordem', { ascending: true }),
      supabaseAdmin
        .from('modelos_liturgia')
        .select('*')
        .eq('igreja_id', id)
        .order('ordem', { ascending: true }),
    ]);

    if (igrejaError) throw igrejaError;
    if (cultosError) throw cultosError;
    if (redesError) throw redesError;
    if (modelosError) throw modelosError;

    if (!igreja) {
      return NextResponse.json({ error: 'Igreja não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({
      igreja,
      cultos: cultos || [],
      redesSociais: redes || [],
      modelosLiturgia: modelosLiturgia || [],
    });
  } catch (error: any) {
    console.error('Erro ao carregar igreja admin:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar igreja.' }, { status: 500 });
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
      return NextResponse.json({ error: 'Nome e slug são obrigatórios.' }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      igreja,
      cultos,
      redesSociais,
      modelosLiturgia,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar igreja:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar igreja.' }, { status: 500 });
  }
}
