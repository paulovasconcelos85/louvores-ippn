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

type IgrejaPayload = {
  nome: string;
  slug: string;
  cidade?: string | null;
  uf?: string | null;
  ativo?: boolean;
  nome_abreviado?: string | null;
  nome_completo?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cep?: string | null;
  site?: string | null;
  visivel_publico?: boolean;
  endereco_completo?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  whatsapp?: string | null;
  telefone?: string | null;
  complemento?: string | null;
  tipos_liturgicos?: unknown;
  modelo_liturgico_padrao?: unknown;
  modo_repertorio?: string | null;
  permite_cadastro_canticos?: boolean;
  pais?: string;
  regiao?: string | null;
  email?: string | null;
  horario_publicacao_boletim?: string | null;
  dia_publicacao_boletim?: number | null;
  timezone_boletim?: string | null;
};

function normalizeChurchPayload(body: Partial<IgrejaPayload>) {
  return {
    nome: body.nome?.trim(),
    slug: body.slug?.trim(),
    cidade: body.cidade?.trim() || null,
    uf: body.uf?.trim() || null,
    ativo: body.ativo ?? true,
    nome_abreviado: body.nome_abreviado?.trim() || null,
    nome_completo: body.nome_completo?.trim() || null,
    logradouro: body.logradouro?.trim() || null,
    bairro: body.bairro?.trim() || null,
    cep: body.cep?.trim() || null,
    site: body.site?.trim() || null,
    visivel_publico: body.visivel_publico ?? true,
    endereco_completo: body.endereco_completo?.trim() || null,
    instagram: body.instagram?.trim() || null,
    youtube: body.youtube?.trim() || null,
    whatsapp: body.whatsapp?.trim() || null,
    telefone: body.telefone?.trim() || null,
    complemento: body.complemento?.trim() || null,
    tipos_liturgicos: body.tipos_liturgicos ?? null,
    modelo_liturgico_padrao: body.modelo_liturgico_padrao ?? null,
    modo_repertorio: body.modo_repertorio?.trim() || null,
    permite_cadastro_canticos: body.permite_cadastro_canticos ?? true,
    pais: body.pais?.trim() || 'Brasil',
    regiao: body.regiao?.trim() || null,
    email: body.email?.trim()?.toLowerCase() || null,
    horario_publicacao_boletim: body.horario_publicacao_boletim?.trim() || null,
    dia_publicacao_boletim: body.dia_publicacao_boletim ?? null,
    timezone_boletim: body.timezone_boletim?.trim() || null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await ensureSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from('igrejas')
      .select('id, nome, slug, nome_abreviado, cidade, uf, regiao, pais, ativo, visivel_publico')
      .order('nome', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ igrejas: data || [] });
  } catch (error: any) {
    console.error('Erro ao listar igrejas admin:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar igrejas.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await ensureSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const payload = normalizeChurchPayload(body);

    if (!payload.nome || !payload.slug) {
      return NextResponse.json({ error: 'Nome e slug são obrigatórios.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('igrejas')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, igreja: data }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar igreja:', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar igreja.' }, { status: 500 });
  }
}
